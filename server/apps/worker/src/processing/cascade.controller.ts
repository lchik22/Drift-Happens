import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PATTERN_SEGMENT_DELTA, Segment, SegmentDependency } from '@drift/shared';
import type { SegmentDeltaEvent } from '@drift/shared';
import { ProcessorService } from './processor.service';

const MAX_CASCADE_DEPTH = 10;
const WARN_CASCADE_DEPTH = 5;

@Controller()
export class CascadeController {
  private readonly logger = new Logger(CascadeController.name);

  constructor(
    @InjectRepository(SegmentDependency)
    private readonly dependencies: Repository<SegmentDependency>,
    @InjectRepository(Segment)
    private readonly segments: Repository<Segment>,
    private readonly processor: ProcessorService,
  ) {}

  @EventPattern(PATTERN_SEGMENT_DELTA)
  async onSegmentDelta(
    @Payload() event: SegmentDeltaEvent,
    @Ctx() ctx: RmqContext,
  ): Promise<void> {
    const channel = ctx.getChannelRef();
    const message = ctx.getMessage();
    const childDepth = (event.cascadeDepth ?? 0) + 1;

    try {
      if (childDepth > MAX_CASCADE_DEPTH) {
        this.logger.warn(
          `cascade depth ${childDepth} exceeds max ${MAX_CASCADE_DEPTH}; dropping event for segment ${event.segmentId}`,
        );
        channel.ack(message);
        return;
      }
      if (childDepth > WARN_CASCADE_DEPTH) {
        this.logger.warn(
          `cascade depth ${childDepth} for segment ${event.segmentId} (>${WARN_CASCADE_DEPTH}, possible deep dependency chain)`,
        );
      }

      const deps = await this.dependencies.find({ where: { parentId: event.segmentId } });
      if (deps.length === 0) {
        channel.ack(message);
        return;
      }

      const childIds = deps.map((d) => d.childId);
      const children = await this.segments.findByIds(childIds);
      const dynamicChildren = children.filter((c) => !c.isStatic);

      this.logger.log(
        `cascade for segment ${event.segmentId.slice(0, 8)}…: ${dynamicChildren.length} dynamic child(ren) [depth=${childDepth}]`,
      );

      for (const child of dynamicChildren) {
        await this.processor.evaluateAndPublishSegment(child, childDepth);
      }

      channel.ack(message);
    } catch (err) {
      this.logger.error(`cascade processing failed for segment ${event.segmentId}`, err as Error);
      channel.nack(message, false, false);
    }
  }
}
