import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  SimulateAdvanceTimeDto,
  SimulateAdvanceTimeResponse,
  SimulateBulkTransactionsDto,
  SimulateBulkTransactionsResponse,
  SimulateChangeDto,
  SimulateProfileDto,
  SimulateTransactionDto,
  SimulateTransactionResponse,
} from '../models';

@Injectable({ providedIn: 'root' })
export class SimulationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/simulate`;

  transaction(dto: SimulateTransactionDto): Observable<SimulateTransactionResponse> {
    return this.http.post<SimulateTransactionResponse>(`${this.base}/transaction`, dto);
  }

  profile(dto: SimulateProfileDto): Observable<unknown> {
    return this.http.post(`${this.base}/profile`, dto);
  }

  advanceTime(dto: SimulateAdvanceTimeDto): Observable<SimulateAdvanceTimeResponse> {
    return this.http.post<SimulateAdvanceTimeResponse>(`${this.base}/advance-time`, dto);
  }

  bulkTransactions(
    dto: SimulateBulkTransactionsDto,
  ): Observable<SimulateBulkTransactionsResponse> {
    return this.http.post<SimulateBulkTransactionsResponse>(
      `${this.base}/bulk-transactions`,
      dto,
    );
  }

  /** Bypass the data-write path; useful for poking the worker directly. */
  rawChange(dto: SimulateChangeDto): Observable<{ published: true }> {
    return this.http.post<{ published: true }>(`${this.base}/change`, dto);
  }
}
