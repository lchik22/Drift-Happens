import { BadRequestException } from '@nestjs/common';
import type {
  ComparisonOperator,
  CompoundRule,
  DateWindowCountRule,
  FieldComparisonRule,
  Rule,
  SegmentMembershipRule,
  SumThresholdRule,
} from '../entities/rule.types';

const CUSTOMER_FIELD_MAP: Readonly<Record<string, string>> = {
  balance: 'balance',
  tx_count: 'tx_count',
  txCount: 'tx_count',
  last_tx_at: 'last_tx_at',
  lastTxAt: 'last_tx_at',
  name: 'name',
  email: 'email',
};

const SCALAR_OPERATORS = new Set<ComparisonOperator>(['=', '!=', '<', '<=', '>', '>=']);

export interface CompiledPredicate {
  sql: string;
  params: unknown[];
}

class CompileContext {
  readonly params: unknown[] = [];

  push(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }
}

export class RuleCompiler {
  compileWhereClause(rule: Rule): CompiledPredicate {
    const ctx = new CompileContext();
    const sql = this.compile(rule, ctx);
    return { sql, params: ctx.params };
  }

  private compile(rule: Rule, ctx: CompileContext): string {
    switch (rule.type) {
      case 'date_window_count':
        return this.dateWindowCount(rule, ctx);
      case 'sum_threshold':
        return this.sumThreshold(rule, ctx);
      case 'field_comparison':
        return this.fieldComparison(rule, ctx);
      case 'segment_membership':
        return this.segmentMembership(rule, ctx);
      case 'compound':
        return this.compound(rule, ctx);
    }
  }

  private dateWindowCount(rule: DateWindowCountRule, ctx: CompileContext): string {
    if (rule.field !== 'transactions') {
      throw new BadRequestException(
        `date_window_count.field must be 'transactions', got '${rule.field}'`,
      );
    }
    if (!SCALAR_OPERATORS.has(rule.operator)) {
      throw new BadRequestException(
        `date_window_count.operator must be one of ${[...SCALAR_OPERATORS].join(',')}, got '${rule.operator}'`,
      );
    }
    const days = ctx.push(rule.windowDays);
    const value = ctx.push(rule.value);
    return `(SELECT COUNT(*) FROM transactions t
            WHERE t.customer_id = c.id
              AND t.occurred_at >= NOW() - (${days} || ' days')::interval) ${rule.operator} ${value}`;
  }

  private sumThreshold(rule: SumThresholdRule, ctx: CompileContext): string {
    if (!SCALAR_OPERATORS.has(rule.operator)) {
      throw new BadRequestException(
        `sum_threshold.operator must be one of ${[...SCALAR_OPERATORS].join(',')}, got '${rule.operator}'`,
      );
    }
    const days = ctx.push(rule.windowDays);
    const value = ctx.push(rule.value);
    return `COALESCE((SELECT SUM(t.amount) FROM transactions t
                     WHERE t.customer_id = c.id
                       AND t.occurred_at >= NOW() - (${days} || ' days')::interval), 0) ${rule.operator} ${value}`;
  }

  private fieldComparison(rule: FieldComparisonRule, ctx: CompileContext): string {
    const column = CUSTOMER_FIELD_MAP[rule.field];
    if (!column) {
      throw new BadRequestException(`field_comparison.field '${rule.field}' is not allowed`);
    }

    if (rule.operator === 'in' || rule.operator === 'not_in') {
      if (!Array.isArray(rule.value)) {
        throw new BadRequestException(`field_comparison.operator '${rule.operator}' requires an array value`);
      }
      const param = ctx.push(rule.value);
      const negation = rule.operator === 'not_in' ? 'NOT ' : '';
      return `${negation}(c.${column} = ANY(${param}))`;
    }

    if (!SCALAR_OPERATORS.has(rule.operator)) {
      throw new BadRequestException(`field_comparison.operator '${rule.operator}' is not allowed for scalar values`);
    }
    if (Array.isArray(rule.value)) {
      throw new BadRequestException(`field_comparison.operator '${rule.operator}' requires a scalar value`);
    }
    const param = ctx.push(rule.value);
    return `c.${column} ${rule.operator} ${param}`;
  }

  private segmentMembership(rule: SegmentMembershipRule, ctx: CompileContext): string {
    const segId = ctx.push(rule.segmentId);
    return `c.id = ANY(
      COALESCE(
        (SELECT customer_ids FROM membership_snapshots
         WHERE segment_id = ${segId}
         ORDER BY evaluated_at DESC LIMIT 1),
        '{}'::uuid[]
      )
    )`;
  }

  private compound(rule: CompoundRule, ctx: CompileContext): string {
    if (rule.rules.length === 0) {
      throw new BadRequestException('compound rule must contain at least one sub-rule');
    }
    const join = rule.op === 'and' ? ' AND ' : ' OR ';
    return rule.rules.map((sub) => `(${this.compile(sub, ctx)})`).join(join);
  }
}
