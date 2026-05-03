import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  chunks,
  DeltaBroadcasterService,
  DeltaCalculatorService,
  PATTERN_SEGMENT_DELTA,
  Segment,
  SegmentEvaluatorService,
} from '@drift/shared';
import type { SegmentDeltaEvent } from '@drift/shared';

const SEGMENT_CHUNK_SIZE = 10;

@Injectable()
export class ProcessorService {
  private readonly logger = new Logger(ProcessorService.name);
  private isProcessing = false;
  private hasPending = false;

  constructor(
    @InjectRepository(Segment) private readonly segments: Repository<Segment>,
    private readonly evaluator: SegmentEvaluatorService,
    private readonly deltaCalc: DeltaCalculatorService,
    private readonly broadcaster: DeltaBroadcasterService,
  ) {}

  async runEvaluationPass(): Promise<void> {
    if (this.isProcessing) {
      this.hasPending = true;
      return;
    }
    this.isProcessing = true;

    try {
      const dynamicSegments = await this.segments.find({
        where: { isStatic: false },
        order: { createdAt: 'ASC' },
      });
      this.logger.log(
        `evaluation pass start: ${dynamicSegments.length} dynamic segment(s) (static segments skipped)`,
      );

      let emitted = 0;
      let noOps = 0;
      for (const chunk of chunks(dynamicSegments, SEGMENT_CHUNK_SIZE)) {
        for (const segment of chunk) {
          const outcome = await this.evaluateAndPublishSegment(segment, 0);
          if (outcome === 'emitted') emitted += 1;
          else if (outcome === 'noop') noOps += 1;
        }
        await Promise.resolve();
      }

      this.logger.log(`evaluation pass done: emitted=${emitted}, no-ops=${noOps}`);
    } finally {
      this.isProcessing = false;
      if (this.hasPending) {
        this.hasPending = false;
        setImmediate(() => {
          void this.runEvaluationPass();
        });
      }
    }
  }

  async evaluateAndPublishSegment(
    segment: Segment,
    cascadeDepth: number,
  ): Promise<'emitted' | 'noop' | 'error'> {
    try {
      const memberIds = await this.evaluator.evaluate(segment);
      const result = await this.deltaCalc.computeAndPersist(segment, memberIds);
      if (result.wasNoOp || !result.event) {
        return 'noop';
      }
      const event: SegmentDeltaEvent = { ...result.event, cascadeDepth };
      this.broadcaster.broadcast(event);
      this.logger.log(
        `broadcast ${PATTERN_SEGMENT_DELTA} for ${segment.name} (+${result.added.length}/-${result.removed.length}, depth=${cascadeDepth})`,
      );
      return 'emitted';
    } catch (err) {
      this.logger.error(`failed to process segment ${segment.name}`, err as Error);
      return 'error';
    }
  }
}
