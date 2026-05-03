import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PATTERN_SEGMENT_DELTA,
  RefreshResult,
  RMQ_DELTA_PUBLISHER,
  Segment,
  SegmentDeltaEvent,
  SegmentEvaluatorService,
} from '@drift/shared';
import { CreateSegmentDto } from './dto/create-segment.dto';

@Injectable()
export class SegmentsService {
  private readonly logger = new Logger(SegmentsService.name);

  constructor(
    @InjectRepository(Segment) private readonly segments: Repository<Segment>,
    private readonly evaluator: SegmentEvaluatorService,
    @Inject(RMQ_DELTA_PUBLISHER) private readonly deltaPublisher: ClientProxy,
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
    const segment = this.segments.create({
      name: dto.name,
      description: dto.description ?? null,
      rules: dto.rules,
      isStatic: dto.isStatic ?? false,
    });
    return this.segments.save(segment);
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
    this.deltaPublisher.emit(PATTERN_SEGMENT_DELTA, event);
    this.logger.log(
      `manual refresh of ${segment.name} (${segment.isStatic ? 'static' : 'dynamic'}): emitted delta (+${result.added.length}/-${result.removed.length})`,
    );
    return result;
  }
}
