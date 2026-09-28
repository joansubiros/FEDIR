import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { finalize, scan, switchMap, tap } from 'rxjs/operators';
import { RutaService } from '../../core/services/ruta.service';
import type { RutaListItem } from '../../core/models/fm.models';

@Component({
  selector: 'app-rutas-list',
  templateUrl: './rutas-list.page.html',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RutasListPage {
  private page$ = new BehaviorSubject<number>(0);
  private limit = 50;
  items$: Observable<RutaListItem[]>;
  loading$ = new BehaviorSubject<boolean>(false);
  hasMore$ = new BehaviorSubject<boolean>(true);
  total = 0;

  today = new Date();
  private todayKey = this.formatDateKey(this.today);

  constructor(private rutas: RutaService) {
    this.items$ = this.page$.pipe(
      tap(() => this.loading$.next(true)),
      switchMap(page => this.rutas.list(this.limit, page * this.limit).pipe(finalize(() => this.loading$.next(false)))),
      tap(res => {
        this.total = res.total;
        this.hasMore$.next((this.page$.value + 1) * this.limit < res.total);
      }),
      scan((acc: RutaListItem[], cur) => (this.page$.value === 0 ? cur.items : [...acc, ...cur.items]), [] as RutaListItem[]),
    );
  }

  ionViewWillEnter(): void {
    this.page$.next(0);
  }

  onLoadMore(ev: CustomEvent): void {
    if (!this.hasMore$.value) {
      (ev.target as HTMLIonInfiniteScrollElement).complete();
      (ev.target as HTMLIonInfiniteScrollElement).disabled = true;
      return;
    }
    this.page$.next(this.page$.value + 1);
    setTimeout(() => (ev.target as HTMLIonInfiniteScrollElement).complete(), 600);
  }

  doRefresh(ev: CustomEvent): void {
    this.page$.next(0);
    setTimeout(() => (ev.target as HTMLIonRefresherElement).complete(), 600);
  }

  isToday(data: string): boolean {
    if (!data) return false;
    const d = new Date(data);
    if (!isNaN(d.getTime())) {
      return this.formatDateKey(d) === this.todayKey;
    }
    const parts = data.split(/[\/\-]/);
    if (parts.length === 3) {
      const d2 = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
      if (!isNaN(d2.getTime())) {
        return this.formatDateKey(d2) === this.todayKey;
      }
    }
    return false;
  }

  private formatDateKey(d: Date): string {
    if (!d || isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

