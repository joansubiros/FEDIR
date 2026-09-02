import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged, scan, switchMap, tap, finalize, shareReplay } from 'rxjs/operators';
import { DireccioService } from '../../core/services/ruta.service';
import type { DireccioItem } from '../../core/models/fm.models';

@Component({
  selector: 'app-direcciones',
  templateUrl: './direcciones.page.html',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DireccionesPage {
  private query$ = new BehaviorSubject<string>('');
  private page$ = new BehaviorSubject<number>(0);
  private limit = 50;
  items$: Observable<DireccioItem[]>;
  loading$ = new BehaviorSubject<boolean>(false);
  hasMore$ = new BehaviorSubject<boolean>(true);
  searchText = '';

  constructor(private dir: DireccioService) {
    const debounced$ = this.query$.pipe(debounceTime(300), distinctUntilChanged());
    const trigger$ = combineLatest([debounced$, this.page$]);
    this.items$ = trigger$.pipe(
      tap(() => this.loading$.next(true)),
      switchMap(([q, page]) =>
        (q ? this.dir.search(q, this.limit, page * this.limit) : this.dir.list(this.limit, page * this.limit)).pipe(
          finalize(() => this.loading$.next(false)),
        ),
      ),
      tap(res => this.hasMore$.next((this.page$.value + 1) * this.limit < res.total)),
      scan((acc: DireccioItem[], cur) => (this.page$.value === 0 ? cur.items : [...acc, ...cur.items]), [] as DireccioItem[]),
      shareReplay(1),
    );
  }

  onSearch(ev: CustomEvent): void {
    this.searchText = (ev.detail.value as string) ?? '';
    this.page$.next(0);
    this.query$.next(this.searchText);
  }

  onLoadMore(ev: CustomEvent): void {
    if (!this.hasMore$.value) {
      (ev.target as HTMLIonInfiniteScrollElement).complete();
      (ev.target as HTMLIonInfiniteScrollElement).disabled = true;
      return;
    }
    this.page$.next(this.page$.value + 1);
    setTimeout(() => (ev.target as HTMLIonInfiniteScrollElement).complete(), 500);
  }
}

