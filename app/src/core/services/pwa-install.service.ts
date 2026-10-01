import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

@Injectable({
  providedIn: 'root',
})
export class PwaInstallService {
  private toastCtrl = inject(ToastController);
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstalled = false;

  init(): void {
    // Verificar si ya está ejecutándose como PWA instalada
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone
    ) {
      this.isInstalled = true;
      return;
    }

    // Capturar el evento de instalación en Android / Chromium (Brave, Chrome, Edge, Samsung Internet)
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.showInstallToast();
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isInstalled = true;
    });

    // En iOS Safari no existe beforeinstallprompt; mostrar aviso con instrucciones
    this.checkIosPrompt();
  }

  private async showInstallToast(): Promise<void> {
    if (!this.deferredPrompt || this.isInstalled) return;

    const toast = await this.toastCtrl.create({
      message: '¿Deseas agregar FEDIR a tu pantalla de inicio?',
      position: 'bottom',
      color: 'primary',
      duration: 0,
      buttons: [
        {
          text: 'Instalar',
          role: 'action',
          handler: async () => {
            if (this.deferredPrompt) {
              await this.deferredPrompt.prompt();
              const choice = await this.deferredPrompt.userChoice;
              if (choice.outcome === 'accepted') {
                this.deferredPrompt = null;
              }
            }
          },
        },
        {
          text: 'Ahora no',
          role: 'cancel',
        },
      ],
    });

    await toast.present();
  }

  private checkIosPrompt(): void {
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
    if (isIos && !isStandalone) {
      const dismissed = localStorage.getItem('ios_install_prompt_dismissed');
      if (!dismissed) {
        setTimeout(async () => {
          const toast = await this.toastCtrl.create({
            message: 'Para instalar FEDIR en tu iPhone: pulsa Compartir y luego "Añadir a pantalla de inicio".',
            position: 'bottom',
            duration: 8000,
            buttons: [
              {
                text: 'Entendido',
                role: 'cancel',
                handler: () => {
                  localStorage.setItem('ios_install_prompt_dismissed', '1');
                },
              },
            ],
          });
          await toast.present();
        }, 3000);
      }
    }
  }
}
