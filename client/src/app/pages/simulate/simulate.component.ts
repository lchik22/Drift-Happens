import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Customer } from '../../models';
import { CustomersService } from '../../services/customers.service';
import { SimulationService } from '../../services/simulation.service';

interface LogLine {
  level: 'ok' | 'err';
  message: string;
  at: Date;
}

@Component({
  selector: 'drift-simulate',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="page-header">
      <h1>Simulate</h1>
      <p class="muted">
        Trigger the data changes that drive segment re-evaluation. Watch deltas
        appear in the bottom-right ticker and on individual segment pages.
      </p>
    </header>

    <div class="grid panels">
      <section class="card">
        <h2>Add transaction</h2>
        <p class="muted small">
          Inserts a transaction, updates the customer's balance / tx_count /
          last_tx_at, and emits a <code>customer.changed</code> event.
        </p>
        <label for="tx-customer">Customer</label>
        <select id="tx-customer" [(ngModel)]="txCustomerId">
          @for (c of customers; track c.id) {
            <option [value]="c.id">{{ c.name }} ({{ c.email }})</option>
          }
        </select>
        <label for="tx-amount">Amount</label>
        <input id="tx-amount" type="number" min="0.01" step="0.01" [(ngModel)]="txAmount" />
        <button class="primary" (click)="addTransaction()" [disabled]="!txCustomerId || busy">
          Insert transaction
        </button>
      </section>

      <section class="card">
        <h2>Update profile</h2>
        <p class="muted small">
          Patches one or more JSON profile fields, e.g.
          <code>{{ '{' }} "tier": "platinum" {{ '}' }}</code>.
        </p>
        <label for="profile-customer">Customer</label>
        <select id="profile-customer" [(ngModel)]="profileCustomerId">
          @for (c of customers; track c.id) {
            <option [value]="c.id">{{ c.name }} ({{ c.email }})</option>
          }
        </select>
        <label for="profile-patch">Patch (JSON)</label>
        <textarea id="profile-patch" rows="4" [(ngModel)]="profilePatch"></textarea>
        <button class="primary" (click)="updateProfile()"
                [disabled]="!profileCustomerId || busy">
          Apply patch
        </button>
      </section>

      <section class="card">
        <h2>Advance time</h2>
        <p class="muted small">
          Shifts every transaction's <code>occurred_at</code> backward by N
          days and emits a <code>time_tick</code> event per affected customer.
          Useful for aging customers out of date-window segments.
        </p>
        <label for="adv-days">Days</label>
        <input id="adv-days" type="number" min="1" max="365" [(ngModel)]="advanceDays" />
        <button class="primary" (click)="advanceTime()" [disabled]="busy">
          Advance time
        </button>
      </section>

      <section class="card">
        <h2>Bulk transactions</h2>
        <p class="muted small">
          Inserts <code>count</code> transactions across all customers, in 1k
          chunks server-side. Test debouncing and chunked processing — try 50,000.
        </p>
        <label for="bulk-count">Count</label>
        <input id="bulk-count" type="number" min="1" max="100000" [(ngModel)]="bulkCount" />
        <div class="row">
          <div style="flex:1">
            <label for="bulk-min">Min amount</label>
            <input id="bulk-min" type="number" min="0.01" step="0.01" [(ngModel)]="bulkMin" />
          </div>
          <div style="flex:1">
            <label for="bulk-max">Max amount</label>
            <input id="bulk-max" type="number" min="0.01" step="0.01" [(ngModel)]="bulkMax" />
          </div>
        </div>
        <button class="primary" (click)="bulkTransactions()" [disabled]="busy">
          Run bulk insert
        </button>
      </section>
    </div>

    <section class="card log">
      <header class="card-head">
        <h2>Activity</h2>
        <button class="ghost" (click)="clearLog()">clear</button>
      </header>
      @if (log.length === 0) {
        <p class="muted small">Run a simulation to see results here.</p>
      }
      @for (entry of log; track entry.at) {
        <div class="entry" [class.ok]="entry.level === 'ok'" [class.err]="entry.level === 'err'">
          <span class="ts mono">{{ entry.at | date: 'HH:mm:ss' }}</span>
          <span class="msg">{{ entry.message }}</span>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .page-header { margin-bottom: 24px; }
      .page-header h1 { margin: 0 0 4px; font-size: 24px; }
      .panels {
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      }
      .panels h2 {
        margin: 0 0 8px;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-dim);
      }
      .small { font-size: 12px; }
      .panels .card > * + * { margin-top: 8px; }
      .panels label { margin-top: 12px; }
      .panels button { margin-top: 16px; align-self: flex-start; }
      .log { margin-top: 24px; }
      .card-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .card-head h2 {
        margin: 0;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-dim);
      }
      .ghost {
        background: transparent;
        border: none;
        color: var(--text-dim);
        font-size: 12px;
        padding: 2px 6px;
      }
      .ghost:hover { color: var(--text); background: transparent; }
      .entry {
        display: flex;
        gap: 12px;
        padding: 6px 8px;
        border-radius: 4px;
        font-size: 13px;
        border-left: 2px solid var(--border);
      }
      .entry.ok { border-left-color: var(--added); }
      .entry.err { border-left-color: var(--removed); color: var(--removed); }
      .ts { color: var(--text-dim); }
      code {
        background: var(--bg);
        padding: 1px 4px;
        border-radius: 2px;
      }
    `,
  ],
})
export class SimulateComponent {
  private readonly customersApi = inject(CustomersService);
  private readonly sim = inject(SimulationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  protected customers: Customer[] = [];
  protected busy = false;
  protected log: LogLine[] = [];

  protected txCustomerId = '';
  protected txAmount = 100;

  protected profileCustomerId = '';
  protected profilePatch = '{ "tier": "platinum" }';

  protected advanceDays = 35;

  protected bulkCount = 5000;
  protected bulkMin = 1;
  protected bulkMax = 100;

  constructor() {
    this.customersApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (custs) => {
          this.customers = custs;
          if (custs.length > 0) {
            this.txCustomerId = custs[0].id;
            this.profileCustomerId = custs[0].id;
          }
          this.cdr.markForCheck();
        },
        error: (err) => this.appendLog('err', `Customer list failed: ${err.message ?? err}`),
      });
  }

  protected addTransaction(): void {
    this.run('transaction', () =>
      this.sim
        .transaction({ customerId: this.txCustomerId, amount: Number(this.txAmount) })
        .subscribe({
          next: (res) =>
            this.appendLog(
              'ok',
              `tx ${res.transaction.id.slice(0, 8)} for ${res.customer.id.slice(0, 8)}: ` +
                `+${res.transaction.amount} → balance ${res.customer.balance}, txCount ${res.customer.txCount}`,
            ),
          error: (err) => this.appendLog('err', `transaction failed: ${this.errMsg(err)}`),
          complete: () => this.endRun(),
        }),
    );
  }

  protected updateProfile(): void {
    let patch: Record<string, unknown>;
    try {
      patch = JSON.parse(this.profilePatch);
    } catch (e) {
      this.appendLog('err', `Invalid JSON in patch: ${(e as Error).message}`);
      return;
    }
    this.run('profile', () =>
      this.sim.profile({ customerId: this.profileCustomerId, patch }).subscribe({
        next: () => {
          this.customersApi.invalidate();
          this.appendLog(
            'ok',
            `profile patched for ${this.profileCustomerId.slice(0, 8)}: ${Object.keys(patch).join(', ')}`,
          );
        },
        error: (err) => this.appendLog('err', `profile patch failed: ${this.errMsg(err)}`),
        complete: () => this.endRun(),
      }),
    );
  }

  protected advanceTime(): void {
    this.run('advance-time', () =>
      this.sim.advanceTime({ days: Number(this.advanceDays) }).subscribe({
        next: (res) =>
          this.appendLog(
            'ok',
            `advanced ${res.days}d: ${res.transactionsShifted} tx shifted, ` +
              `${res.customersAffected} customers re-enqueued`,
          ),
        error: (err) => this.appendLog('err', `advance-time failed: ${this.errMsg(err)}`),
        complete: () => this.endRun(),
      }),
    );
  }

  protected bulkTransactions(): void {
    this.run('bulk-transactions', () =>
      this.sim
        .bulkTransactions({
          count: Number(this.bulkCount),
          minAmount: Number(this.bulkMin),
          maxAmount: Number(this.bulkMax),
        })
        .subscribe({
          next: (res) =>
            this.appendLog(
              'ok',
              `bulk: inserted ${res.inserted} tx in ${res.chunks} chunk(s) ` +
                `across ${res.customersAffected} customers`,
            ),
          error: (err) => this.appendLog('err', `bulk-transactions failed: ${this.errMsg(err)}`),
          complete: () => this.endRun(),
        }),
    );
  }

  protected clearLog(): void {
    this.log = [];
    this.cdr.markForCheck();
  }

  private run(label: string, fn: () => void): void {
    this.busy = true;
    this.appendLog('ok', `→ ${label} dispatched`);
    fn();
  }

  private endRun(): void {
    this.busy = false;
    this.cdr.markForCheck();
  }

  private appendLog(level: LogLine['level'], message: string): void {
    this.log = [{ level, message, at: new Date() }, ...this.log].slice(0, 50);
    this.cdr.markForCheck();
  }

  private errMsg(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const e = (err as { error: { message?: string | string[] } }).error;
      const m = e?.message;
      if (Array.isArray(m)) return m.join('; ');
      if (typeof m === 'string') return m;
    }
    return (err as Error).message ?? String(err);
  }
}
