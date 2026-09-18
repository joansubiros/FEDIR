import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  showTabs = false;

  constructor(private router: Router) {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: unknown) => {
      const url = (e as NavigationEnd).urlAfterRedirects;
      this.showTabs = !url.startsWith('/auth') && !url.startsWith('/paradas');
    });
  }
}
