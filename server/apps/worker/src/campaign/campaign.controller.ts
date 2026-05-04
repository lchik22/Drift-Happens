import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Customer, PATTERN_SEGMENT_DELTA_CAMPAIGN, Segment } from '@drift/shared';
import type { SegmentDeltaEvent } from '@drift/shared';

const NOTIFY_PREVIEW_LIMIT = 10;

@Controller()
export class CampaignController {
  private readonly logger = new Logger('CampaignWorker');

  constructor(
    @InjectRepository(Segment) private readonly segments: Repository<Segment>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
  ) {}

  @EventPattern(PATTERN_SEGMENT_DELTA_CAMPAIGN)
  async onSegmentDelta(
    @Payload() event: SegmentDeltaEvent,
    @Ctx() ctx: RmqContext,
  ): Promise<void> {
    const channel = ctx.getChannelRef();
    const message = ctx.getMessage();

    try {
      if (event.added.length === 0 && event.removed.length === 0) {
        channel.ack(message);
        return;
      }

      const segment = await this.segments.findOne({
        where: { id: event.segmentId },
        select: { id: true, name: true },
      });
      const segmentName = segment?.name ?? event.segmentId.slice(0, 8);

      if (event.added.length > 0) {
        const labels = await this.labelCustomers(event.added);
        this.logger.log(
          `[${segmentName}] would notify ${event.added.length} new member(s): ${this.preview(labels)}`,
        );
      }
      if (event.removed.length > 0) {
        const labels = await this.labelCustomers(event.removed);
        this.logger.log(
          `[${segmentName}] would tag ${event.removed.length} exited member(s) for churn analysis: ${this.preview(labels)}`,
        );
      }

      channel.ack(message);
    } catch (err) {
      this.logger.error(`campaign processing failed for segment ${event.segmentId}`, err as Error);
      channel.nack(message, false, false);
    }
  }

  private async labelCustomers(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const found = await this.customers.find({
      where: { id: In(ids.slice(0, NOTIFY_PREVIEW_LIMIT)) },
      select: { id: true, email: true, name: true },
    });
    const map = new Map(found.map((c) => [c.id, c.email ?? c.name ?? c.id.slice(0, 8)]));
    return ids.slice(0, NOTIFY_PREVIEW_LIMIT).map((id) => map.get(id) ?? id.slice(0, 8));
  }
  private preview(labels: string[]): string {
    if (labels.length === 0) return '<none>';
    const head = labels.join(', ');
    return labels.length === NOTIFY_PREVIEW_LIMIT ? `${head}, …` : head;
  }
}
