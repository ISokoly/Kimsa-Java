import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../services/api.service';
import { ToastService } from '../services/toast.service';

@Injectable({ providedIn: 'root' })
export class PaymentAccessGuard implements CanActivate {

  constructor(
    private api: ApiService,
    private router: Router,
    private toast: ToastService
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
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

        if (venta.status === 'Cancelled') {
          this.toast.mostrarMensaje('⚠️ No se puede acceder a pagos de una venta cancelada');
          return this.router.parseUrl('/view/ventas');
        }

        return true;
      }),
      catchError(() => {
        this.toast.mostrarMensaje('❌ Error al verificar el estado de la venta');
        return of(this.router.parseUrl('/view/ventas'));
      })
    );
  }
}
