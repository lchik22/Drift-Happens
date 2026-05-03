import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshResult, Segment, SegmentEvaluatorService } from '@drift/shared';
import { CreateSegmentDto } from './dto/create-segment.dto';

@Injectable()
export class SegmentsService {
  constructor(
    @InjectRepository(Segment) private readonly segments: Repository<Segment>,
    private readonly evaluator: SegmentEvaluatorService,
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
    return this.evaluator.refresh(segment);
  }
}
