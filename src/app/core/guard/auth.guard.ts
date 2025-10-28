// AuthGuard: exige sesión
import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { ApiService } from '../services/api.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router, private api: ApiService) {}

  async canActivate(): Promise<boolean | UrlTree> {
    const u = this.api.usuarioAutenticado;
    if (u) return true;
    await this.api.ensureUserReady();
    return this.api.usuarioAutenticado ? true : this.router.parseUrl('/login');
  }
}
