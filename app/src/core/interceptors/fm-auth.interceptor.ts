import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { SessionService } from '../services/session.service';
import { FileMakerService } from '../services/filemaker.service';

@Injectable()
export class FmAuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private session: SessionService,
    private fm: FileMakerService,
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isFmRequest(req)) return next.handle(req);
    if (req.url.includes('/sessions') && req.method === 'POST') return next.handle(req);

    const token = this.session.token;
    const authReq = token ? this.withToken(req, token) : req;

    return next.handle(authReq).pipe(
      catchError(err => {
        if (err instanceof HttpErrorResponse && this.isAuthError(err) && !this.isLoginRequest(req)) {
          return this.handle401(authReq, next);
        }
        return throwError(() => err);
      }),
    );
  }

  private isFmRequest(req: HttpRequest<unknown>): boolean {
    return req.url.includes('/fmi/data/');
  }

  private isLoginRequest(req: HttpRequest<unknown>): boolean {
    return req.url.includes('/sessions') && req.method === 'POST';
  }

  private isAuthError(err: HttpErrorResponse): boolean {
    const code = err.error?.messages?.[0]?.code;
    return err.status === 401 || code === '952' || code === '10' || code === '105';
  }

  private withToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
    return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  private handle401(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshSubject.next(null);
      const creds = this.session.getCredentials();
      if (!creds) {
        this.isRefreshing = false;
        return throwError(() => new Error('No stored credentials for re-auth'));
      }
      return this.fm.login(creds.username, creds.password).pipe(
        switchMap(token => {
          this.isRefreshing = false;
          this.refreshSubject.next(token);
          return next.handle(this.withToken(req, token));
        }),
        catchError(err => {
          this.isRefreshing = false;
          this.session.clear();
          return throwError(() => err);
        }),
      );
    }
    return this.refreshSubject.pipe(
      filter(t => t !== null),
      take(1),
      switchMap(token => next.handle(this.withToken(req, token!))),
    );
  }
}
