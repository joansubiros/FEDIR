import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { registerLocaleData } from '@angular/common';
import es from '@angular/common/locales/es';
import { AppModule } from './app/app.module';

registerLocaleData(es);

platformBrowserDynamic().bootstrapModule(AppModule).catch(err => console.log(err));
