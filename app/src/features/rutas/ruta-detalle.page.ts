import { ChangeDetectorRef, Component, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, BehaviorSubject, Subject, combineLatest, of, switchMap, tap, map, startWith, shareReplay, catchError } from 'rxjs';
import { DireccioService, LrutaService, RutaService } from '../../core/services/ruta.service';
import { SessionService } from '../../core/services/session.service';
import type { DireccioItem, RutaDetalle, RutaParadaPortal } from '../../core/models/fm.models';

@Component({
  selector: 'app-ruta-detalle',
  templateUrl: './ruta-detalle.page.html',
  styleUrls: ['./ruta-detalle.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RutaDetallePage {
  ruta$: Observable<RutaDetalle | null>;
  ruta: RutaDetalle | null = null;
  loading$ = new BehaviorSubject<boolean>(true);
  addressResults$ = new BehaviorSubject<DireccioItem[]>([]);
  showInfo = false;
  showAddPoint = false;
  addressQuery = '';
  savingOrder = false;
  error: string | null = null;
  routeSerialParam = 0;
  private refresh$ = new Subject<void>();

  get canReorderPoints(): boolean {
    const username = this.session.getCredentials()?.username?.toLowerCase();
    return username === 'fbellota' || username === 'grodriguez' || username === 'jsubiros';
  }

  canAddPoint(ruta: RutaDetalle | null): boolean {
    const username = this.session.getCredentials()?.username?.toLowerCase();
    if (username === 'jsubiros') return true;
    if (username !== 'fbellota' && username !== 'grodriguez') return false;
    const routeDate = this.parseRouteDate(ruta?.fieldData.Data);
    if (!routeDate) return false;
    const limit = new Date(routeDate);
    limit.setDate(limit.getDate() + 7);
    return new Date() < limit;
  }

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private rutas: RutaService,
    private lruta: LrutaService,
    private direcciones: DireccioService,
    private session: SessionService,
    private changeDetector: ChangeDetectorRef,
  ) {
    this.ruta$ = combineLatest([this.route.paramMap, this.route.queryParamMap, this.refresh$.pipe(startWith(undefined))]).pipe(
      switchMap(([pm, qm]) => {
        this.loading$.next(true);
        this.error = null;
        const serial = Number(qm.get('serial'));
        this.routeSerialParam = Number.isFinite(serial) && serial > 0 ? serial : 0;
        return this.rutas.getDetalle(pm.get('id')!, Number.isFinite(serial) && serial > 0 ? serial : undefined);
      }),
      map(ruta => ({ ...ruta, portalParadas: [...ruta.portalParadas].sort((a, b) => a.idLRutaSerial - b.idLRutaSerial) })),
      tap(() => {
        this.loading$.next(false);
        this.changeDetector.markForCheck();
      }),
      catchError(err => {
        this.loading$.next(false);
        this.error = err?.error?.messages?.[0]?.message ?? err?.message ?? 'No se pudo cargar la ruta';
        this.changeDetector.markForCheck();
        return of(null as RutaDetalle | null);
      }),
      shareReplay(1),
    );
    this.ruta$.subscribe(ruta => {
      this.ruta = ruta;
      this.changeDetector.detectChanges();
    });
  }

  routeSerial(ruta: RutaDetalle | null): number {
    return ruta?.fieldData.Id_Ruta_serial || this.routeSerialParam;
  }

  hasClient(point: RutaParadaPortal): boolean {
    return Boolean(point.idClient || point.idClientPrint || point.nomEmpresa);
  }

  ionViewWillEnter(): void {
    this.loading$.next(true);
    this.changeDetector.markForCheck();
  }

  openMaps(nom: string): void {
    const q = encodeURIComponent(nom);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  }

  openNavigation(point: RutaParadaPortal, app: 'waze' | 'maps'): void {
    const destination = point.latitud != null && point.longitud != null
      ? `${point.latitud},${point.longitud}`
      : encodeURIComponent(point.nomDireccio);
    const open = (origin?: GeolocationPosition) => {
      const from = origin ? `&origin=${origin.coords.latitude},${origin.coords.longitude}` : '';
      const url = app === 'waze'
        ? `https://waze.com/ul?ll=${destination}&navigate=yes`
        : `https://www.google.com/maps/dir/?api=1${from}&destination=${destination}&travelmode=driving`;
      window.open(url, '_blank');
    };
    if (!navigator.geolocation) {
      open();
      return;
    }
    navigator.geolocation.getCurrentPosition(position => open(position), () => open(), { enableHighAccuracy: true, timeout: 5000 });
  }

  nextPending(points: RutaParadaPortal[]): RutaParadaPortal | undefined {
    return points.find(point => point.flagFet !== '1' && point.flagAnulat !== '1');
  }

  movePoint(points: RutaParadaPortal[], index: number, direction: -1 | 1): void {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= points.length || this.savingOrder) return;
    const current = points[index];
    const other = points[otherIndex];
    const currentSerial = current.idLRutaSerial || index + 1;
    const otherSerial = other.idLRutaSerial || otherIndex + 1;
    this.savingOrder = true;
    this.error = null;
    this.lruta.swapOrder(
      { recordId: current.recordId, serial: currentSerial, modId: current.modId },
      { recordId: other.recordId, serial: otherSerial, modId: other.modId },
    ).subscribe({
      next: () => {
        current.idLRutaSerial = otherSerial;
        other.idLRutaSerial = currentSerial;
        points.splice(index, 1);
        points.splice(otherIndex, 0, current);
        this.savingOrder = false;
        this.changeDetector.detectChanges();
        this.refresh$.next();
      },
      error: err => {
        this.savingOrder = false;
        this.error = err?.error?.messages?.[0]?.message ?? err?.message ?? 'No se pudo cambiar el orden';
        this.changeDetector.detectChanges();
      },
    });
  }

  handleMove(event: Event, points: RutaParadaPortal[], index: number, direction: -1 | 1): void {
    event.preventDefault();
    event.stopPropagation();
    this.movePoint(points, index, direction);
  }

  openPoint(event: Event, recordId: string, ruta: RutaDetalle): void {
    event.preventDefault();
    event.stopPropagation();
    const serial = this.route.snapshot.queryParamMap.get('serial');
    this.router.navigate(['/paradas', recordId], {
      queryParams: { routeId: ruta.recordId, serial: serial || ruta.fieldData.Id_Ruta_serial },
    });
  }

  openPesaje(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    void this.router.navigate(['/pesajes', 'nuevo']);
  }

  searchPoints(event: CustomEvent): void {
    this.addressQuery = String(event.detail?.value ?? '').trim();
    this.direcciones.search(this.addressQuery, 30, 0).pipe(
      map(result => result.items),
      catchError(() => of([])),
    ).subscribe(items => this.addressResults$.next(items));
  }

  openAddPoint(ruta: RutaDetalle): void {
    if (!this.canAddPoint(ruta)) {
      this.error = 'No tiene permiso para añadir puntos a esta ruta';
      return;
    }
    this.showAddPoint = true;
    this.addressQuery = '';
    this.direcciones.list(30, 0).pipe(catchError(() => of({ items: [], total: 0 }))).subscribe(result => this.addressResults$.next(result.items));
  }

  addPoint(point: DireccioItem, ruta: RutaDetalle): void {
    if (!this.canAddPoint(ruta)) {
      this.error = 'No tiene permiso para añadir puntos a esta ruta';
      return;
    }
    if (!ruta.fieldData.Id_Ruta) {
      this.error = 'La ruta no contiene su identificador interno';
      return;
    }
    this.lruta.addPoint(ruta.fieldData.Id_Ruta, point.idDireccio || point.recordId).subscribe({
      next: () => {
        this.showAddPoint = false;
        this.refresh$.next();
      },
      error: (err: any) => (this.error = err?.error?.messages?.[0]?.message ?? err?.message ?? 'No se pudo añadir el punto'),
    });
  }

  callTel(tel: string): void {
    if (tel) window.open(`tel:${tel}`, '_self');
  }

  private parseRouteDate(value: string | undefined): Date | null {
    if (!value) return null;
    const parts = value.trim().split(/[\/-]/).map(Number);
    if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return null;
    let year: number;
    let month: number;
    let day: number;
    if (value.includes('-') && value.split('-')[0].length !== 4) {
      [day, month, year] = parts;
    } else if (parts[0] > 31) {
      [year, month, day] = parts;
    } else {
      [month, day, year] = parts;
    }
    if (year < 100) year += 2000;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }
}

