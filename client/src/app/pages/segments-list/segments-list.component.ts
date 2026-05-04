import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { RuleSummaryComponent } from '../../components/rule-summary.component';
import { Segment, SegmentDeltaEvent } from '../../models';
import { DeltasService } from '../../services/deltas.service';
import { SegmentsCacheService } from '../../services/segments-cache.service';

interface ListItem {
  segment: Segment;
  flash: 'add' | 'remove' | null;
  lastDelta: SegmentDeltaEvent | null;
}

@Component({
  selector: 'drift-segments-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, RuleSummaryComponent],
  template: `
    <header class="page-header">
      <h1>Segments</h1>
      <p class="muted">
        Dynamic segments react to data events; static segments only refresh on demand.
        Live deltas flash on the cards as they arrive.
      </p>
    </header>

    @if (loading) {
      <p class="muted">Loading segments…</p>
    }
    @if (error) {
      <div class="card error">{{ error }}</div>
    }

    <div class="grid cards">
      @for (item of items; track item.segment.id) {
        <a class="card segment"
           [class.flash-add]="item.flash === 'add'"
           [class.flash-remove]="item.flash === 'remove'"
           [routerLink]="['/segments', item.segment.id]">
          <div class="card-head">
            <h2>{{ item.segment.name }}</h2>
            <span class="tag" [class.dynamic]="!item.segment.isStatic"
                              [class.static]="item.segment.isStatic">
              {{ item.segment.isStatic ? 'static' : 'dynamic' }}
            </span>
          </div>
          @if (item.segment.description) {
            <p class="muted desc">{{ item.segment.description }}</p>
          }
          <div class="rule">
            <drift-rule-summary [rule]="item.segment.rules"></drift-rule-summary>
          </div>
          @if (item.lastDelta) {
            <div class="last-delta">
              <span class="muted">last delta</span>
              <span class="added">+{{ item.lastDelta.added.length }}</span>
              <span class="removed">-{{ item.lastDelta.removed.length }}</span>
              <span class="muted ts">{{ item.lastDelta.computedAt | date: 'HH:mm:ss' }}</span>
            </div>
          }
        </a>
      }
    </div>
  `,
  styles: [
    `
      .page-header { margin-bottom: 24px; }
      .page-header h1 { margin: 0 0 4px; font-size: 24px; }
      .page-header p { margin: 0; }
      .cards {
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      }
      .segment {
        display: block;
        text-decoration: none;
        color: var(--text);
        transition: background 120ms, border-color 120ms, transform 120ms;
      }
      .segment:hover {
        text-decoration: none;
        border-color: var(--accent);
        background: var(--bg-elev-2);
      }
      .segment.flash-add {
        border-color: var(--added);
        box-shadow: 0 0 0 2px rgba(63, 185, 80, 0.18);
      }
      .segment.flash-remove {
        border-color: var(--removed);
        box-shadow: 0 0 0 2px rgba(248, 81, 73, 0.18);
      }
      .card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .card-head h2 { margin: 0; font-size: 16px; }
      .desc {
        margin: 8px 0;
        font-size: 13px;
      }
      .rule { margin: 12px 0 8px; }
      .last-delta {
        display: flex;
        gap: 8px;
        align-items: center;
        font-family: var(--mono);
        font-size: 12px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px dashed var(--border);
      }
      .added { color: var(--added); font-weight: 600; }
      .removed { color: var(--removed); font-weight: 600; }
      .ts { margin-left: auto; }
      .error { border-color: var(--removed); color: var(--removed); }
    `,
  ],
})
export class SegmentsListComponent {
  private readonly cache = inject(SegmentsCacheService);
  private readonly deltas = inject(DeltasService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  protected items: ListItem[] = [];
  protected loading = true;
  protected error: string | null = null;

  constructor() {
    this.cache
      .all$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (segments) => {
          this.loading = false;
          const byId = new Map(this.items.map((i) => [i.segment.id, i] as const));
          this.items = segments.map(
            (s) =>
              byId.get(s.id) ?? { segment: s, flash: null, lastDelta: null },
          );
          for (const item of this.items) {
            if (byId.has(item.segment.id)) {
              item.segment = segments.find((s) => s.id === item.segment.id)!;
            }
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.error = `Failed to load segments: ${err.message ?? err}`;
          this.cdr.markForCheck();
        },
      });

    this.deltas
      .all()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.applyDelta(event));
  }

  private applyDelta(event: SegmentDeltaEvent): void {
    const item = this.items.find((i) => i.segment.id === event.segmentId);
    if (!item) return;
    item.lastDelta = event;
    if (event.added.length > event.removed.length) item.flash = 'add';
    else if (event.removed.length > 0) item.flash = 'remove';
    this.cdr.markForCheck();
    setTimeout(() => {
      item.flash = null;
      this.cdr.markForCheck();
    }, 1200);
  }
}
