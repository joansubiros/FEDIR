import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { FileMakerService } from './filemaker.service';
import { WriteQueueService, QueuedWrite } from './write-queue.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WriteQueueSyncService {
  private syncing$ = new BehaviorSubject<boolean>(false);
  private pending$ = new BehaviorSubject<number>(0);
  private sub: Subscription | null = null;

  syncingChanges: Observable<boolean> = this.syncing$.asObservable();
  pendingChanges: Observable<number> = this.pending$.asObservable();

  constructor(
    private queue: WriteQueueService,
    private fm: FileMakerService,
  ) {}

  start(intervalMs = 15000): void {
    this.stop();
    this.refreshPending();
    this.sub = interval(intervalMs)
      .pipe(switchMap(() => this.drainOnce().catch(() => 0)))
      .subscribe();
    window.addEventListener('online', this.onOnline);
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = null;
    window.removeEventListener('online', this.onOnline);
  }

  private onOnline = (): void => {
    this.drainOnce().catch(() => {});
  };

  async drainOnce(): Promise<number> {
    if (!navigator.onLine) return 0;
    if (this.syncing$.value) return 0;
    this.syncing$.next(true);
    let drained = 0;
    try {
      const items = await this.queue.list();
      for (const item of items) {
        if (item.id == null) continue;
        try {
          await this.execute(item);
          await this.queue.remove(item.id);
          drained++;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          await this.queue.update(item.id, { attempts: (item.attempts ?? 0) + 1, lastError: msg });
          break;
        }
      }
    } finally {
      this.syncing$.next(false);
      await this.refreshPending();
    }
    return drained;
  }

  private execute(item: QueuedWrite): Promise<unknown> {
    const db = item.database || environment.fmDatabase;
    const urlBase = `${environment.fmHost}/fmi/data/${environment.fmVersion}/databases/${db}/layouts/${encodeURIComponent(item.layout)}`;
    if (item.kind === 'create') {
      return this.fm.createRecord(item.layout, item.fieldData ?? {}).toPromise();
    }
    if (item.kind === 'update' && item.recordId) {
      return this.fm.updateRecord(item.layout, item.recordId, item.fieldData ?? {}).toPromise();
    }
    if (item.kind === 'delete' && item.recordId) {
      return this.fm.deleteRecord(item.layout, item.recordId).toPromise();
    }
    return Promise.reject(new Error('Invalid queued write'));
  }

  private async refreshPending(): Promise<void> {
    const n = await this.queue.count();
    this.pending$.next(n);
  }
}
