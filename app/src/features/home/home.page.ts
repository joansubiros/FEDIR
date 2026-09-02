import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { SessionService } from '../../core/services/session.service';
import { RutaService } from '../../core/services/ruta.service';
import type { RutaListItem } from '../../core/models/fm.models';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnInit {
  today = new Date();
  loading$ = new BehaviorSubject<boolean>(false);
  error$ = new BehaviorSubject<string | null>(null);

  recent$: Observable<RutaListItem[]> | null = null;
  totalRutas = 0;
  pendientesTotales = 0;
  rutasHoy = 0;

  private todayKey = this.formatDateKey(this.today);

  constructor(
    private router: Router,
    private session: SessionService,
    private rutas: RutaService,
  ) {}

  ngOnInit(): void {
    this.loading$.next(true);
    this.error$.next(null);
    this.recent$ = this.rutas.list(20, 0).pipe(
      map(res => {
        this.totalRutas = res.total;
        this.rutasHoy = res.items.filter(r => this.isToday(r.data)).length;
        this.pendientesTotales = res.items.reduce((acc, r) => acc + (r.countPuntsPendents ?? 0), 0);
        return res.items.slice(0, 5);
      }),
      finalize(() => this.loading$.next(false)),
      catchError(err => {
        this.error$.next('No se pudieron cargar las rutas');
        return [];
      }),
    );
  }

  get username(): string {
    return this.session.getCredentials()?.username ?? '—';
  }

  goRutas(): void {
    this.router.navigateByUrl('/rutas');
  }

  goRutaDetalle(recordId: string): void {
    this.router.navigateByUrl(`/rutas/${recordId}`);
  }

  refrescar(): void {
    this.ngOnInit();
  }

  private isToday(data: string): boolean {
    return this.formatDateKey(new Date(data)) === this.todayKey;
  }

  private formatDateKey(d: Date): string {
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
