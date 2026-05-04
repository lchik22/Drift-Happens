import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ConnectionStatusComponent } from './components/connection-status.component';
import { LiveDeltaTickerComponent } from './components/live-delta-ticker.component';

@Component({
  selector: 'drift-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ConnectionStatusComponent,
    LiveDeltaTickerComponent,
  ],
  template: `
    <header class="app-header">
      <div class="brand">
        <span class="logo">⟁</span>
        <span class="name">Drift Happens</span>
      </div>
      <nav class="nav">
        <a routerLink="/segments" routerLinkActive="active">Segments</a>
        <a routerLink="/simulate" routerLinkActive="active">Simulate</a>
      </nav>
      <div class="spacer"></div>
      <drift-connection-status></drift-connection-status>
    </header>

    <main class="app-main">
      <router-outlet></router-outlet>
    </main>

    <drift-live-delta-ticker></drift-live-delta-ticker>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }
      .app-header {
        display: flex;
        align-items: center;
        gap: 24px;
        padding: 12px 24px;
        background: var(--bg-elev);
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 10;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }
      .logo {
        color: var(--accent);
        font-size: 20px;
      }
      .nav {
        display: flex;
        gap: 4px;
      }
      .nav a {
        padding: 6px 12px;
        border-radius: 4px;
        color: var(--text-dim);
      }
      .nav a:hover {
        color: var(--text);
        background: var(--bg-elev-2);
        text-decoration: none;
      }
      .nav a.active {
        color: var(--text);
        background: var(--accent-dim);
      }
      .spacer { flex: 1; }
      .app-main {
        padding: 24px;
        max-width: 1280px;
        width: 100%;
        margin: 0 auto;
        flex: 1;
      }
    `,
  ],
})
export class AppComponent {}
