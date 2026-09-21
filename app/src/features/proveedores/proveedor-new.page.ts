import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { FileMakerService } from '../../core/services/filemaker.service';
import { WriteQueueService } from '../../core/services/write-queue.service';
import { UBICACIONES_ARG } from '../../core/data/ubicaciones-arg';

@Component({
  selector: 'app-proveedor-new',
  templateUrl: './proveedor-new.page.html',
  styleUrls: ['./proveedor-new.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProveedorNewPage {
  readonly provinciasList = Object.keys(UBICACIONES_ARG);

  readonly horasList: string[] = (() => {
    const list: string[] = [];
    for (let i = 6; i < 24; i++) {
      list.push(`${i < 10 ? '0' : ''}${i}:00`);
    }
    return list;
  })();

  readonly diasList = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  poblacionesList: string[] = [];
  barriosList: string[] = [];

  form = this.fb.group({
    'Razón Social': ['', Validators.required],
    'Nombre Comercial': ['', Validators.required],
    'CUIT': ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    'Persona Contacto': ['', Validators.required],
    'Email': ['', [Validators.required, Validators.email]],
    'Teléfono 1': ['', Validators.required],
    'Teléfono 2': [''],
    'Provincia': ['', Validators.required],
    'Población': ['', Validators.required],
    'Barrio': ['', Validators.required],
    'Dirección': ['', Validators.required],
    'CP': ['', Validators.required],
    'Horario Desde': ['', Validators.required],
    'Horario Hasta': ['', Validators.required],
    'Dias': [[] as string[], Validators.required],
    'Observaciones': [''],
  });

  saving = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private fm: FileMakerService,
    private queue: WriteQueueService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
  ) {
    this.form.get('Provincia')?.valueChanges.subscribe(prov => {
      this.cargarPoblaciones(prov);
    });
    this.form.get('Población')?.valueChanges.subscribe(() => {
      this.cargarBarrios(this.form.get('Provincia')?.value ?? null, this.form.get('Población')?.value ?? null);
    });
  }

  private cargarPoblaciones(provincia: string | null): void {
    this.poblacionesList = provincia ? Object.keys(UBICACIONES_ARG[provincia] ?? {}) : [];
    this.form.get('Población')?.setValue('');
    this.barriosList = [];
    this.form.get('Barrio')?.setValue('');
    this.cdr.markForCheck();
  }

  private cargarBarrios(provincia: string | null, poblacion: string | null): void {
    const prov = provincia ? UBICACIONES_ARG[provincia] : null;
    if (!prov || !poblacion) {
      this.barriosList = [];
      this.form.get('Barrio')?.setValue('');
      return;
    }
    this.barriosList = prov[poblacion] ?? [];
    this.form.get('Barrio')?.setValue('');
    this.cdr.markForCheck();
  }

  private static validarCUIT(c: string): boolean {
    c = c.replace(/[^0-9]/g, '');
    if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    const m = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let t = 0;
    for (let i = 0; i < 10; i++) t += parseInt(c[i], 10) * m[i];
    const r = t % 11;
    const d = r === 0 ? 0 : r === 1 ? 9 : 11 - r;
    return d === parseInt(c[10], 10);
  }

  private static validarCP(cp: string): boolean {
    const regex = /(^[0-9]{4}$)|(^[A-Za-z][0-9]{4}[A-Za-z]{3}$)/;
    return regex.test(cp.trim());
  }

  private static normalizarCelularArgentino(tel: string): string | null {
    let digits = tel.replace(/[^0-9]/g, '');
    if (!digits) return null;
    if (digits.startsWith('0')) digits = digits.substring(1);
    if (digits.startsWith('54')) {
      digits = digits.substring(2);
      if (digits.startsWith('9')) digits = digits.substring(1);
    }
    for (const areaLen of [2, 3, 4]) {
      if (digits.length > areaLen + 2 && digits.substring(areaLen, areaLen + 2) === '15') {
        digits = digits.substring(0, areaLen) + digits.substring(areaLen + 2);
        break;
      }
    }
    if (digits.length === 10) return '+549' + digits;
    return null;
  }

  volver(): void {
    void this.router.navigate(['/home']);
  }

  get diasSeleccionados(): string[] {
    return this.form.get('Dias')?.value ?? [];
  }

  toggleDia(dia: string): void {
    const actuales: string[] = this.form.get('Dias')?.value ?? [];
    const idx = actuales.indexOf(dia);
    if (idx >= 0) {
      actuales.splice(idx, 1);
    } else {
      actuales.push(dia);
    }
    this.form.get('Dias')?.setValue([...actuales]);
    this.cdr.markForCheck();
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;

    const v = this.form.value as Record<string, unknown>;
    const cuit = String(v['CUIT']);
    if (!ProveedorNewPage.validarCUIT(cuit)) {
      this.error = 'CUIT inválido o prohibido.';
      this.cdr.markForCheck();
      return;
    }
    const cp = String(v['CP']);
    if (!ProveedorNewPage.validarCP(cp)) {
      this.error = 'CP inválido (ej: 1002 o C1425ABC).';
      this.cdr.markForCheck();
      return;
    }
    const tel1Raw = String(v['Teléfono 1']);
    const tel1Normalizado = ProveedorNewPage.normalizarCelularArgentino(tel1Raw);
    if (!tel1Normalizado) {
      this.error = 'Tel. WhatsApp inválido. Ingrese un celular válido (ej: +54 9 11 2345-6789 o 11 2345-6789).';
      this.cdr.markForCheck();
      return;
    }
    if ((v['Horario Hasta'] as string) <= (v['Horario Desde'] as string)) {
      this.error = 'La hora de cierre debe ser superior a la de apertura.';
      this.cdr.markForCheck();
      return;
    }

    const diasSeleccionados: string[] = v['Dias'] as string[];
    if (!diasSeleccionados.length) {
      this.error = 'Debe marcar al menos un día de atención.';
      this.cdr.markForCheck();
      return;
    }

    const payload = {
      'Razón Social': v['Razón Social'],
      'Nombre Comercial': v['Nombre Comercial'],
      'CUIT': cuit,
      'Persona Contacto': v['Persona Contacto'],
      'Email': v['Email'],
      'Teléfono 1': tel1Normalizado,
      'Teléfono 2': v['Teléfono 2'] || '',
      'Provincia': v['Provincia'],
      'Población': v['Población'],
      'Barrio': v['Barrio'],
      'Dirección': v['Dirección'],
      'CP': cp,
      'Horario Desde': v['Horario Desde'],
      'Horario Hasta': v['Horario Hasta'],
      'Dias': diasSeleccionados,
      'Observaciones': v['Observaciones'] || '',
    };

    this.saving = true;
    this.error = null;
    this.cdr.markForCheck();

    const loading = await this.loadingCtrl.create({
      message: 'Guardando proveedor...',
      backdropDismiss: false,
    });
    await loading.present();

    this.fm.executeScript('PROVEIDORS', 'Prov_FormWeb_PSOS', JSON.stringify(payload)).subscribe({
      next: async res => {
        await loading.dismiss();
        this.saving = false;
        const code = res.messages?.[0]?.code;
        const scriptResult = res.response?.scriptResult;
        if (code === '0' && scriptResult === 'ok') {
          const toast = await this.toastCtrl.create({
            message: 'Proveedor registrado correctamente en FEDIR.',
            duration: 2000,
            color: 'success',
            position: 'bottom',
          });
          await toast.present();
          void this.router.navigate(['/home']);
        } else {
          const msg = res.messages?.[0]?.message ?? 'Error desconocido al registrar el proveedor.';
          this.error = msg;
          this.cdr.markForCheck();
        }
      },
      error: async err => {
        await loading.dismiss();
        this.saving = false;
        if (!navigator.onLine) {
          await this.queue.enqueue({
            kind: 'script',
            database: 'FEDIR',
            layout: 'PROVEIDORS',
            script: 'Prov_FormWeb_PSOS',
            scriptParam: JSON.stringify(payload),
          });
          const toast = await this.toastCtrl.create({
            message: 'Sin conexión. El proveedor se guardará cuando haya red.',
            duration: 2500,
            color: 'warning',
            position: 'bottom',
          });
          await toast.present();
          void this.router.navigate(['/home']);
          return;
        }
        this.error = err?.error?.messages?.[0]?.message ?? err?.message ?? 'Error al registrar el proveedor.';
        this.cdr.markForCheck();
      },
    });
  }
}
