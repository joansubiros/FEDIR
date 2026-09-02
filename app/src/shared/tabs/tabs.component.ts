import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.component.html',
  styleUrls: ['./tabs.component.scss'],
  standalone: false,
})
export class TabsComponent {
  active = '';

  constructor(private router: Router) {
    this.active = this.toTab(router.url);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: unknown) => {
      this.active = this.toTab((e as NavigationEnd).urlAfterRedirects);
    });
  }

  go(path: string): void {
    void this.router.navigateByUrl(path);
  }

  private toTab(url: string): string {
    if (url.startsWith('/rutas')) return 'rutas';
    if (url.startsWith('/direcciones')) return 'puntos';
    if (url === '/home' || url === '/') return 'home';
    return 'home';
  }
}
