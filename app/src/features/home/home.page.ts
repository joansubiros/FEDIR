import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { RutaService } from '../../core/services/ruta.service';
import { FileMakerService } from '../../core/services/filemaker.service';
import type { RutaListItem } from '../../core/models/fm.models';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnInit {
  private readonly proveedorUrl = 'https://n8n.fmsuit.net/webhook/proveedor';
  private readonly proveedorRoute = '/proveedores/nuevo';
  today = new Date();
  loading$ = new BehaviorSubject<boolean>(false);
  error$ = new BehaviorSubject<string | null>(null);

  recent$: Observable<RutaListItem[]> | null = null;
  pendientesTotales = 0;

  private todayKey = this.formatDateKey(this.today);

  constructor(
    private router: Router,
    private rutas: RutaService,
    private fm: FileMakerService,
    private alertCtrl: AlertController,
  ) {}

  ngOnInit(): void {
    this.loading$.next(true);
    this.error$.next(null);
    this.recent$ = this.rutas.list(20, 0).pipe(
      map(res => {
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

  goRutas(): void {
    this.router.navigateByUrl('/rutas');
  }

  goRutaDetalle(recordId: string): void {
    this.router.navigateByUrl(`/rutas/${recordId}`);
  }

  crearPesaje(): void {
    void this.router.navigate(['/pesajes', 'nuevo']);
  }

  nuevoProveedor(): void {
    void this.router.navigateByUrl(this.proveedorRoute);
  }

  enviarLinkNuevoProveedor(): void {
    const input = window.prompt('Introduzca el teléfono de WhatsApp con prefijo de país:');
    if (input === null) return;

    const phone = input.replace(/\D/g, '');
    if (phone.length < 8 || phone.length > 15) {
      window.alert('Introduzca un número de WhatsApp válido, con prefijo de país.');
      return;
    }

    const message = `Hola, aquí tiene su enlace para rellenar el formulario: ${this.proveedorUrl} .Saludos`;
    window.location.href = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
  }

  async logout(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cerrar sesión',
      message: '¿Estás seguro de que quieres salir de la aplicación?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salir',
          role: 'destructive',
          handler: () => {
            this.fm.logout().subscribe({
              next: () => {
                void this.router.navigateByUrl('/login');
              },
              error: () => {
                void this.router.navigateByUrl('/login');
              },
            });
          },
        },
      ],
    });
    await alert.present();
  }

  refrescar(): void {
    this.ngOnInit();
  }

  isToday(data: string): boolean {
    return this.formatDateKey(new Date(data)) === this.todayKey;
  }

  private formatDateKey(d: Date): string {
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
