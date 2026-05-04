/**
 * Mirrors @drift/shared/entities/rule.types. Kept in sync by hand because the
 * server isn't a publishable npm package.
 */
export type ComparisonOperator =
  | '='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'in'
  | 'not_in';

export interface DateWindowCountRule {
  type: 'date_window_count';
  field: string;
  windowDays: number;
  operator: ComparisonOperator;
  value: number;
}

export interface SumThresholdRule {
  type: 'sum_threshold';
  field: string;
  windowDays: number;
  operator: ComparisonOperator;
  value: number;
}

export interface FieldComparisonRule {
  type: 'field_comparison';
  field: string;
  operator: ComparisonOperator;
  value: string | number | boolean | Array<string | number>;
}

export interface SegmentMembershipRule {
  type: 'segment_membership';
  segmentId: string;
}

export interface CompoundRule {
  type: 'compound';
  op: 'and' | 'or';
  rules: Rule[];
}

export type Rule =
  | DateWindowCountRule
  | SumThresholdRule
  | FieldComparisonRule
  | SegmentMembershipRule
  | CompoundRule;
