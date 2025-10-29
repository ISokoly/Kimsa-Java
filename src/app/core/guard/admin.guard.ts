import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { ApiService } from '../services/api.service';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private router: Router, private api: ApiService) {}

  async canActivate(): Promise<boolean | UrlTree> {
    const u = this.api.usuarioAutenticado ?? (await this.api.ensureUserReady(), this.api.usuarioAutenticado);
    return (u?.rol === 'Administrator') ? true : this.router.parseUrl('/view/usuarios');
  }
}