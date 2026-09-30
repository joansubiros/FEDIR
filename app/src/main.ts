import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { registerLocaleData } from '@angular/common';
import es from '@angular/common/locales/es';
import { isDevMode } from '@angular/core';
import { AppModule } from './app/app.module';

registerLocaleData(es);

// En modo desarrollo, desregistrar Service Worker residual si existiera (evita pantalla en blanco en Edge por caché antigua de ngsw)
if (isDevMode() && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

platformBrowserDynamic().bootstrapModule(AppModule).catch(err => console.log(err));
