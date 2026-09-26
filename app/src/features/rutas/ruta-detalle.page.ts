import { ChangeDetectorRef, Component, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, BehaviorSubject, Subject, combineLatest, of, switchMap, tap, map, startWith, shareReplay, catchError, forkJoin } from 'rxjs';
import { DireccioService, LrutaService, RutaService, resolvePersonalName } from '../../core/services/ruta.service';
import { SessionService } from '../../core/services/session.service';
import { FileMakerService } from '../../core/services/filemaker.service';
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
  savingInfo = false;
  error: string | null = null;
  routeSerialParam = 0;
  editData = '';
  private refresh$ = new Subject<void>();

  // Datos para desplegables del popover de info
  personalList: { id: string; name: string }[] = [];
  vehiclesList: { id: string; matricula: string }[] = [];

  get canReorderPoints(): boolean {
    const username = this.session.getCredentials()?.username?.toLowerCase();
    return username === 'fbellota' || username === 'grodriguez' || username === 'jsubiros';
  }

  get canEditRoute(): boolean {
    const username = this.session.getCredentials()?.username?.toLowerCase();
    return username === 'fbellota' || username === 'grodriguez' || username === 'jsubiros';
  }

  canEditRouteInfo(ruta: RutaDetalle | null): boolean {
    if (!this.canEditRoute) return false;
    if (!ruta) return false;
    // La ruta es editable si no está finalizada (Estat != 'Finalizada' o similar)
    const estat = String(ruta.fieldData.Estat || '').toLowerCase();
    const finalizada = estat.includes('final') || estat.includes('complet') || estat.includes('tancat');
    return !finalizada;
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

  loadListsForModal(): void {
    this.loadPersonalList();
    this.loadVehiclesList();
  }

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private rutas: RutaService,
    private lruta: LrutaService,
    private direcciones: DireccioService,
    private session: SessionService,
    private fm: FileMakerService,
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
      if (ruta) {
        this.editData = this.formatDateForInput(ruta.fieldData.Data);
      }
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

  canOptimizeRoute(ruta: RutaDetalle | null): boolean {
    if (!ruta) return false;
    const tempsPrivisio = Number(ruta.fieldData.Temps_Privisio ?? 0);
    const tempsPrivisioTxt = (ruta.fieldData.Temps_Privisio_txt ?? '').trim();
    const isOptimized = (Number.isFinite(tempsPrivisio) && tempsPrivisio > 0) || tempsPrivisioTxt.length > 0;

    // Aparece si nunca se ha optimizado
    if (!isOptimized) return true;

    // O si aún no se ha añadido ningún dato a los puntos de recogida
    const hasPointData = (ruta.portalParadas ?? []).some(
      p => p.flagFet === '1' || p.flagAnulat === '1'
    );
    return !hasPointData;
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

  /** Abre Google Maps Directions con todos los puntos pendientes como waypoints */
  optimizarMaps(ruta: RutaDetalle | null): void {
    if (!ruta?.portalParadas?.length) return;
    const pendientes = ruta.portalParadas.filter(p => p.flagFet !== '1' && p.flagAnulat !== '1');
    if (pendientes.length < 2) return;
    const coords = pendientes
      .map(p => {
        if (p.latitud != null && p.longitud != null) return `${p.latitud},${p.longitud}`;
        return '';
      })
      .filter(Boolean);
    if (coords.length < 2) return;
    const destination = encodeURIComponent(coords[coords.length - 1]);
    const waypoints = coords.slice(0, -1).map(c => encodeURIComponent(c)).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
    window.open(url, '_blank');
  }

  /** Ejecuta el script de optimización de FileMaker */
  optimizarRutaFM(ruta: RutaDetalle | null): void {
    if (!ruta) return;
    this.savingInfo = true;
    this.error = null;

    this.fm.executeScript('Phone_Ruta', 'Ruta_Optima_PSOS', String(ruta.fieldData.Id_Ruta_serial || ruta.fieldData.Id_Ruta)).subscribe({
      next: () => {
        this.savingInfo = false;
        this.refresh$.next();
      },
      error: err => {
        this.savingInfo = false;
        this.error = err?.error?.messages?.[0]?.message ?? err?.message ?? 'No se pudo optimizar la ruta';
        this.changeDetector.detectChanges();
      }
    });
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

  private formatDateForInput(value: string | undefined): string {
    const d = this.parseRouteDate(value);
    if (!d) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private formatDateForFM(inputVal: string): string {
    if (!inputVal) return '';
    const parts = inputVal.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const [yyyy, mm, dd] = parts;
      return `${mm}/${dd}/${yyyy}`;
    }
    return inputVal;
  }

  private parseRouteDate(value: string | undefined): Date | null {
    if (!value) return null;
    const s = value.trim();
    if (!s) return null;

    let year = 0, month = 0, day = 0;
    if (s.includes('/')) {
      const parts = s.split('/').map(Number);
      if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
      if (parts[2] > 31) {
        year = parts[2];
        if (parts[0] > 12) {
          day = parts[0]; month = parts[1];
        } else if (parts[1] > 12) {
          month = parts[0]; day = parts[1];
        } else {
          month = parts[0]; day = parts[1];
        }
      } else if (parts[0] > 31) {
        year = parts[0]; month = parts[1]; day = parts[2];
      }
    } else if (s.includes('-')) {
      const parts = s.split('-').map(Number);
      if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
      if (s.split('-')[0].length === 4) {
        year = parts[0]; month = parts[1]; day = parts[2];
      } else {
        day = parts[0]; month = parts[1]; year = parts[2];
      }
    }
    if (!year || !month || !day) return null;
    if (year < 100) year += 2000;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  private loadPersonalList(): void {
    this.fm.listODataRecords<Record<string, unknown>>(
      'PERSONAL',
      ['Id_Personal', 'Nom_Complert'],
      { filter: 'Flag_Actiu eq 1 and Flag_Xofer eq 1', orderBy: 'Nom_Complert asc' },
    ).subscribe({
      next: records => {
        this.personalList = records
          .map(record => ({
            id: String(record['Id_Personal'] ?? '').trim(),
            name: String(record['Nom_Complert'] ?? '').trim(),
          }))
          .filter(person => person.id && person.name);
        this.keepCurrentPersonalOptions();
        this.syncPersonalSelection();
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.keepCurrentPersonalOptions();
        this.changeDetector.detectChanges();
      },
    });
  }

  private keepCurrentPersonalOptions(): void {
    if (!this.ruta) return;
    const current = [
      [this.ruta.fieldData.Id_Personal_1, this.ruta.fieldData.Nom_Personal_1],
      [this.ruta.fieldData.Id_Personal_2, this.ruta.fieldData.Nom_Personal_2],
      [this.ruta.fieldData.Id_Personal_3, this.ruta.fieldData.Nom_Personal_3],
    ];
    for (const [id, name] of current) {
      if (id && !this.personalList.some(person => person.id.toLowerCase() === id.toLowerCase())) {
        this.personalList.push({ id, name: name || id });
      }
    }
  }

  private syncPersonalSelection(): void {
    if (!this.ruta || !this.personalList.length) return;
    const matchId = (val: string | undefined): string => {
      if (!val) return '';
      const lower = val.trim().toLowerCase();
      const found = this.personalList.find(p => p.id.toLowerCase() === lower);
      return found ? found.id : val;
    };
    this.ruta.fieldData.Id_Personal_1 = matchId(this.ruta.fieldData.Id_Personal_1);
    this.ruta.fieldData.Id_Personal_2 = matchId(this.ruta.fieldData.Id_Personal_2);
    this.ruta.fieldData.Id_Personal_3 = matchId(this.ruta.fieldData.Id_Personal_3);
  }

  private loadVehiclesList(): void {
    this.fm.listODataRecords<Record<string, unknown>>('VEHICLES', ['Id_Vehicle', 'Matricula'], { orderBy: 'Matricula asc' }).subscribe({
      next: records => {
        this.vehiclesList = records
          .map(record => ({
            id: String(record['Id_Vehicle'] ?? '').trim(),
            matricula: String(record['Matricula'] ?? '').trim(),
          }))
          .filter(vehicle => vehicle.id && vehicle.matricula)
          .sort((a, b) => a.matricula.localeCompare(b.matricula));
        this.keepCurrentVehicleOption();
        this.syncVehicleSelection();
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.keepCurrentVehicleOption();
        this.changeDetector.detectChanges();
      },
    });
  }

  private keepCurrentVehicleOption(): void {
    const id = this.ruta?.fieldData.Id_Vehicle;
    const matricula = this.ruta?.fieldData.Matricula_Vehicle;
    if (id && matricula && !this.vehiclesList.some(vehicle => vehicle.id.toLowerCase() === id.toLowerCase())) {
      this.vehiclesList.unshift({ id, matricula });
    }
  }

  private syncVehicleSelection(): void {
    if (!this.ruta || !this.vehiclesList.length) return;
    const val = (this.ruta.fieldData.Id_Vehicle || '').trim();
    if (!val) return;
    const lower = val.toLowerCase();
    const found = this.vehiclesList.find(v => v.id.toLowerCase() === lower || v.matricula.toLowerCase() === lower);
    if (found) {
      this.ruta.fieldData.Id_Vehicle = found.id;
    }
  }

  saveRouteInfo(): void {
    if (!this.ruta || !this.canEditRouteInfo(this.ruta)) return;
    this.savingInfo = true;
    this.error = null;

    const fieldData = {
      Id_Vehicle: this.ruta.fieldData.Id_Vehicle,
      Id_Personal_1: this.ruta.fieldData.Id_Personal_1,
      Id_Personal_2: this.ruta.fieldData.Id_Personal_2,
      Id_Personal_3: this.ruta.fieldData.Id_Personal_3,
    };

    this.fm.updateRecord('Phone_Ruta', this.ruta.recordId, fieldData, { modId: this.ruta.modId }).subscribe({
      next: () => {
        this.savingInfo = false;
        this.showInfo = false;
        this.refresh$.next();
      },
      error: err => {
        this.savingInfo = false;
        this.error = err?.error?.messages?.[0]?.message ?? err?.message ?? 'No se pudo guardar la ruta';
        this.changeDetector.detectChanges();
      }
    });
  }
}

