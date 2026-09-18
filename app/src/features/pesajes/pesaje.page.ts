import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FileMakerService } from '../../core/services/filemaker.service';
import { WriteQueueService } from '../../core/services/write-queue.service';

@Component({
  selector: 'app-pesaje',
  templateUrl: './pesaje.page.html',
  styleUrls: ['./pesaje.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PesajePage {
  readonly lugaresList = [
    'SODIR SRL',
    'Cereales Caviglia',
    'Carlos Vivas',
    'Basavilvaso',
    'Perros',
    'Alejo',
  ];

  readonly responsablesList = ['fbellota', 'mbarbitta', 'grodriguez'];

  readonly vehiculosList = ['AE960KV', 'KTQ678'];

  readonly unidadesList = ['Kilogramos', 'Litros'];

  todayKey = this.getTodayDate();

  form = this.fb.group({
    Lugar: ['', Validators.required],
    Fecha: [this.todayKey, Validators.required],
    Responsable: ['', Validators.required],
    Vehiculo: ['', Validators.required],
    Unidad: ['Kilogramos', Validators.required],
    PesoEntrante: [null as number | null, [Validators.min(0)]],
    PesoSaliente: [null as number | null, [Validators.min(0)]],
    Volumen: [null as number | null, [Validators.min(0)]],
    Observaciones: [''],
  });

  saving = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private fm: FileMakerService,
    private queue: WriteQueueService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  volver(): void {
    void this.router.navigate(['/home']);
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    this.error = null;
    this.cdr.markForCheck();

    const v = this.form.value;
    const payload = {
      Lugar: v.Lugar,
      'Fecha Pesaje': v.Fecha,
      Responsable: v.Responsable,
      'Vehículo': v.Vehiculo,
      Unidad: v.Unidad,
      'Peso Entrante': v.PesoEntrante != null ? Number(v.PesoEntrante) : null,
      'Peso Saliente': v.PesoSaliente != null ? Number(v.PesoSaliente) : null,
      Volumen: v.Volumen != null ? Number(v.Volumen) : null,
      Observaciones: v.Observaciones || '',
    };

    this.fm.executeScript('PROVEIDORS', 'Pes_FormWeb_PSOS', JSON.stringify(payload)).subscribe({
      next: () => {
        this.saving = false;
        this.cdr.markForCheck();
        void this.router.navigate(['/home']);
      },
      error: async err => {
        if (!navigator.onLine) {
          await this.queue.enqueue({
            kind: 'script',
            database: 'FEDIR',
            layout: 'PROVEIDORS',
            script: 'Pes_FormWeb_PSOS',
            scriptParam: JSON.stringify(payload),
          });
          this.saving = false;
          this.cdr.markForCheck();
          void this.router.navigate(['/home']);
          return;
        }
        this.saving = false;
        this.error = err?.error?.messages?.[0]?.message ?? err?.message ?? 'Error al guardar pesaje';
        this.cdr.markForCheck();
      },
    });
  }

  private getTodayDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
