import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RutaService } from '../../core/services/ruta.service';
import { WriteQueueService } from '../../core/services/write-queue.service';

@Component({
  selector: 'app-ruta-new',
  templateUrl: './ruta-new.page.html',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RutaNewPage {
  form = this.fb.group({ Data: ['', Validators.required], Id_Vehicle: ['', Validators.required] });
  saving = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private rutas: RutaService,
    private queue: WriteQueueService,
    private router: Router,
  ) {}

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    this.error = null;
    const v = this.form.value as Record<string, string>;
    this.rutas.create({ Data: v['Data'], Id_Vehicle: v['Id_Vehicle'] }).subscribe({
      next: res => {
        this.saving = false;
        this.router.navigate(['/rutas', res.recordId]);
      },
      error: async err => {
        if (!navigator.onLine) {
          await this.queue.enqueue({ kind: 'create', database: 'FEDIR', layout: 'Phone_Ruta_New', fieldData: v as Record<string, unknown> });
          this.saving = false;
          this.router.navigateByUrl('/rutas');
          return;
        }
        this.saving = false;
        this.error = err?.error?.messages?.[0]?.message ?? err?.message ?? 'Error al crear';
      },
    });
  }
}

