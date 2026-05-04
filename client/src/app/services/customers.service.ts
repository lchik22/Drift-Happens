import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { Customer } from '../models';

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/customers`;
  private cache$: Observable<Customer[]> | null = null;

  list(): Observable<Customer[]> {
    if (!this.cache$) {
      this.cache$ = this.http.get<Customer[]>(this.base).pipe(shareReplay(1));
    }
    return this.cache$;
  }

  /** Drop the in-memory cache (e.g. after a profile change). */
  invalidate(): void {
    this.cache$ = null;
  }
}
