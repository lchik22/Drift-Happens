import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  DeltaBroadcasterService,
  extractSegmentRefs,
  RefreshResult,
  Segment,
  SegmentDeltaEvent,
  SegmentDependency,
  SegmentEvaluatorService,
} from '@drift/shared';
import { CreateSegmentDto } from './dto/create-segment.dto';

@Injectable()
export class SegmentsService {
  private readonly logger = new Logger(SegmentsService.name);

  constructor(
    @InjectRepository(Segment) private readonly segments: Repository<Segment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly evaluator: SegmentEvaluatorService,
    private readonly broadcaster: DeltaBroadcasterService,
  ) {}

  findAll(): Promise<Segment[]> {
    return this.segments.find({ order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Segment> {
    const segment = await this.segments.findOne({ where: { id } });
    if (!segment) {
      throw new NotFoundException(`Segment ${id} not found`);
    }
    return segment;
  }

  async create(dto: CreateSegmentDto): Promise<Segment> {
    const existing = await this.segments.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Segment with name '${dto.name}' already exists`);
    }

    const parentIds = extractSegmentRefs(dto.rules);

    return this.dataSource.transaction(async (mgr) => {
      if (parentIds.length > 0) {
        await this.assertParentsExist(mgr, parentIds);
      }

      const segment = await mgr.save(
        mgr.create(Segment, {
          name: dto.name,
          description: dto.description ?? null,
          rules: dto.rules,
          isStatic: dto.isStatic ?? false,
        }),
      );

      if (parentIds.length === 0) {
        return segment;
      }

      if (parentIds.includes(segment.id)) {
        throw new BadRequestException(
          `Segment '${segment.name}' references itself in its rules`,
        );
      }
      await this.assertNoCycle(mgr, segment.id, parentIds);

      await mgr.save(
        parentIds.map((parentId) =>
          mgr.create(SegmentDependency, { parentId, childId: segment.id }),
        ),
      );
      this.logger.log(
        `segment ${segment.name}: registered ${parentIds.length} parent dependency(ies)`,
      );
      return segment;
    });
  }

  async refresh(id: string): Promise<RefreshResult> {
    const segment = await this.findOne(id);
    const result = await this.evaluator.refresh(segment);

    if (result.wasNoOp) {
      this.logger.log(
        `manual refresh of ${segment.name} (${segment.isStatic ? 'static' : 'dynamic'}): no-op, skipping fan-out`,
      );
      return result;
    }

    const event: SegmentDeltaEvent = {
      segmentId: segment.id,
      added: result.added,
      removed: result.removed,
      computedAt: result.evaluatedAt.toISOString(),
      cascadeDepth: 0,
    };
    this.broadcaster.broadcast(event);
    this.logger.log(
      `manual refresh of ${segment.name} (${segment.isStatic ? 'static' : 'dynamic'}): broadcast delta (+${result.added.length}/-${result.removed.length})`,
    );
    return result;
  }

  private async assertParentsExist(mgr: EntityManager, parentIds: string[]): Promise<void> {
    const found = await mgr.find(Segment, {
      where: { id: In(parentIds) },
      select: { id: true },
    });
    if (found.length === parentIds.length) return;
    const missing = parentIds.filter((id) => !found.some((s) => s.id === id));
    throw new BadRequestException(
      `Referenced segment(s) do not exist: ${missing.join(', ')}`,
    );
  }

  private async assertNoCycle(
    mgr: EntityManager,
    targetId: string,
    parentIds: string[],
  ): Promise<void> {
    const parentSet = new Set(parentIds);
    const visited = new Set<string>();
    const stack: string[] = [targetId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const children = await mgr.find(SegmentDependency, {
        where: { parentId: current },
        select: { childId: true },
      });
      for (const c of children) {
        if (parentSet.has(c.childId)) {
          throw new BadRequestException(
            `Cycle detected: segment ${targetId} cannot depend on ${c.childId} (already reachable from ${targetId} via the dependency graph)`,
          );
        }
        stack.push(c.childId);
      }
    }
  }
}
