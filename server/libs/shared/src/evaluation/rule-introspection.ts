import type { Rule } from '../entities/rule.types';

export function extractSegmentRefs(rule: Rule): string[] {
  const out = new Set<string>();
  walk(rule, out);
  return [...out];
}

function walk(rule: Rule, out: Set<string>): void {
  switch (rule.type) {
    case 'segment_membership':
      out.add(rule.segmentId);
      return;
    case 'compound':
      for (const inner of rule.rules) walk(inner, out);
      return;
    default:
      return;
  }
}
