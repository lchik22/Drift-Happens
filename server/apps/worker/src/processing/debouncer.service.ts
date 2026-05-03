import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ProcessorService } from './processor.service';

@Injectable()
export class DebouncerService implements OnModuleDestroy {
  private readonly logger = new Logger(DebouncerService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly debounceMs = 500;

  constructor(private readonly processor: ProcessorService) {}

  scheduleCustomer(customerId: string): void {
    const existing = this.timers.get(customerId);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.timers.delete(customerId);
      this.logger.log(`debounce fired for customer ${customerId.slice(0, 8)}…, requesting evaluation pass`);
      void this.processor.runEvaluationPass();
    }, this.debounceMs);
    this.timers.set(customerId, timer);
  }

  pendingCount(): number {
    return this.timers.size;
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
