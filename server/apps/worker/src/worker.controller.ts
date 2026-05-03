import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { PATTERN_CUSTOMER_CHANGED } from '@drift/shared';
import type { CustomerChangedEvent } from '@drift/shared';
import { DebouncerService } from './processing/debouncer.service';

@Controller()
export class WorkerController {
  private readonly logger = new Logger(WorkerController.name);

  constructor(private readonly debouncer: DebouncerService) {}

  @EventPattern(PATTERN_CUSTOMER_CHANGED)
  onCustomerChanged(
    @Payload() event: CustomerChangedEvent,
    @Ctx() ctx: RmqContext,
  ): void {
    const channel = ctx.getChannelRef();
    const message = ctx.getMessage();
    try {
      this.debouncer.scheduleCustomer(event.customerId);
      channel.ack(message);
    } catch (err) {
      this.logger.error(`failed to schedule debounce for ${event.customerId}`, err as Error);
      channel.nack(message, false, false);
    }
  }
}
