import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, tap, switchMap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SessionService } from './session.service';
import type { FmLoginResponse, FmFindResponse, FmSingleResponse, FmCreateResponse, FmRecord } from '../models/fm.models';

@Injectable({ providedIn: 'root' })
export class FileMakerService {
  private get baseUrl(): string {
    // En producción se usa la URL completa. En dev el proxy de Angular
    // (proxy.conf.json) intercepta /fmi/ y lo reenvía a fmsuit.cat.
    if (environment.production) {
      return `${environment.fmHost}/fmi/data/${environment.fmVersion}/databases/${environment.fmDatabase}`;
    }
    return `/fmi/data/${environment.fmVersion}/databases/${environment.fmDatabase}`;
  }

  constructor(
    private http: HttpClient,
    private session: SessionService,
  ) {}

  login(username: string, password: string): Observable<string> {
    const url = `${this.baseUrl}/sessions`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + btoa(`${username}:${password}`),
    });
    return this.http.post<FmLoginResponse>(url, {}, { headers }).pipe(
      map(res => {
        const token = res.response?.token;
        if (!token) throw new Error('No token in response');
        return token;
      }),
      tap(token => {
        this.session.saveCredentials(username, password);
        this.session.setToken(token);
      }),
      catchError(err => {
        if (err?.status === 401 && err?.error?.messages?.[0]?.code === '212') return throwError(() => err);
        if (err?.status === 0) return throwError(() => err);
        return throwError(() => err);
      }),
    );
  }

  logout(): Observable<void> {
    const token = this.session.token;
    if (!token) {
      this.session.clear();
      return new Observable<void>(sub => {
        sub.next();
        sub.complete();
      });
    }
    const url = `${this.baseUrl}/sessions/${token}`;
    return this.http.delete<void>(url).pipe(
      tap({
        next: () => this.session.clear(),
        error: () => this.session.clear(),
      }),
      catchError(() => {
        this.session.clear();
        return new Observable<void>(sub => {
          sub.next();
          sub.complete();
        });
      }),
    );
  }

  reLogin(): Observable<string> {
    const creds = this.session.getCredentials();
    if (!creds) return throwError(() => new Error('No stored credentials'));
    return this.login(creds.username, creds.password);
  }

  listLayouts(): Observable<{ name: string; table?: string; isFolder?: boolean }[]> {
    const url = `${this.baseUrl}/layouts`;
    return this.http.get<{ response: { layouts: { name: string; table?: string; isFolder?: boolean }[] } }>(url).pipe(
      map(r => r.response.layouts),
    );
  }

  findRecords(layout: string, query: Record<string, unknown>[] = [], opts: { offset?: number; limit?: number; sort?: { fieldName: string; sortOrder: string }[] } = {}): Observable<FmFindResponse> {
    const url = `${this.baseUrl}/layouts/${encodeURIComponent(layout)}/_find`;
    const body: Record<string, unknown> = { query: query.length ? query : [{}] };
    if (opts.offset != null) body['offset'] = String(opts.offset);
    if (opts.limit != null) body['limit'] = String(opts.limit);
    if (opts.sort) body['sort'] = opts.sort;
    return this.http.post<FmFindResponse>(url, body);
  }

  listRecords(layout: string, opts: { offset?: number; limit?: number; sort?: { fieldName: string; sortOrder: string }[] } = {}): Observable<FmFindResponse> {
    const params: string[] = [];
    // FMS no acepta _offset=0; solo añadir si es > 0
    if (opts.offset != null && opts.offset > 0) params.push(`_offset=${opts.offset}`);
    if (opts.limit != null) params.push(`_limit=${opts.limit}`);
    if (opts.sort?.length) params.push(`_sort=${encodeURIComponent(JSON.stringify(opts.sort))}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    const url = `${this.baseUrl}/layouts/${encodeURIComponent(layout)}/records${qs}`;
    return this.http.get<FmFindResponse>(url);
  }

  getRecord(layout: string, recordId: string, opts: { portals?: { name: string; offset?: number; limit?: number }[] } = {}): Observable<FmSingleResponse> {
    const params: string[] = [];
    if (opts.portals) {
      for (const p of opts.portals) {
        if (p.offset != null) params.push(`_offset.${p.name}=${p.offset}`);
        if (p.limit != null) params.push(`_limit.${p.name}=${p.limit}`);
      }
    }
    const qs = params.length ? `?${params.join('&')}` : '';
    const url = `${this.baseUrl}/layouts/${encodeURIComponent(layout)}/records/${encodeURIComponent(recordId)}${qs}`;
    return this.http.get<FmSingleResponse>(url);
  }

  createRecord(layout: string, fieldData: Record<string, unknown>, opts: { portalData?: Record<string, unknown[]>; script?: string; scriptParam?: string } = {}): Observable<FmCreateResponse> {
    const url = `${this.baseUrl}/layouts/${encodeURIComponent(layout)}/records`;
    const body: Record<string, unknown> = { fieldData };
    if (opts.portalData) body['portalData'] = opts.portalData;
    if (opts.script) {
      const sp: string[] = [`script=${encodeURIComponent(opts.script)}`];
      if (opts.scriptParam) sp.push(`script.param=${encodeURIComponent(opts.scriptParam)}`);
      return this.http.post<FmCreateResponse>(`${url}?${sp.join('&')}`, body);
    }
    return this.http.post<FmCreateResponse>(url, body);
  }

  updateRecord(layout: string, recordId: string, fieldData: Record<string, unknown>, opts: { portalData?: Record<string, unknown[]>; modId?: string; script?: string; scriptParam?: string } = {}): Observable<unknown> {
    let url = `${this.baseUrl}/layouts/${encodeURIComponent(layout)}/records/${encodeURIComponent(recordId)}`;
    const qs: string[] = [];
    if (opts.script) {
      qs.push(`script=${encodeURIComponent(opts.script)}`);
      if (opts.scriptParam) qs.push(`script.param=${encodeURIComponent(opts.scriptParam)}`);
    }
    if (qs.length) url += `?${qs.join('&')}`;
    const body: Record<string, unknown> = { fieldData };
    if (opts.portalData) body['portalData'] = opts.portalData;
    if (opts.modId != null) (body as Record<string, unknown>)['modId'] = opts.modId;
    return this.http.patch(url, body);
  }

  deleteRecord(layout: string, recordId: string, opts: { script?: string; scriptParam?: string } = {}): Observable<unknown> {
    let url = `${this.baseUrl}/layouts/${encodeURIComponent(layout)}/records/${encodeURIComponent(recordId)}`;
    if (opts.script) {
      url += `?script=${encodeURIComponent(opts.script)}`;
      if (opts.scriptParam) url += `&script.param=${encodeURIComponent(opts.scriptParam)}`;
    }
    return this.http.delete(url);
  }

  executeScript(layout: string, script: string, scriptParam?: string): Observable<FmFindResponse> {
    const qs = scriptParam != null ? `?script=${encodeURIComponent(script)}&script.param=${encodeURIComponent(scriptParam)}` : `?script=${encodeURIComponent(script)}`;
    const url = `${this.baseUrl}/layouts/${encodeURIComponent(layout)}/records${qs}`;
    return this.http.get<FmFindResponse>(url);
  }

  ensureAuth<T>(request: () => Observable<T>): Observable<T> {
    return request().pipe(
      catchError(err => {
        const status = err?.status;
        const code = err?.error?.messages?.[0]?.code;
        if (status === 401 || code === '952' || code === '401') {
          return this.reLogin().pipe(switchMap(() => request()));
        }
        return throwError(() => err);
      }),
    );
  }
}
