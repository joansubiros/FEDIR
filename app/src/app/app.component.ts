import { Component, OnInit, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { UpdateService } from '../core/services/update.service';
import { PwaInstallService } from '../core/services/pwa-install.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private updateService = inject(UpdateService);
  private pwaInstall = inject(PwaInstallService);

  showTabs = false;

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: unknown) => {
      const url = (e as NavigationEnd).urlAfterRedirects;
      this.showTabs = !url.startsWith('/auth') && !url.startsWith('/paradas');
    });
  }

  ngOnInit(): void {
    this.pwaInstall.init();
    this.updateService.init();
  }
}
