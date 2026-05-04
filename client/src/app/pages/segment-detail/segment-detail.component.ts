import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, switchMap } from 'rxjs';
import { RuleSummaryComponent } from '../../components/rule-summary.component';
import {
  Customer,
  RefreshResult,
  Segment,
  SegmentDeltaEvent,
} from '../../models';
import { CustomersService } from '../../services/customers.service';
import { DeltasService } from '../../services/deltas.service';
import { SegmentsCacheService } from '../../services/segments-cache.service';
import { SegmentsService } from '../../services/segments.service';

interface DeltaEntry {
  event: SegmentDeltaEvent;
  receivedAt: Date;
}

@Component({
  selector: 'drift-segment-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, RuleSummaryComponent],
  template: `
    <a routerLink="/segments" class="back">← All segments</a>

    @if (loading) {
      <p class="muted">Loading…</p>
    }
    @if (error) {
      <div class="card error">{{ error }}</div>
    }

    @if (segment) {
      <header class="head">
        <div class="title">
          <h1>{{ segment.name }}</h1>
          <span class="tag" [class.dynamic]="!segment.isStatic"
                            [class.static]="segment.isStatic">
            {{ segment.isStatic ? 'static' : 'dynamic' }}
          </span>
        </div>
        @if (segment.description) {
          <p class="muted">{{ segment.description }}</p>
        }
        <div class="rule-line">
          <drift-rule-summary [rule]="segment.rules"></drift-rule-summary>
        </div>
      </header>

      <section class="card actions">
        <div>
          <strong>Manual refresh</strong>
          <p class="muted small">
            @if (segment.isStatic) {
              Static segment — refresh is the only way to update its membership.
            } @else {
              Dynamic segment — also re-evaluates on customer change events. Manual
              refresh is idempotent: a no-op delta short-circuits fan-out.
            }
          </p>
        </div>
        <button class="primary" (click)="refresh()" [disabled]="refreshing">
          {{ refreshing ? 'Refreshing…' : 'Refresh & load members' }}
        </button>
      </section>

      <div class="grid two-col">
        <section class="card">
          <header class="card-head">
            <h2>Members</h2>
            <span class="muted small">
              {{ memberCount === null ? 'click refresh to load' : (memberCount + ' member(s)') }}
            </span>
          </header>
          @if (memberCount !== null) {
            <div class="members">
              @for (m of memberRows; track m.id) {
                <div class="member"
                     [class.added]="addedSet.has(m.id)"
                     [class.removed]="removedSet.has(m.id)">
                  <span class="m-name">{{ m.name ?? '(unnamed)' }}</span>
                  <span class="m-email muted">{{ m.email ?? '—' }}</span>
                  <span class="m-balance mono">{{ m.balance }}</span>
                </div>
              } @empty {
                <p class="muted small">No members in this segment.</p>
              }
            </div>
          }
        </section>

        <section class="card">
          <header class="card-head">
            <h2>Live deltas</h2>
            <span class="muted small">{{ deltaLog.length }} since you opened this page</span>
          </header>
          @if (deltaLog.length === 0) {
            <p class="muted small">
              Waiting for deltas… try advancing time or adding a transaction
              from the <a routerLink="/simulate">Simulate</a> page.
            </p>
          }
          @for (d of deltaLog; track d.receivedAt) {
            <div class="delta-row">
              <span class="ts mono">{{ d.receivedAt | date: 'HH:mm:ss' }}</span>
              <span class="added">+{{ d.event.added.length }}</span>
              <span class="removed">-{{ d.event.removed.length }}</span>
              @if ((d.event.cascadeDepth ?? 0) > 0) {
                <span class="depth">cascade depth {{ d.event.cascadeDepth }}</span>
              }
              <details class="ids">
                <summary class="muted">show ids</summary>
                @if (d.event.added.length > 0) {
                  <div class="id-list added-bg">
                    <strong>Added</strong>
                    @for (id of d.event.added; track id) {
                      <span class="mono pill">{{ idLabel(id) }}</span>
                    }
                  </div>
                }
                @if (d.event.removed.length > 0) {
                  <div class="id-list removed-bg">
                    <strong>Removed</strong>
                    @for (id of d.event.removed; track id) {
                      <span class="mono pill">{{ idLabel(id) }}</span>
                    }
                  </div>
                }
              </details>
            </div>
          }
        </section>
      </div>
    }
  `,
  styles: [
    `
      .back { display: inline-block; margin-bottom: 12px; font-size: 13px; }
      .head { margin-bottom: 16px; }
      .title { display: flex; align-items: center; gap: 12px; }
      .title h1 { margin: 0; font-size: 22px; }
      .head p { margin: 4px 0 8px; }
      .rule-line { margin-top: 8px; }
      .actions {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
      }
      .actions > div { flex: 1; }
      .actions .small { margin: 4px 0 0; font-size: 12px; }
      .two-col {
        grid-template-columns: 1fr 1fr;
      }
      @media (max-width: 880px) {
        .two-col { grid-template-columns: 1fr; }
      }
      .card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .card-head h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); }
      .small { font-size: 12px; }
      .members {
        max-height: 480px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .member {
        display: grid;
        grid-template-columns: 120px 1fr 100px;
        gap: 12px;
        align-items: center;
        padding: 6px 8px;
        border-radius: 4px;
        background: var(--bg);
        border: 1px solid transparent;
        transition: background 200ms, border-color 200ms;
      }
      .member.added {
        background: rgba(63, 185, 80, 0.10);
        border-color: var(--added);
      }
      .member.removed {
        background: rgba(248, 81, 73, 0.10);
        border-color: var(--removed);
        opacity: 0.7;
      }
      .m-name { font-weight: 500; }
      .m-balance { text-align: right; color: var(--text-dim); }
      .delta-row {
        display: grid;
        grid-template-columns: auto auto auto auto 1fr;
        gap: 10px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--border);
        font-size: 13px;
      }
      .delta-row:last-child { border-bottom: none; }
      .added { color: var(--added); font-weight: 600; }
      .removed { color: var(--removed); font-weight: 600; }
      .depth {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--warn);
        background: rgba(210, 153, 34, 0.15);
        padding: 1px 6px;
        border-radius: 2px;
      }
      .ids { grid-column: 1 / -1; margin-top: 4px; }
      .ids summary { cursor: pointer; font-size: 11px; padding: 2px 0; }
      .id-list {
        padding: 8px;
        border-radius: 4px;
        margin-top: 4px;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
      }
      .id-list strong { font-size: 11px; margin-right: 4px; }
      .added-bg { background: rgba(63, 185, 80, 0.06); }
      .removed-bg { background: rgba(248, 81, 73, 0.06); }
      .pill {
        background: var(--bg);
        padding: 1px 6px;
        border-radius: 3px;
        border: 1px solid var(--border);
        font-size: 11px;
      }
      .ts { color: var(--text-dim); font-size: 12px; }
      .error { border-color: var(--removed); color: var(--removed); }
    `,
  ],
})
export class SegmentDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(SegmentsService);
  private readonly customers = inject(CustomersService);
  private readonly deltas = inject(DeltasService);
  private readonly cache = inject(SegmentsCacheService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  protected segment: Segment | null = null;
  protected loading = true;
  protected error: string | null = null;
  protected refreshing = false;

  protected memberCount: number | null = null;
  protected memberRows: Customer[] = [];
  protected addedSet = new Set<string>();
  protected removedSet = new Set<string>();
  private allCustomers: Customer[] = [];
  protected deltaLog: DeltaEntry[] = [];

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.customers.list()])
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(([params, custs]) => {
          this.allCustomers = custs;
          const id = params.get('id');
          if (!id) throw new Error('Missing segment id');
          return this.api.get(id);
        }),
      )
      .subscribe({
        next: (segment) => {
          this.segment = segment;
          this.loading = false;
          this.cache.upsert(segment);
          this.subscribeDeltas(segment.id);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.error = `Failed to load segment: ${err.message ?? err}`;
          this.cdr.markForCheck();
        },
      });
  }

  private subscribeDeltas(segmentId: string): void {
    this.deltas
      .forSegment(segmentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.handleDelta(event));

    this.destroyRef.onDestroy(() => this.deltas.unsubscribe(segmentId));
  }

  private handleDelta(event: SegmentDeltaEvent): void {
    this.deltaLog = [{ event, receivedAt: new Date() }, ...this.deltaLog].slice(0, 50);
    if (this.memberCount !== null) {
      const addedSet = new Set(this.memberRows.map((r) => r.id));
      for (const id of event.added) addedSet.add(id);
      for (const id of event.removed) addedSet.delete(id);
      this.memberCount = addedSet.size;
      this.memberRows = this.allCustomers.filter((c) => addedSet.has(c.id));

      this.addedSet = new Set(event.added);
      this.removedSet = new Set(event.removed);
      this.cdr.markForCheck();
      setTimeout(() => {
        this.addedSet = new Set();
        this.removedSet = new Set();
        this.cdr.markForCheck();
      }, 1500);
    } else {
      this.cdr.markForCheck();
    }
  }

  protected refresh(): void {
    if (!this.segment) return;
    this.refreshing = true;
    this.cdr.markForCheck();
    // The refresh response already contains memberIds — apply them directly.
    // We deliberately don't push a synthetic delta entry: when the refresh is
    // a no-op the server skips fan-out (so no WS event arrives, and an empty
    // log entry would be noise); when it's not a no-op, the WS event will
    // arrive on its own and a synthetic entry would duplicate it.
    this.api.refresh(this.segment.id).subscribe({
      next: (result: RefreshResult) => {
        this.refreshing = false;
        this.applyMemberList(result.memberIds);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.refreshing = false;
        this.error = `Refresh failed: ${err.message ?? err}`;
        this.cdr.markForCheck();
      },
    });
  }

  private applyMemberList(ids: string[]): void {
    const set = new Set(ids);
    this.memberCount = ids.length;
    this.memberRows = this.allCustomers.filter((c) => set.has(c.id));
  }

  protected idLabel(id: string): string {
    const c = this.allCustomers.find((x) => x.id === id);
    return c?.name ?? c?.email ?? id.slice(0, 8);
  }
}
