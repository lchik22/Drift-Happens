import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateSegmentDto, RefreshResult, Segment } from '../models';

@Injectable({ providedIn: 'root' })
export class SegmentsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/segments`;

  list(): Observable<Segment[]> {
    return this.http.get<Segment[]>(this.base);
  }

  get(id: string): Observable<Segment> {
    return this.http.get<Segment>(`${this.base}/${id}`);
  }

  create(dto: CreateSegmentDto): Observable<Segment> {
    return this.http.post<Segment>(this.base, dto);
  }

  refresh(id: string): Observable<RefreshResult> {
    return this.http.post<RefreshResult>(`${this.base}/${id}/refresh`, {});
  }
}
