import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { OfflineSyncService } from './offline-sync.service';

@Injectable()
export class ClientRequestIdInterceptor implements HttpInterceptor {
  private requestIdMap = new Map<string, string>();

  constructor(private offlineSyncService: OfflineSyncService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (this.isVenteRequest(request)) {
      let clientRequestId = this.getOrCreateRequestId(request);
      request = request.clone({
        setHeaders: {
          'X-Client-Request-ID': clientRequestId
        }
      });
    }

    return next.handle(request);
  }

  private isVenteRequest(request: HttpRequest<any>): boolean {
    return request.url.includes('/ventes') &&
           (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE');
  }

  private getOrCreateRequestId(request: HttpRequest<any>): string {
    const key = `${request.method}-${request.url}`;
    if (!this.requestIdMap.has(key)) {
      this.requestIdMap.set(key, this.offlineSyncService.generateClientRequestId());
    }
    return this.requestIdMap.get(key)!;
  }
}
