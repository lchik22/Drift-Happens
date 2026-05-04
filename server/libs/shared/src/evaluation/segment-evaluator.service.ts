import { Injectable } from '@nestjs/common';
import type { Segment } from '../entities/segment.entity';
import { DeltaCalculatorService } from './delta-calculator.service';
import { RuleCompiler, type CompiledPredicate } from './rule-compiler';

export interface RefreshResult {
  memberIds: string[];
  count: number;
  added: string[];
  removed: string[];
  wasNoOp: boolean;
  snapshotId: string | null;
  deltaId: string | null;
  evaluatedAt: Date;
}

@Injectable()
export class SegmentEvaluatorService {
  private readonly compiler = new RuleCompiler();

  constructor(private readonly deltaCalc: DeltaCalculatorService) {}

  compile(segment: Segment): CompiledPredicate {
    return this.compiler.compileWhereClause(segment.rules);
  }

  async refresh(segment: Segment): Promise<RefreshResult> {
    const predicate = this.compile(segment);
    const result = await this.deltaCalc.computeAndPersist(segment, predicate);
    return {
      memberIds: result.members,
      count: result.members.length,
      added: result.added,
      removed: result.removed,
      wasNoOp: result.wasNoOp,
      snapshotId: result.snapshotId,
      deltaId: result.deltaId,
      evaluatedAt: result.computedAt,
    };
  }
}
