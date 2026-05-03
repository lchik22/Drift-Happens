import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { PATTERN_SEGMENT_DELTA } from '@drift/shared';
import type { SegmentDeltaEvent } from '@drift/shared';
import { DeltasGateway } from './deltas.gateway';

@Controller()
export class DeltasController {
  private readonly logger = new Logger(DeltasController.name);

  constructor(private readonly gateway: DeltasGateway) {}

  @EventPattern(PATTERN_SEGMENT_DELTA)
  onSegmentDelta(@Payload() event: SegmentDeltaEvent, @Ctx() ctx: RmqContext): void {
    const channel = ctx.getChannelRef();
    const message = ctx.getMessage();
    try {
      this.gateway.publish(event);
      this.logger.log(
        `forwarded delta for segment ${event.segmentId.slice(0, 8)}… to WS clients (+${event.added.length}/-${event.removed.length})`,
      );
      channel.ack(message);
    } catch (err) {
      this.logger.error(`failed to forward delta for segment ${event.segmentId}`, err as Error);
      channel.nack(message, false, false);
    }
  }
}
