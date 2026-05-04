import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Segment } from '../models';
import { SegmentsService } from './segments.service';

/**
 * In-memory directory of segments so secondary surfaces (ticker, dependency
 * tooltips) can resolve IDs to names without re-fetching.
 */
@Injectable({ providedIn: 'root' })
export class SegmentsCacheService {
  private readonly api = inject(SegmentsService);
  private readonly subject = new BehaviorSubject<Segment[]>([]);
  private fetched = false;

  all$(): Observable<Segment[]> {
    if (!this.fetched) {
      this.refresh().subscribe();
    }
    return this.subject.asObservable();
  }

  refresh(): Observable<Segment[]> {
    return this.api.list().pipe(
      tap((segments) => {
        this.fetched = true;
        this.subject.next(segments);
      }),
    );
  }

  upsert(segment: Segment): void {
    const current = this.subject.value;
    const idx = current.findIndex((s) => s.id === segment.id);
    if (idx === -1) {
      this.subject.next([...current, segment]);
    } else {
      const next = current.slice();
      next[idx] = segment;
      this.subject.next(next);
    }
  }

  nameFor(id: string): string | null {
    return this.subject.value.find((s) => s.id === id)?.name ?? null;
  }
}
