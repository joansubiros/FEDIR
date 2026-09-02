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
}

