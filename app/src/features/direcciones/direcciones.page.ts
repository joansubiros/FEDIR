import { Component, ChangeDetectionStrategy, OnDestroy, OnInit, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, combineLatest, of } from 'rxjs';
import { distinctUntilChanged, switchMap, tap, finalize, shareReplay, map, takeUntil, scan, catchError } from 'rxjs/operators';
import { DireccioService } from '../../core/services/ruta.service';
import { SessionService } from '../../core/services/session.service';
import type { DireccioItem } from '../../core/models/fm.models';

@Component({
  selector: 'app-direcciones',
  templateUrl: './direcciones.page.html',
  styleUrls: ['./direcciones.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DireccionesPage implements OnInit, OnDestroy {
  private dir = inject(DireccioService);
  private session = inject(SessionService);

  private query$ = new BehaviorSubject<string>('');
  private page$ = new BehaviorSubject<number>(0);
  private destroy$ = new Subject<void>();
  private limit = 50;
  items$: Observable<DireccioItem[]>;
  loading$ = new BehaviorSubject<boolean>(false);
  hasMore$ = new BehaviorSubject<boolean>(true);
  searchText = '';

  // Conductores activos (Flag_Actiu=1 y Flag_Xofer=1) cargados de la tabla PERSONAL
  driversList: { id: string; name: string }[] = [];

  get canEdit(): boolean {
    return this.dir.isAllAccessUser();
  }

  constructor() {
    const debouncedQuery$ = this.query$.pipe(distinctUntilChanged());

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
          catchError(err => {
            console.error('Error fetching direcciones:', err);
            return of({ page, items: [] });
          }),
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

  ngOnInit(): void {
    this.dir.getDriversList().pipe(takeUntil(this.destroy$)).subscribe({
      next: list => {
        this.driversList = list;
      },
      error: err => {
        console.error('Error cargando conductores:', err);
        this.driversList = [];
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(ev: CustomEvent): void {
    this.searchText = ((ev.detail.value as string) ?? '').trim();
    // Al cambiar la búsqueda la lista se reinicia. Si la página ya es 0, el cambio de
    // query dispara la carga; si no, volver a la página 0 la dispara (evita doble petición).
    this.query$.next(this.searchText);
    if (this.page$.value !== 0) this.page$.next(0);
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

  formatAddress(d: DireccioItem): string {
    const parts: string[] = [];
    // Evitar que el nombre del local (Nom_Direccio) aparezca como dirección
    // (getFieldStr puede devolver Nom_Direccio si el campo Direccio está vacío)
    if (d.direccio && d.direccio !== d.nomDireccio) parts.push(d.direccio);
    if (d.poblacio) parts.push(d.poblacio);
    // No mostrar provincia si es CABA (la ciudad es suficiente)
    if (d.provincia && d.provincia.toLowerCase() !== 'caba' && d.provincia !== d.poblacio) parts.push(`(${d.provincia})`);
    if (d.barri && !parts.includes(d.barri)) parts.push(`[${d.barri}]`);
    return parts.length ? parts.join(' — ') : (d.etiquetaDireccio || 'Sin dirección especificada');
  }

  updateDriver(direccio: DireccioItem, event: CustomEvent): void {
    if (!this.canEdit) return;
    const newXoferId = (event.detail.value as string) || '';
    this.dir.updateXofer(direccio.recordId, newXoferId, direccio.modId).subscribe({
      next: () => {
        direccio.idXofer = newXoferId;
        const matched = this.driversList.find(d => d.id.toLowerCase() === newXoferId.toLowerCase());
        direccio.nomXofer = matched?.name ?? '';
      },
      error: err => console.error('Error updating driver:', err)
    });
  }

  openInMaps(d: DireccioItem): void {
    let search = this.formatAddress(d);
    if (!search || search === 'Sin dirección especificada') {
      search = d.nomDireccio || '';
    }
    if (!search) return;
    const label = d.nomDireccio ? `!('${encodeURIComponent(d.nomDireccio)}')` : '';
    window.open(`https://maps.google.com/maps?q=${encodeURIComponent(search)}${label}`, '_blank');
  }

  callPhone(phone: string): void {
    window.location.href = `tel:${phone}`;
  }

  openWhatsApp(phone: string): void {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) return;
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  }
}

