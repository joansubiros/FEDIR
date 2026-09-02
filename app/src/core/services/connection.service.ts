import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ConnectionService {
  private online$ = new BehaviorSubject<boolean>(navigator.onLine);

  constructor() {
    window.addEventListener('online', () => this.online$.next(true));
    window.addEventListener('offline', () => this.online$.next(false));
  }

  get online(): boolean {
    return this.online$.value;
  }

  get onlineChanges(): Observable<boolean> {
    return this.online$.asObservable();
  }
}
