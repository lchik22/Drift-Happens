import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { SegmentDeltaEvent } from '../models';
import { DeltasService } from '../services/deltas.service';
import { SegmentsCacheService } from '../services/segments-cache.service';

interface TickerItem {
  event: SegmentDeltaEvent;
  segmentName: string;
  receivedAt: Date;
}

const MAX_ITEMS = 8;

@Component({
  selector: 'drift-live-delta-ticker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  template: `
    @if (items.length > 0) {
      <div class="ticker">
        <div class="ticker-header">
          <span>Live deltas</span>
          <button class="clear" (click)="clear()">clear</button>
        </div>
        @for (item of items; track item.receivedAt) {
          <a class="item"
             [routerLink]="['/segments', item.event.segmentId]"
             (click)="dismiss(item)">
            <span class="ts mono">{{ item.receivedAt | date: 'HH:mm:ss' }}</span>
            <span class="name">{{ item.segmentName }}</span>
            <span class="counts">
              @if (item.event.added.length > 0) {
                <span class="added">+{{ item.event.added.length }}</span>
              }
              @if (item.event.removed.length > 0) {
                <span class="removed">-{{ item.event.removed.length }}</span>
              }
            </span>
            @if ((item.event.cascadeDepth ?? 0) > 0) {
              <span class="depth">d{{ item.event.cascadeDepth }}</span>
            }
          </a>
        }
      </div>
    }
  `,
  styles: [
    `
      .ticker {
        position: fixed;
        right: 16px;
        bottom: 16px;
        width: 320px;
        background: var(--bg-elev);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 8px;
        z-index: 20;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      }
      .ticker-header {
        display: flex;
        align-items: center;
        font-size: 11px;
        color: var(--text-dim);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 4px 6px 8px;
      }
      .ticker-header span { flex: 1; font-weight: 600; }
      .clear {
        background: transparent;
        border: none;
        color: var(--text-dim);
        font-size: 11px;
        padding: 2px 6px;
      }
      .clear:hover { color: var(--text); background: transparent; }
      .item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 4px;
        text-decoration: none;
        color: var(--text);
        font-size: 12px;
      }
      .item:hover { background: var(--bg-elev-2); text-decoration: none; }
      .ts { color: var(--text-dim); font-size: 11px; }
      .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .counts { display: flex; gap: 6px; font-weight: 600; font-family: var(--mono); font-size: 12px; }
      .added { color: var(--added); }
      .removed { color: var(--removed); }
      .depth {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--warn);
        background: rgba(210, 153, 34, 0.15);
        padding: 1px 4px;
        border-radius: 2px;
      }
    `,
  ],
})
export class LiveDeltaTickerComponent {
  private readonly deltas = inject(DeltasService);
  private readonly cache = inject(SegmentsCacheService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected items: TickerItem[] = [];

  constructor() {
    this.deltas
      .all()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.append(event));

    this.cache
      .all$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshNames());
  }

  private append(event: SegmentDeltaEvent): void {
    if (event.added.length === 0 && event.removed.length === 0) return;
    const item: TickerItem = {
      event,
      segmentName: this.cache.nameFor(event.segmentId) ?? event.segmentId.slice(0, 8),
      receivedAt: new Date(),
    };
    this.items = [item, ...this.items].slice(0, MAX_ITEMS);
    this.cdr.markForCheck();
  }

  private refreshNames(): void {
    this.items = this.items.map((i) => ({
      ...i,
      segmentName: this.cache.nameFor(i.event.segmentId) ?? i.segmentName,
    }));
    this.cdr.markForCheck();
  }

  protected dismiss(item: TickerItem): void {
    this.items = this.items.filter((i) => i !== item);
    void this.router.navigate(['/segments', item.event.segmentId]);
  }

  protected clear(): void {
    this.items = [];
    this.cdr.markForCheck();
  }
}
