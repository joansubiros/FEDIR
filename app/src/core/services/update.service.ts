import { Injectable, ApplicationRef, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { ToastController } from '@ionic/angular';
import { concat, interval } from 'rxjs';
import { filter, first } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class UpdateService {
  private swUpdate = inject(SwUpdate, { optional: true });
  private appRef = inject(ApplicationRef);
  private toastCtrl = inject(ToastController);


  init(): void {
    const swUpdate = this.swUpdate;
    if (!swUpdate?.isEnabled) {
      return;
    }

    // Comprobación periódica de actualizaciones una vez que la app esté estable (cada 6 horas)
    const appIsStable$ = this.appRef.isStable.pipe(first(isStable => isStable === true));
    const everySixHours$ = interval(6 * 60 * 60 * 1000);
    const everySixHoursOnceAppIsStable$ = concat(appIsStable$, everySixHours$);

    everySixHoursOnceAppIsStable$.subscribe(async () => {
      try {
        await swUpdate.checkForUpdate();
      } catch (err) {
        console.warn('Error comprobando actualizaciones:', err);
      }
    });

    // Detectar cuando hay una versión lista
    swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(async () => {
        await this.promptUser();
      });
  }

  private async promptUser(): Promise<void> {
    const swUpdate = this.swUpdate;
    if (!swUpdate) return;
    const toast = await this.toastCtrl.create({
      message: 'Hay una nueva versión disponible de FEDIR.',
      position: 'bottom',
      color: 'primary',
      duration: 0,
      buttons: [
        {
          text: 'Actualizar',
          role: 'action',
          handler: async () => {
            try {
              await swUpdate.activateUpdate();
              document.location.reload();
            } catch {
              document.location.reload();
            }
          },
        },
        {
          text: 'Cerrar',
          role: 'cancel',
        },
      ],
    });

    await toast.present();
  }
}
