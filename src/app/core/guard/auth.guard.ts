// src/app/core/guard/auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { ApiService, UsuarioLigero } from '../services/api.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router, private api: ApiService) {}

  private async resolveUser(): Promise<UsuarioLigero | null> {
    const u = this.api.usuarioAutenticado;
    if (u) return u;
    await this.api.ensureUserReady();
    return this.api.usuarioAutenticado;
  }

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> {
    const user = await this.resolveUser();
    if (!user) return this.router.parseUrl('/login');

    // Si la ruta define roles requeridos, valida
    const roles: string[] | undefined = route.data?.['roles'];
    if (roles?.length) {
      const rol = (user.rol || '').toString();
      if (!roles.includes(rol)) return this.router.parseUrl('/view');
    }
    return true;
  }
}
