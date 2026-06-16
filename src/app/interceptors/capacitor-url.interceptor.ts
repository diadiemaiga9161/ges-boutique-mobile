import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BoutiqueConfigService } from '../services/boutique-config.service';
import { environment } from '../../environments/environment';

@Injectable()
export class CapacitorUrlInterceptor implements HttpInterceptor {
  constructor(private boutiqueConfig: BoutiqueConfigService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (environment.isCapacitor && request.url.startsWith('/')) {
      const baseUrl = this.boutiqueConfig.getApiBaseUrl();
      if (baseUrl) {
        const cloned = request.clone({ url: `${baseUrl}${request.url}` });
        return next.handle(cloned);
      }
    }
    return next.handle(request);
  }
}
