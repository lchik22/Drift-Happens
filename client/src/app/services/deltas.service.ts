import { DestroyRef, Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, filter } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { SegmentDeltaEvent } from '../models';

const WS_NAMESPACE = '/deltas';
const WS_EVENT = 'segment.delta';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

@Injectable({ providedIn: 'root' })
export class DeltasService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly socket: Socket;
  private readonly deltas$ = new Subject<SegmentDeltaEvent>();
  private readonly connection$ = new BehaviorSubject<ConnectionState>('connecting');

  constructor() {
    // When wsUrl is '' (prod, same-origin via nginx), io() resolves to the
    // current origin and uses /socket.io as the transport path; the /deltas
    // suffix is the namespace selected at handshake time.
    const url = environment.wsUrl
      ? `${environment.wsUrl}${WS_NAMESPACE}`
      : WS_NAMESPACE;
    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
    });

    this.socket.on('connect', () => this.connection$.next('connected'));
    this.socket.on('disconnect', () => this.connection$.next('disconnected'));
    this.socket.on('connect_error', () => this.connection$.next('disconnected'));
    this.socket.on(WS_EVENT, (event: SegmentDeltaEvent) => this.deltas$.next(event));

    this.destroyRef.onDestroy(() => this.socket.disconnect());
  }

  /** All deltas across every segment. Server pre-joins clients to the `all` room. */
  all(): Observable<SegmentDeltaEvent> {
    return this.deltas$.asObservable();
  }

  /**
   * Filtered stream for one segment. The server emits every delta to both the
   * `all` room and the `segment:<id>` room — joining both would duplicate
   * every event, so we just filter the `all` stream client-side.
   */
  forSegment(segmentId: string): Observable<SegmentDeltaEvent> {
    return this.deltas$.pipe(filter((d) => d.segmentId === segmentId));
  }

  unsubscribe(_segmentId: string): void {
    // No-op: we never joined the per-segment room. Kept for call-site symmetry.
  }

  connectionState(): Observable<ConnectionState> {
    return this.connection$.asObservable();
  }
}
