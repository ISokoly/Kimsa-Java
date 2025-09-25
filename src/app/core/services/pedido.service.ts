import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class PedidoService {

    constructor(private apiService: ApiService, private router: Router) { }

    validarEstadoPedido(idPedido: number): Observable<boolean> {
        return this.apiService.getVentasById(idPedido).pipe(
            tap(pedido => console.log('Estado recibido:', pedido.estado)),
            map(pedido => {
                if (pedido.estado === 'Confirmado' || pedido.estado === 'Cancelado') {
                    this.router.navigate(['view/ventas']);
                    alert('Este pedido está confirmado o cancelado y no puede ser modificado.');
                    return false;
                }
                return true;
            }),
            catchError(() => {
                this.router.navigate(['view/ventas']);
                return of(false);
            })
        );
    }
}
