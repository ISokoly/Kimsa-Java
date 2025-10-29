import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../services/api.service';
import { ToastService } from '../services/toast.service';

@Injectable({ providedIn: 'root' })
export class PendingSalesGuard implements CanActivate {

  constructor(
    private api: ApiService,
    private router: Router,
    private toast: ToastService
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot
  ): Observable<boolean | UrlTree> {
    const saleId = Number(route.paramMap.get('id'));
    if (isNaN(saleId)) {
      this.toast.mostrarMensaje('❌ ID de venta inválido');
      return of(this.router.parseUrl('/view/ventas'));
    }

    return this.api.getSaleById(saleId).pipe(
      map((venta: any) => {
        if (!venta) {
          this.toast.mostrarMensaje('❌ Venta no encontrada');
          return this.router.parseUrl('/view/ventas');
        }

        if (venta.status === 'Pending') {
          return true;
        } else {
          this.toast.mostrarMensaje('⚠️ Solo se pueden editar ventas pendientes');
          return this.router.parseUrl('/view/ventas');
        }
      }),
      catchError(() => {
        this.toast.mostrarMensaje('❌ Error al verificar venta');
        return of(this.router.parseUrl('/view/ventas'));
      })
    );
  }
}
