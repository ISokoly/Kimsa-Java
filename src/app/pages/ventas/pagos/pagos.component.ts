import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';

type Detalle = {
  idDetail?: number;
  idOrder?: number;
  idProduct?: number;
  quantity?: number;
  subtotal?: number;
  // compat con back antiguo:
  id_detalle?: number;
  id_pedido?: number;
  id_producto?: number;
  cantidad?: number;
};

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagos.component.html',
  styleUrls: ['./pagos.component.scss']
})
export class PagosComponent implements OnInit {

  yaPagado = false;

  pedidoActual: {
    idOrder?: number;
    total?: number;
    idTable?: number | null;
    idClient?: number | null;
  } = {};

  detallesPedido: Detalle[] = [];
  productos: any[] = [];

  nuevoPago = {
    id_pedido: null as number | null,
    monto: 0,
    tipo_pago: null as string | null,
    fecha_pago: '' // 'YYYY-MM-DDTHH:mm'
  };

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;
    const id = +idParam;

    this.cargarProductos();         // para mapear nombres
    this.cargarPagosHechos(id);     // setea yaPagado / nuevoPago si existe
    this.cargarPedidoExistente(id); // info de la venta + detalles
  }

  /* ==================== Carga ==================== */
  cargarPedidoExistente(id: number): void {
    this.api.getSaleById(id).subscribe({
      next: (sale: any) => {
        this.pedidoActual = {
          idOrder: Number(sale?.idOrder ?? sale?.id ?? id),
          total: Number(sale?.total ?? 0),
          idTable: sale?.idTable ?? sale?.id_mesa ?? null,
          idClient: sale?.idClient ?? sale?.id_cliente ?? null
        };

        if (!this.yaPagado) {
          this.nuevoPago = {
            id_pedido: this.pedidoActual.idOrder ?? null,
            monto: this.pedidoActual.total ?? 0,
            tipo_pago: null,
            fecha_pago: this.nowAsDatetimeLocal()
          };
        }

        const idOrder = this.pedidoActual.idOrder;
        if (idOrder) this.cargarDetallesPedido(idOrder);
      },
      error: () => this.toast.mostrarMensaje('❌ Error al cargar el pedido')
    });
  }

  cargarPagosHechos(idOrder: number): void {
    this.api.getPaymentsByOrderId(idOrder).subscribe({
      next: (pagos: any[]) => {
        const list = Array.isArray(pagos) ? pagos : (pagos ? [pagos] : []);
        if (list.length > 0) {
          const p = list[0];

          const rawType = p?.paymentType ?? p?.tipo_pago;
          const tipoPago =
            rawType === 'Cash' ? 'Efectivo' :
            rawType === 'Card' ? 'Tarjeta' :
            rawType === 'Transfer' ? 'Transferencia' :
            String(rawType ?? 'Efectivo');

          const amount = Number(p?.amount ?? p?.monto ?? 0);
          const when = p?.paymentDate ?? p?.fecha_pago;

          this.yaPagado = true;
          this.nuevoPago = {
            id_pedido: Number(p?.idOrder ?? p?.id_pedido ?? idOrder),
            monto: amount,
            tipo_pago: tipoPago,
            fecha_pago: this.toDatetimeLocal(when || new Date())
          };
        } else {
          this.yaPagado = false;
        }
      },
      error: () => { this.yaPagado = false; }
    });
  }

  cargarDetallesPedido(idOrder: number): void {
    if (!idOrder) return;
    this.api.getOrderDetailsByOrderId(idOrder).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : (res ? [res] : []);
        this.detallesPedido = list as Detalle[];
      },
      error: () => { this.detallesPedido = []; }
    });
  }

  cargarProductos(): void {
    this.api.getProductos().subscribe({
      next: (resp) => { this.productos = Array.isArray(resp) ? resp : (resp ? [resp] : []); },
      error: () => this.toast.mostrarMensaje('❌ Error al obtener productos')
    });
  }

  /* ==================== Guardar pago ==================== */
registrarPago(): void {
  // Validar campos mínimos antes de enviar
  if (!this.pedidoActual.idOrder || !this.nuevoPago.tipo_pago || !this.nuevoPago.fecha_pago) {
    this.toast.mostrarMensaje('⚠️ Complete tipo y fecha de pago.');
    return;
  }

  const paymentType =
    this.nuevoPago.tipo_pago === 'Efectivo' ? 'Cash' :
    this.nuevoPago.tipo_pago === 'Tarjeta' ? 'Card' :
    this.nuevoPago.tipo_pago === 'Transferencia' ? 'Transfer' : 'Cash';

  const payload = {
    idOrder: this.pedidoActual.idOrder,
    amount: Number(this.pedidoActual.total ?? 0),
    paymentType,
    paymentDate: this.nuevoPago.fecha_pago ? new Date(this.nuevoPago.fecha_pago) : new Date()
  };

  this.api.createPayment(payload).subscribe({
    next: () => {
      this.toast.mostrarMensaje('✅ Pago registrado correctamente');
      const updatePayload = { status: 'Confirmed' };
      this.api.updateSale(this.pedidoActual.idOrder!, updatePayload).subscribe({
        next: () => {
          this.toast.mostrarMensaje('🟢 Pedido confirmado');
          this.cargarPagosHechos(this.pedidoActual.idOrder!);
          this.cargarPedidoExistente(this.pedidoActual.idOrder!);
        },
        error: (err) => {
          console.error(err);
          this.toast.mostrarMensaje('⚠️ Pago guardado, pero no se pudo confirmar el pedido.');
        }
      });
    },
    error: (error) => {
      this.toast.mostrarMensaje('❌ Error al registrar el pago');
      console.error(error);
    }
  });
}


  /* ==================== Helpers ==================== */
  obtenerNombreProducto(idProducto?: number | null): string {
    const idNum = Number(idProducto ?? 0);
    if (!idNum) return '';
    const p = this.productos.find(x =>
      Number(x?.idProduct ?? x?.id ?? x?.id_producto) === idNum
    );
    return p ? String(p.name ?? p.nombre ?? '') : '';
  }

  private nowAsDatetimeLocal(): string {
    return this.toDatetimeLocal(new Date());
  }

  private toDatetimeLocal(dateOrStr: Date | string): string {
    const d = (dateOrStr instanceof Date) ? dateOrStr : new Date(dateOrStr);
    if (isNaN(d.getTime())) return '';
    const tzOffset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - tzOffset * 60000);
    return local.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  }
}
