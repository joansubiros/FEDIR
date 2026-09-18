import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, Observable, combineLatest, switchMap, tap, map, shareReplay } from 'rxjs';
import { LrutaService, RutaService } from '../../core/services/ruta.service';
import { WriteQueueService } from '../../core/services/write-queue.service';
import type { LrutaDetalle } from '../../core/models/fm.models';

@Component({
  selector: 'app-parada-detalle',
  templateUrl: './parada-detalle.page.html',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParadaDetallePage {
  parada$: Observable<LrutaDetalle>;
  saving = false;
  error: string | null = null;
  quantContEntregats: number | null = null;
  quantContRecollits: number | null = null;
  quantKg: number | null = null;
  quantL: number | null = null;
  flagFet: string | null = null;
  flagAnulat: string | null = null;
  motiuAnulat: string | null = null;
  observacions: string | null = null;
  private modId: string | null = null;

  pageTitle$ = new BehaviorSubject<string>('');
  displayAddress$ = new BehaviorSubject<string>('');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private lruta: LrutaService,
    private rutas: RutaService,
    private queue: WriteQueueService,
    private cdr: ChangeDetectorRef,
  ) {
    this.parada$ = combineLatest([
      this.route.paramMap,
      this.route.queryParamMap,
    ]).pipe(
      switchMap(([pm, qm]) => {
        const id = pm.get('id')!;
        const serial = Number(qm.get('serial')) || 0;
        return this.lruta.get(id).pipe(
          map(p => ({ point: p, serial })),
        );
      }),
      tap(({ point: p, serial }) => {
        this.modId = p.modId;
        this.quantContEntregats = p.quantContEntregats;
        this.quantContRecollits = p.quantContRecollits;
        this.quantKg = p.quantKg;
        this.quantL = p.quantL;
        this.flagFet = p.flagFet;
        this.flagAnulat = p.flagAnulat;
        this.motiuAnulat = p.motiuAnulat;
        this.observacions = p.observacions;

        const combined = p.nomDireccio || p.etiquetaDireccio || '';
        const { name, address } = this.parseNameAndAddress(combined);
        this.displayAddress$.next(p.direccio || address);
        this.pageTitle$.next(serial ? `RUTA ${serial} ${name}` : name);

        this.cdr.markForCheck();
      }),
      map(({ point }) => point),
      shareReplay(1),
    );
  }

  private parseNameAndAddress(combined: string): { name: string; address: string } {
    if (!combined) return { name: '', address: '' };

    const addressStart = combined.search(/[A-ZÀ-Ý][a-z\u00E0-\u00FC]{2,}\s+\d/);
    if (addressStart > 0) {
      return {
        name: combined.substring(0, addressStart).trim(),
        address: combined.substring(addressStart).trim(),
      };
    }

    return { name: combined, address: '' };
  }

  save(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    const fieldData: Record<string, unknown> = {
      Quant_Cont_Entregats: this.quantContEntregats ?? '',
      Quant_Cont_Recollits: this.quantContRecollits ?? '',
      Quant_Kg: this.quantKg ?? '',
      Quant_L: this.quantL ?? '',
      Flag_Fet: this.flagFet ?? '',
      Flag_Anulat: this.flagAnulat ?? '',
      Motiu_Anulat: this.motiuAnulat ?? '',
      Observacions: this.observacions ?? '',
    };
    this.saving = true;
    this.error = null;
    this.lruta.update(id, fieldData, this.modId ?? undefined).subscribe({
      next: () => (this.saving = false),
      error: async err => {
        if (!navigator.onLine) {
          await this.queue.enqueue({ kind: 'update', database: 'FEDIR', layout: 'Phone_LRuta', recordId: id, fieldData });
          this.saving = false;
          return;
        }
        this.saving = false;
        this.error = err?.error?.messages?.[0]?.message ?? err?.message ?? 'Error al guardar';
      },
    });
  }

  backToRoute(): void {
    const routeId = this.route.snapshot.queryParamMap.get('routeId');
    const serial = Number(this.route.snapshot.queryParamMap.get('serial'));
    if (routeId) {
      void this.router.navigate(['/rutas', routeId], { queryParams: serial ? { serial } : undefined });
      return;
    }
    if (!serial) {
      void this.router.navigateByUrl('/rutas');
      return;
    }
    this.rutas.getDetalle('', serial).subscribe({
      next: ruta => void this.router.navigate(['/rutas', ruta.recordId], { queryParams: { serial } }),
      error: () => void this.router.navigateByUrl('/rutas'),
    });
  }
}
