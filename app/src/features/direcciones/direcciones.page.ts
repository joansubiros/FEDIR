import { Component, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap, finalize, shareReplay, startWith, map, takeUntil, scan } from 'rxjs/operators';
import { DireccioService } from '../../core/services/ruta.service';
import type { DireccioItem } from '../../core/models/fm.models';

@Component({
  selector: 'app-direcciones',
  templateUrl: './direcciones.page.html',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DireccionesPage implements OnDestroy {
  private query$ = new BehaviorSubject<string>('');
  private page$ = new BehaviorSubject<number>(0);
  private destroy$ = new Subject<void>();
  private limit = 50;
  items$: Observable<DireccioItem[]>;
  loading$ = new BehaviorSubject<boolean>(false);
  hasMore$ = new BehaviorSubject<boolean>(true);
  searchText = '';

  constructor(private dir: DireccioService) {
    const debouncedQuery$ = this.query$.pipe(debounceTime(300), distinctUntilChanged());

    // When query or page changes, fetch data
    const fetch$ = combineLatest([debouncedQuery$, this.page$]).pipe(
      tap(() => this.loading$.next(true)),
      switchMap(([q, page]) => {
        const offset = page * this.limit;
        return (q
          ? this.dir.search(q, this.limit, offset)
          : this.dir.list(this.limit, offset)
        ).pipe(
          tap(res => this.hasMore$.next((page + 1) * this.limit < res.total)),
          map(res => ({ page, items: res.items })),
          finalize(() => this.loading$.next(false)),
        );
      }),
      // Reset accumulated list when page is 0 (new search), otherwise append
      scan((acc: { page: number; items: DireccioItem[] }[], cur: { page: number; items: DireccioItem[] }) => {
        if (cur.page === 0) return [cur];
        return [...acc, cur];
      }, [] as { page: number; items: DireccioItem[] }[]),
      map((pages: { page: number; items: DireccioItem[] }[]) => pages.flatMap(p => p.items)),
      shareReplay(1),
    );

    this.items$ = fetch$;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

