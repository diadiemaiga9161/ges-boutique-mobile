import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.isPublicRoute(request.url)) {
      return next.handle(request);
    }

    const token = this.auth.getToken();

    // Anti-cache pour Android WebView : timestamp unique sur chaque GET
    const withCacheBust = request.method === 'GET'
      ? request.clone({ params: request.params.set('_t', Date.now().toString()) })
      : request;

    const cloned = token
      ? withCacheBust.clone({
          setHeaders: withCacheBust.body instanceof FormData
            ? { Authorization: `Bearer ${token}` }
            : { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        })
      : withCacheBust;

    return next.handle(cloned).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 || error.status === 403) {
          this.auth.signout();
          this.router.navigateByUrl('/login');
          return throwError(() => new Error('Session expirée. Veuillez vous reconnecter.'));
        }

        return throwError(() => error);
      })
    );
  }

  private isPublicRoute(url: string): boolean {
    return ['/api/auth/login', '/api/auth/register', '/swagger-ui', '/v3/api-docs']
      .some(route => url.includes(route));
  }
}
