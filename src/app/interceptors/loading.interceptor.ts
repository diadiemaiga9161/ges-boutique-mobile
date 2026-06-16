import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';

const SKIP_PATTERNS = ['/ws', '/notifications/count', '/notifications/non-lues'];

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  constructor(private loadingService: LoadingService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (SKIP_PATTERNS.some(p => req.url.includes(p))) return next.handle(req);

    this.loadingService.start();
    return next.handle(req).pipe(
      finalize(() => this.loadingService.stop())
    );
  }
}
