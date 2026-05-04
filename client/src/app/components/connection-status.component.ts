import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeltasService } from '../services/deltas.service';

@Component({
  selector: 'drift-connection-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <span class="pill" [class]="(state$ | async) ?? 'connecting'">
      <span class="dot"></span>
      {{ (state$ | async) ?? 'connecting' }}
    </span>
  `,
  styles: [
    `
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 12px;
        background: var(--bg-elev-2);
        color: var(--text-dim);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 600;
        border: 1px solid var(--border);
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--text-dim);
      }
      .pill.connected .dot { background: var(--added); box-shadow: 0 0 6px var(--added); }
      .pill.connecting .dot { background: var(--warn); animation: pulse 1.2s ease-in-out infinite; }
      .pill.disconnected .dot { background: var(--removed); }
      @keyframes pulse { 50% { opacity: 0.3; } }
    `,
  ],
})
export class ConnectionStatusComponent {
  private readonly deltas = inject(DeltasService);
  protected state$ = this.deltas.connectionState();
}
