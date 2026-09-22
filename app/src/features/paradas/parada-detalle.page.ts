import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, combineLatest, switchMap, tap, map, shareReplay } from 'rxjs';
import { LrutaService, RutaService } from '../../core/services/ruta.service';
import { WriteQueueService } from '../../core/services/write-queue.service';
import type { LrutaDetalle } from '../../core/models/fm.models';

@Component({
  selector: 'app-parada-detalle',
  templateUrl: './parada-detalle.page.html',
  styleUrls: ['./parada-detalle.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParadaDetallePage {
  parada$: Observable<LrutaDetalle>;
  saving = false;
  sendingAviso = false;
  avisoStatus: string | null = null;
  avisoSuccess = false;
  error: string | null = null;

  // Options for dropdown tachos (0 to 12)
  readonly tachosOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Form fields
  tipUsUd = 'Litros';
  quantContEntregats: number | null = null;
  quantContRecollits: number | null = null;
  quantContenidor: number | null = null;
  tipUsContenidor = '';
  cantidadRecogida: number | string | null = null;
  flagFet = '';
  flagAnulat = '';
  motiuAnulat = '';
  tel1 = '';
  nom = '';
  observacions = '';

  private modId: string | null = null;
  pageTitle$ = new BehaviorSubject<string>('');
  displayAddress$ = new BehaviorSubject<string>('');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private lruta: LrutaService,
    private rutas: RutaService,
    private queue: WriteQueueService,
    private cdr: ChangeDetectorRef,
  ) {
    this.parada$ = combineLatest([
      this.route.paramMap,
      this.route.queryParamMap,
    ]).pipe(
      switchMap(([pm]) => {
        const id = pm.get('id')!;
        return this.lruta.get(id);
      }),
      tap(p => {
        this.modId = p.modId;
        this.tipUsUd = p.tipUsUd || 'Litros';
        this.quantContEntregats = p.quantContEntregats;
        this.quantContRecollits = p.quantContRecollits;
        this.quantContenidor = p.quantContenidor;
        this.tipUsContenidor = p.tipUsContenidor ? String(p.tipUsContenidor) : '';

        if (this.tipUsUd === 'Kilogramos') {
          this.cantidadRecogida = p.quantKg;
        } else {
          this.cantidadRecogida = p.quantL;
        }

        this.flagFet = p.flagFet || '';
        this.flagAnulat = p.flagAnulat || '';
        this.motiuAnulat = p.motiuAnulat || '';
        this.tel1 = this.formatArgentinaPhone(p.tel1 || '');
        this.nom = p.nom || '';
        this.observacions = p.observacions || '';

        const combined = p.nomDireccio || p.etiquetaDireccio || '';
        const { name, address } = this.parseNameAndAddress(combined);
        this.displayAddress$.next(p.direccio || address);
        // Header title only shows the name of the place
        this.pageTitle$.next(p.nomDireccio || name || 'PUNTO RECOGIDA');

        this.checkRealizadoAuto();
        this.cdr.markForCheck();
      }),
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

  validatePositive(field: 'quantContEntregats' | 'quantContRecollits' | 'quantContenidor'): void {
    const val = this[field];
    if (val != null && val < 0) {
      this[field] = 0;
    }
  }

  onUnidadChange(): void {
    this.checkRealizadoAuto();
    this.cdr.markForCheck();
  }

  onCantidadChange(): void {
    const val = Number(this.cantidadRecogida);
    if (!isNaN(val) && val < 0) {
      this.cantidadRecogida = 0;
    }
    this.checkRealizadoAuto();
  }

  onRealizadoChange(event: CustomEvent): void {
    this.flagFet = event.detail.checked ? '1' : '';
    this.cdr.markForCheck();
  }

  onAnuladoChange(event: CustomEvent): void {
    this.flagAnulat = event.detail.checked ? '1' : '';
    if (this.flagAnulat !== '1') {
      this.motiuAnulat = '';
    }
    this.checkRealizadoAuto();
    this.cdr.markForCheck();
  }

  onMotivoAnulatChange(): void {
    this.checkRealizadoAuto();
    this.cdr.markForCheck();
  }

  private checkRealizadoAuto(): void {
    const qty = Number(this.cantidadRecogida) || 0;
    const isSpecialMotivo = this.motiuAnulat === 'Tacho Robado' || this.motiuAnulat === 'Sin Aceite';
    if (qty > 0 || (this.flagAnulat === '1' && isSpecialMotivo)) {
      this.flagFet = '1';
    }
  }

  formatPhoneOnBlur(): void {
    if (this.tel1) {
      this.tel1 = this.formatArgentinaPhone(this.tel1);
      this.cdr.markForCheck();
    }
  }

  formatArgentinaPhone(phone: string): string {
    if (!phone) return '';
    const trimmed = phone.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return trimmed;

    let local = digits;
    if (local.startsWith('549')) {
      local = local.substring(3);
    } else if (local.startsWith('54')) {
      local = local.substring(2);
    }

    if (local.startsWith('0')) {
      local = local.substring(1);
    }

    if (local.startsWith('15') && local.length > 8) {
      local = local.substring(2);
    }

    if (local.startsWith('11') && local.length >= 10) {
      const area = local.substring(0, 2);
      const p1 = local.substring(2, 6);
      const p2 = local.substring(6, 10);
      const rest = local.substring(10);
      return `+54 9 ${area} ${p1}-${p2}${rest ? ' ' + rest : ''}`;
    }

    if (local.length >= 10) {
      const area = local.substring(0, 3);
      const p1 = local.substring(3, 6);
      const p2 = local.substring(6, 10);
      const rest = local.substring(10);
      return `+54 9 ${area} ${p1}-${p2}${rest ? ' ' + rest : ''}`;
    }

    return `+54 9 ${local}`;
  }

  sendAvisoNoRealizado(): void {
    if (!this.tel1) {
      this.avisoStatus = 'No hay número de WhatsApp configurado.';
      this.avisoSuccess = false;
      this.cdr.markForCheck();
      return;
    }
    this.sendingAviso = true;
    this.avisoStatus = null;
    const digits = this.tel1.replace(/\D/g, '');
    let phoneClean = digits;
    if (!phoneClean.startsWith('54')) {
      phoneClean = '549' + phoneClean;
    } else if (phoneClean.startsWith('54') && !phoneClean.startsWith('549')) {
      phoneClean = '549' + phoneClean.substring(2);
    }

    const payload = {
      phone: phoneClean,
      name: this.nom || this.pageTitle$.value,
      date: new Date().toISOString().split('T')[0],
      local_name: this.pageTitle$.value,
      motivo: this.motiuAnulat || 'No realizado',
    };

    this.http.post('https://n8n.fmsuit.net/webhook/4832cca1-75b5-4c37-957e-9198dc2fe020', payload, { responseType: 'text' }).subscribe({
      next: () => {
        this.sendingAviso = false;
        this.avisoSuccess = true;
        this.avisoStatus = 'Aviso enviado correctamente.';
        this.cdr.markForCheck();
        setTimeout(() => {
          this.avisoStatus = null;
          this.cdr.markForCheck();
        }, 5000);
      },
      error: (err: unknown) => {
        this.sendingAviso = false;
        this.avisoSuccess = false;
        const msg = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Error de conexión';
        this.avisoStatus = `Error al enviar aviso: ${msg}`;
        this.cdr.markForCheck();
      },
    });
  }

  save(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    const qty = this.cantidadRecogida != null ? Number(this.cantidadRecogida) : '';
    const isKg = this.tipUsUd === 'Kilogramos';

    const fieldData: Record<string, unknown> = {
      Quant_Cont_Entregats: this.quantContEntregats != null ? this.quantContEntregats : '',
      Quant_Cont_Recollits: this.quantContRecollits != null ? this.quantContRecollits : '',
      Quant_Kg: isKg ? qty : '',
      Quant_L: !isKg ? qty : '',
      'lruta_LDIRECCIONS::Tipus_ud': this.tipUsUd || 'Litros',
      'lruta_LDIRECCIONS::Quant_Contenidor': this.quantContenidor != null ? this.quantContenidor : '',
      'lruta_LDIRECCIONS::Tipus_Contenidor': this.tipUsContenidor || '',
      Flag_Fet: this.flagFet === '1' ? '1' : '',
      Flag_Anulat: this.flagAnulat === '1' ? '1' : '',
      Motiu_Anulat: this.flagAnulat === '1' ? (this.motiuAnulat || '') : '',
      'lruta_ldir_LCONTACTES::Tel_1': this.tel1 || '',
      'lruta_ldir_LCONTACTES::Nom': this.nom || '',
      Observacions: this.observacions || '',
    };
    this.saving = true;
    this.error = null;
    this.lruta.update(id, fieldData, this.modId ?? undefined).subscribe({
      next: () => {
        this.saving = false;
        this.cdr.markForCheck();
      },
      error: async err => {
        if (!navigator.onLine) {
          await this.queue.enqueue({ kind: 'update', database: 'FEDIR', layout: 'Phone_LRuta', recordId: id, fieldData });
          this.saving = false;
          this.cdr.markForCheck();
          return;
        }
        this.saving = false;
        this.error = err?.error?.messages?.[0]?.message ?? err?.message ?? 'Error al guardar';
        this.cdr.markForCheck();
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

