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

  constructor(private offlineSyncService: OfflineSyncService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // N'ajoute le header que si la requête est vers /ventes et qu'il n'est pas déjà présent
    // (le service offline-sync pose déjà son propre header lors de la synchronisation)
    if (this.isVenteRequest(request) && !request.headers.has('X-Client-Request-ID')) {
      request = request.clone({
        setHeaders: {
          'X-Client-Request-ID': this.offlineSyncService.generateClientRequestId()
        }
      });
    }
    return next.handle(request);
  }

  private isVenteRequest(request: HttpRequest<any>): boolean {
    return request.url.includes('/ventes') &&
           (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE');
  }
}
