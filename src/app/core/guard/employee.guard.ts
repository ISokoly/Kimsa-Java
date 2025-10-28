// src/app/core/guard/employee.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { ApiService, UsuarioLigero } from '../services/api.service';

@Injectable({ providedIn: 'root' })
export class EmployeeGuard implements CanActivate {
  constructor(private router: Router, private api: ApiService) {}

  private async resolveUser(): Promise<UsuarioLigero | null> {
    const u = this.api.usuarioAutenticado;
    if (u) return u;
    await this.api.ensureUserReady();
    return this.api.usuarioAutenticado;
  }

  async canActivate(): Promise<boolean | UrlTree> {
    const user = await this.resolveUser();
    if (!user) return this.router.parseUrl('/login');

    const rol = (user.rol || '').toString();
    // Permite Employee y Administrator
    if (rol === 'Employee' || rol === 'Administrator') return true;

    return this.router.parseUrl('/view/usuarios');
  }
}
