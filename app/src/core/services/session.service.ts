import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly tokenKey = 'fedir_fm_token';
  private readonly credsKey = 'fedir_fm_creds';
  private token$ = new BehaviorSubject<string | null>(sessionStorage.getItem(this.tokenKey));

  get token(): string | null {
    return this.token$.value;
  }

  get tokenChanges(): Observable<string | null> {
    return this.token$.asObservable();
  }

  setToken(token: string | null): void {
    if (token) {
      sessionStorage.setItem(this.tokenKey, token);
    } else {
      sessionStorage.removeItem(this.tokenKey);
    }
    this.token$.next(token);
  }

  saveCredentials(username: string, password: string): void {
    sessionStorage.setItem(this.credsKey, btoa(`${username}:${password}`));
  }

  getCredentials(): { username: string; password: string } | null {
    const raw = sessionStorage.getItem(this.credsKey);
    if (!raw) return null;
    try {
      const decoded = atob(raw);
      const idx = decoded.indexOf(':');
      if (idx < 0) return null;
      return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
    } catch {
      return null;
    }
  }

  clear(): void {
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.credsKey);
    this.token$.next(null);
  }
}
