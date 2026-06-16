import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

interface CacheEntry { response: HttpResponse<unknown>; expiresAt: number; }

const TTL_MS = 5 * 60 * 1000;
const SKIP_PATTERNS = ['/auth/', '/notifications', '/ws', '/caisse', '/vente'];

@Injectable()
export class CacheInterceptor implements HttpInterceptor {
  private cache = new Map<string, CacheEntry>();

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (req.method !== 'GET') return next.handle(req);
    if (SKIP_PATTERNS.some(p => req.url.includes(p))) return next.handle(req);

    const cached = this.cache.get(req.urlWithParams);
    if (cached && Date.now() < cached.expiresAt) {
      return of(cached.response.clone());
    }

    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse && event.status === 200) {
          this.cache.set(req.urlWithParams, {
            response: event.clone(),
            expiresAt: Date.now() + TTL_MS
          });
        }
      })
    );
  }

  invalidate(pattern?: string): void {
    if (!pattern) { this.cache.clear(); return; }
    this.cache.forEach((_, key) => { if (key.includes(pattern)) this.cache.delete(key); });
  }
}
