import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable, switchMap, tap, shareReplay } from 'rxjs';
import { LrutaService } from '../../core/services/ruta.service';
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

  constructor(
    private route: ActivatedRoute,
    private lruta: LrutaService,
    private queue: WriteQueueService,
  ) {
    this.parada$ = this.route.paramMap.pipe(
      switchMap(pm => this.lruta.get(pm.get('id')!)),
      tap(p => {
        this.modId = p.modId;
        this.quantContEntregats = p.quantContEntregats;
        this.quantContRecollits = p.quantContRecollits;
        this.quantKg = p.quantKg;
        this.quantL = p.quantL;
        this.flagFet = p.flagFet;
        this.flagAnulat = p.flagAnulat;
        this.motiuAnulat = p.motiuAnulat;
        this.observacions = p.observacions;
      }),
      shareReplay(1),
    );
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
}

