import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, BehaviorSubject, switchMap, tap, shareReplay } from 'rxjs';
import { RutaService } from '../../core/services/ruta.service';
import type { RutaDetalle } from '../../core/models/fm.models';

@Component({
  selector: 'app-ruta-detalle',
  templateUrl: './ruta-detalle.page.html',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RutaDetallePage {
  ruta$: Observable<RutaDetalle>;
  loading$ = new BehaviorSubject<boolean>(true);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private rutas: RutaService,
  ) {
    this.ruta$ = this.route.paramMap.pipe(
      switchMap(pm => {
        this.loading$.next(true);
        return this.rutas.getDetalle(pm.get('id')!);
      }),
      tap(() => this.loading$.next(false)),
      shareReplay(1),
    );
  }

  ionViewWillEnter(): void {
    this.loading$.next(true);
  }

  openMaps(nom: string): void {
    const q = encodeURIComponent(nom);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  }

  callTel(tel: string): void {
    if (tel) window.open(`tel:${tel}`, '_self');
  }
}

