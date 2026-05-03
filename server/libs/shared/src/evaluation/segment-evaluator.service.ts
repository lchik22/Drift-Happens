import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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
  private readonly logger = new Logger(SegmentEvaluatorService.name);
  private readonly compiler = new RuleCompiler();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly deltaCalc: DeltaCalculatorService,
  ) {}

  compile(segment: Segment): CompiledPredicate {
    return this.compiler.compileWhereClause(segment.rules);
  }

  async evaluate(segment: Segment): Promise<string[]> {
    const { sql: predicate, params } = this.compile(segment);
    const fullSql = `SELECT c.id FROM customers c WHERE ${predicate} ORDER BY c.id`;
    const rows: Array<{ id: string }> = await this.dataSource.query(fullSql, params);
    this.logger.log(
      `evaluated segment ${segment.id} (${segment.name}): ${rows.length} member(s)`,
    );
    return rows.map((row) => row.id);
  }

  async refresh(segment: Segment): Promise<RefreshResult> {
    const memberIds = await this.evaluate(segment);
    const result = await this.deltaCalc.computeAndPersist(segment, memberIds);
    return {
      memberIds,
      count: memberIds.length,
      added: result.added,
      removed: result.removed,
      wasNoOp: result.wasNoOp,
      snapshotId: result.snapshotId,
      deltaId: result.deltaId,
      evaluatedAt: result.computedAt,
    };
  }
}
