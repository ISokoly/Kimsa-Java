import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class HomeRedirectGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): boolean {
    const usuarioGuardado = localStorage.getItem('usuario');
    if (!usuarioGuardado) {
      this.router.navigate(['/login']);
      return false;
    }
    try {
      const usuario = JSON.parse(usuarioGuardado);

      if (usuario.rol === 'Administrator') {
        this.router.navigate(['/view/estadisticas']);
      } else {
        this.router.navigate(['/view/categoria']);
      }
    } catch (e) {
      this.router.navigate(['/login']);
    }
    return false;
  }
}