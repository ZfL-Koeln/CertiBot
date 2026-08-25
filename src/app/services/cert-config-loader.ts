import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CERTCONFIG } from '../certificates/cert-config';

@Injectable({ providedIn: 'root' })
export class CertConfigLoader {
  private readonly http = inject(HttpClient);

  load(id: string): Observable<CERTCONFIG | null> {
    return this.http.get<CERTCONFIG>(`config/${id}.json`).pipe(
      catchError(() => of(null))
    );
  }
}
