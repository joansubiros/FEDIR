import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { SessionService } from '../services/session.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  private session = inject(SessionService);
  private router = inject(Router);


  canActivate(): boolean | UrlTree {
    const token = this.session.token;
    if (token) return true;
    return this.router.parseUrl('/auth/login');
  }
}
