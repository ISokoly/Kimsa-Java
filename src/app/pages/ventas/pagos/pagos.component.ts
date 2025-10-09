import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-pagos',
  imports: [CommonModule, FormsModule],
  templateUrl: './pagos.component.html',
  styleUrl: './pagos.component.scss',
  providers: [DatePipe]
})
export class PagosComponent implements OnInit {

  pagos: any[] = [];
  ventas: any[] = [];
  pedidoActual: any = {};
  detallesPedido: any[] = [];
  productos: any[] = [];

  nuevoPago = {
    id_pedido: null,
    monto: 0,
    tipo_pago: '',
    fecha_pago: ''
  };
  yaPagado: boolean = false;
  constructor(private apiService: ApiService, private route: ActivatedRoute, private toastService: ToastService) { }

  ngOnInit(): void {
    this.cargarProductos();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const idNum = +id;
      this.cargarPedidoExistente(idNum);
      this.cargarPagosHechos(idNum);
    }
  }

  cargarPedidoExistente(id: number): void {
    this.apiService.getSaleById(id).subscribe({
      next: (pedido: any) => {
        this.pedidoActual = {
          id: pedido.id,
          total: pedido.total,
          id_mesa: pedido.id_mesa,
        };

        this.ventas[0] = {
          cliente: pedido.nombre_cliente,
          fecha: pedido.fecha_pedido,
          hora: pedido.hora_pedido,
          total: pedido.total,
          id_pedido: pedido.id_pedido,
          id_mesa: pedido.id_mesa
        };

        if (!this.yaPagado) {
          this.nuevoPago = {
            id_pedido: this.pedidoActual.id,
            monto: this.pedidoActual.total,
            tipo_pago: '',
            fecha_pago: this.obtenerFechaHoraActual()
          };
        }

        this.cargarDetallesPedido();

        this.apiService.getClientesById(pedido.id_cliente).subscribe();
      },
      error: (error) => {
        this.toastService.mostrarMensaje('❌ Error al cargar el pedido: ' + error.message);
      }
    });
  }

  cargarPagosHechos(id_pedido: number): void {
    this.apiService.getPaymentsByOrderId(id_pedido).subscribe({
      next: (pagos: any[]) => {
        if (pagos && pagos.length > 0) {
          const pagoExistente = pagos[0];

          this.yaPagado = true;

          const fecha = new Date(pagoExistente.fecha_pago);
          const fechaISO = this.convertirADatetimeLocal(fecha);

          this.nuevoPago = {
            id_pedido: pagoExistente.id_pedido,
            monto: pagoExistente.monto,
            tipo_pago: pagoExistente.tipo_pago,
            fecha_pago: fechaISO
          };
        } else {
          this.yaPagado = false;
        }
      },
      error: (error) => {
        this.toastService.mostrarMensaje('❌ Error al cargar pagos: ' + error.message);
        this.yaPagado = false;
      }
    });
  }

  obtenerFechaHoraActual(): string {
    return this.convertirADatetimeLocal(new Date());
  }

  private convertirADatetimeLocal(fecha: Date): string {
    const offset = fecha.getTimezoneOffset();
    const localDate = new Date(fecha.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 16); // 'YYYY-MM-DDTHH:mm'
  }


  obtenerNombreProducto(idProducto: number): string {
    const producto = this.productos.find(p => p.id === idProducto);
    return producto ? producto.nombre : '';
  }

  cargarDetallesPedido() {
    if (this.pedidoActual.id) {
      this.apiService.getOrderDetailsByOrderId(this.pedidoActual.id).subscribe({
        next: (response) => {
          if (Array.isArray(response)) {
            this.detallesPedido = response;
          } else if (response && typeof response === 'object') {
            this.detallesPedido = [response];
          } else {
            this.detallesPedido = [];
          }
        }
      });
    }
  }

  cargarProductos() {
    this.apiService.getProductos().subscribe({
      next: (response) => {
        this.productos = response;
        this.cargarDetallesPedido();
      },
      error: (error) => {
        this.toastService.mostrarMensaje('❌ Error al obtener productos:', error);
      }
    });
  }

  registrarPago() {
    this.apiService.createPayment(this.nuevoPago).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Pago registrado correctamente');

        this.apiService.updateSale(this.pedidoActual.id, { estado: 'Confirmado' }).subscribe({
          next: () => {
            if (this.pedidoActual.id_mesa) {
              this.apiService.updateMesa(this.pedidoActual.id_mesa, { activo: false }).subscribe({
                next: () => {
                  this.cargarPagosHechos(this.pedidoActual.id);
                },
                error: (err) => {
                  this.toastService.mostrarMensaje('❌ Error al actualizar mesa');
                }
              });
            } else {
              this.cargarPagosHechos(this.pedidoActual.id);
            }
          },
          error: (err) => {
            this.toastService.mostrarMensaje('❌ Error al actualizar pedido');
          }
        });
      },
      error: (error) => {
        this.toastService.mostrarMensaje('❌ Error al registrar el pago');
      }
    });
  }
}
