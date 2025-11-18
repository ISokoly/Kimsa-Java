import { Component, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { ApiService } from '../../../core/services/api.service';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { PageLoadingService } from '../../../core/services/page-loading.service';
import { firstValueFrom } from 'rxjs';

type Detalle = {
  idDetail?: number;
  idOrder?: number;
  idProduct?: number;
  quantity?: number;
  subtotal?: number;
};

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule, DecimalPipe, MatTableModule],
  templateUrl: './pagos.component.html',
  styleUrls: ['./pagos.component.scss']
})
export class PagosComponent implements OnInit {
  contentReady = false;
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
    idOrder: null as number | null,
    amount: 0,
    paymentType: null as string | null,   // 'Efectivo' | 'Tarjeta' | 'Transferencia'
    paymentDate: ''                       // YYYY-MM-DDTHH:mm
  };

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private toast: ToastService,
    private pageLoading: PageLoadingService, private router: Router
  ) { }



  async ngOnInit(): Promise<void> {
    await this.initLoad();
  }

  private async initLoad(): Promise<void> {
    this.contentReady = false;
    this.pageLoading.start();
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;
    const id = +idParam;
    try {
      await Promise.all([
        this.cargarProductos(),
        this.cargarPagosHechos(id),
        this.cargarPedidoExistente(id)
      ]);
    } finally {
      this.contentReady = true;
      this.pageLoading.stop();
    }
  }

  /* ==================== Carga (Promesas) ==================== */

  private async cargarPedidoExistente(id: number): Promise<void> {
    try {
      const sale: any = await firstValueFrom(this.api.getSaleById(id));
      this.pedidoActual = {
        idOrder: Number(sale?.idOrder ?? sale?.id ?? id),
        total: Number(sale?.total ?? 0),
        idTable: sale?.idTable ?? sale?.id_mesa ?? null,
        idClient: sale?.idClient ?? sale?.id_cliente ?? null
      };

      // Si aún no había pagos cargados, inicializa nuevoPago con los datos del pedido
      if (!this.yaPagado) {
        this.nuevoPago = {
          idOrder: this.pedidoActual.idOrder ?? null,
          amount: this.pedidoActual.total ?? 0,
          paymentType: null,
          paymentDate: this.nowAsDatetimeLocal()
        };
      }

      if (this.pedidoActual.idOrder) {
        await this.cargarDetallesPedido(this.pedidoActual.idOrder);
      }
    } catch {
      this.toast.mostrarMensaje('❌ Error al cargar el pedido');
    }
  }

  private async cargarPagosHechos(idOrder: number): Promise<void> {
    try {
      const pagos: any[] = await firstValueFrom(this.api.getPaymentsByOrderId(idOrder));
      const list = Array.isArray(pagos) ? pagos : (pagos ? [pagos] : []);
      if (list.length > 0) {
        const p = list[0];

        const rawType = p?.paymentType;
        const tipoPago =
          rawType === 'Cash' ? 'Efectivo' :
            rawType === 'Card' ? 'Tarjeta' :
              rawType === 'Transfer' ? 'Transferencia' :
                String(rawType ?? 'Efectivo');

        const amount = Number(p?.amount ?? 0);
        const when = p?.paymentDate;

        this.yaPagado = true;
        this.nuevoPago = {
          idOrder: Number(p?.idOrder ?? idOrder),
          amount,
          paymentType: tipoPago,
          paymentDate: this.toDatetimeLocal(when || new Date())
        };
      } else {
        this.yaPagado = false;
      }
    } catch {
      this.yaPagado = false;
      // No mostramos error aquí para no saturar; el usuario puede no tener pagos previos
    }
  }

  private async cargarDetallesPedido(idOrder: number): Promise<void> {
    try {
      const res = await firstValueFrom(this.api.getOrderDetailsByOrderId(idOrder));
      const list = Array.isArray(res) ? res : (res ? [res] : []);
      this.detallesPedido = list as Detalle[];
    } catch {
      this.detallesPedido = [];
      // Detalles pueden fallar sin bloquear la vista
    }
  }

  private async cargarProductos(): Promise<void> {
    try {
      const resp = await firstValueFrom(this.api.getProductos());
      this.productos = Array.isArray(resp) ? resp : (resp ? [resp] : []);
    } catch {
      this.productos = [];
      this.toast.mostrarMensaje('❌ Error al obtener productos');
    }
  }

  /* ==================== Guardar pago ==================== */
  registrarPago(): void {
    if (!this.pedidoActual.idOrder || !this.nuevoPago.paymentType || !this.nuevoPago.paymentDate) {
      this.toast.mostrarMensaje('⚠️ Complete tipo y fecha de pago.');
      return;
    }

    const paymentType =
      this.nuevoPago.paymentType === 'Efectivo' ? 'Cash' :
        this.nuevoPago.paymentType === 'Tarjeta' ? 'Card' :
          this.nuevoPago.paymentType === 'Transferencia' ? 'Transfer' : 'Cash';

    const payload = {
      idOrder: this.pedidoActual.idOrder,
      amount: Number(this.pedidoActual.total ?? 0),
      paymentType,
      paymentDate: this.nuevoPago.paymentDate ? new Date(this.nuevoPago.paymentDate) : new Date()
    };

    // Opcional: mostrar spinner corto al guardar
    const flicker = setTimeout(() => this.pageLoading.start(), 120);

    this.api.createPayment(payload).subscribe({
      next: () => {
        this.toast.mostrarMensaje('✅ Pago registrado correctamente');
        const updatePayload = { status: 'Confirmed' };
        this.api.updateSale(this.pedidoActual.idOrder!, updatePayload).subscribe({
          next: async () => {
            await this.cargarPagosHechos(this.pedidoActual.idOrder!);
            await this.cargarPedidoExistente(this.pedidoActual.idOrder!);
          },
          error: (err) => {
            console.error(err);
            this.toast.mostrarMensaje('⚠️ Pago guardado, pero no se pudo confirmar el pedido.');
          },
          complete: () => { clearTimeout(flicker); this.pageLoading.stop(); }
        });
      },
      error: (error) => {
        clearTimeout(flicker);
        this.pageLoading.stop();
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
    // Nota: si necesitas TZ específica (p.ej. Lima), podrías formatear con Intl y construir el string.
  }

  formatNumber(value: number | null | undefined, decimals: number = 2): string {
    if (value == null || isNaN(value)) return '0.00';
    return value.toFixed(decimals);
  }

  goBack(): void {
    this.router.navigate(['/view/ventas']);
  }
}
