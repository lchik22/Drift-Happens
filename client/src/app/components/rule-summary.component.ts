import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
} from '@angular/core';
import { Rule } from '../models';
import { SegmentsCacheService } from '../services/segments-cache.service';

@Component({
  selector: 'drift-rule-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    @if (rule) {
      <span class="rule mono">{{ render(rule) }}</span>
    }
  `,
  styles: [
    `
      .rule {
        font-size: 12px;
        color: var(--text-dim);
        line-height: 1.6;
      }
    `,
  ],
})
export class RuleSummaryComponent {
  @Input() rule: Rule | null = null;
  private readonly cache = inject(SegmentsCacheService);

  /**
   * Render rules as a parenthesized expression. Walks the same shapes the
   * server compiles to SQL, so the surface here matches the rule engine.
   */
  protected render(rule: Rule): string {
    switch (rule.type) {
      case 'date_window_count':
        return `count(${rule.field}, last ${rule.windowDays}d) ${rule.operator} ${rule.value}`;
      case 'sum_threshold':
        return `sum(${rule.field}, last ${rule.windowDays}d) ${rule.operator} ${rule.value}`;
      case 'field_comparison':
        return `${rule.field} ${rule.operator} ${this.formatValue(rule.value)}`;
      case 'segment_membership': {
        const name = this.cache.nameFor(rule.segmentId) ?? rule.segmentId.slice(0, 8);
        return `member_of(${name})`;
      }
      case 'compound':
        return (
          '(' +
          rule.rules.map((r) => this.render(r)).join(` ${rule.op.toUpperCase()} `) +
          ')'
        );
    }
  }

  private formatValue(v: unknown): string {
    if (Array.isArray(v)) return `[${v.map((x) => JSON.stringify(x)).join(', ')}]`;
    return JSON.stringify(v);
  }
}
