import { Component, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { ApiService } from '../../core/services/api.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { PageLoadingService } from '../../core/services/page-loading.service';

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatPaginatorModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    DecimalPipe
  ],
  templateUrl: './estadisticas.component.html',
  styleUrls: ['./estadisticas.component.scss']
})
export class EstadisticasComponent implements OnInit {

  colsTop = ['semana', 'producto', 'ganancia'];
  colsGan = ['semana', 'ganancia'];

  estadisticasSemanales: { semana: string; producto: string; ganancia: number; }[] = [];
  gananciasSemanales: { semana: string; ganancia: number; }[] = [];

  gananciaMensual = 0;
  ventas: any[] = [];
  detallesPedido: any[] = [];
  productos: any[] = [];

  ventasCargadas = false;
  detallesCargados = false;
  productosCargados = false;
  fechaSeleccionada: Date = new Date();

  // Control de UI / loader
  contentReady = false;
  private pendingLoads = 0;
  private started = false;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private pageLoading: PageLoadingService
  ) { }

  ngOnInit(): void {
    this.initLoad();
  }

  private initLoad(): void {
    // Arrancamos grupo de 3 cargas y deshabilitamos contenido
    this.contentReady = false;
    this.startLoadingGroup(3);

    this.cargarVentas();
    this.cargarDetallesPedido();
    this.cargarProductos();
  }

  // =================== CARGA ===================
  cargarVentas() {
    this.apiService.getSales().subscribe({
      next: (response: any[]) => {
        this.ventas = Array.isArray(response) ? response : (response ? [response] : []);
        this.ventasCargadas = true;
        this.intentarGenerarEstadisticas();
      },
      error: () => {
        this.ventas = [];
        this.ventasCargadas = true;
      },
      complete: () => this.finishOneLoad()
    });
  }

  cargarDetallesPedido() {
    this.apiService.getOrderDetails().subscribe({
      next: (response: any[]) => {
        this.detallesPedido = Array.isArray(response) ? response : (response ? [response] : []);
        this.detallesCargados = true;
        this.intentarGenerarEstadisticas();
      },
      error: () => {
        this.detallesPedido = [];
        this.detallesCargados = true;
      },
      complete: () => this.finishOneLoad()
    });
  }

  cargarProductos() {
    this.apiService.getProductos().subscribe({
      next: (response: any[]) => {
        this.productos = Array.isArray(response) ? response : (response ? [response] : []);
        this.productosCargados = true;
        this.intentarGenerarEstadisticas();
      },
      error: () => {
        this.productos = [];
        this.productosCargados = true;
      },
      complete: () => this.finishOneLoad()
    });
  }

  // ================= Utilidades =================
  private vIdOrder(v: any): number | null {
    return Number(v?.idOrder ?? v?.id ?? v?.id_pedido ?? null) || null;
  }
  private vDate(v: any): Date | null {
    const raw = v?.orderDate ?? v?.fecha_pedido ?? v?.fecha ?? v?.date ?? null;
    const d = raw ? new Date(raw) : null;
    return (d && !isNaN(d.getTime())) ? d : null;
  }
  private vStatus(v: any): string {
    return String(v?.status ?? v?.estado ?? '');
  }
  private vTotal(v: any): number {
    return Number(v?.total ?? 0);
  }

  private dOrderId(d: any): number | null {
    return Number(d?.idOrder ?? d?.order?.idOrder ?? d?.id_pedido ?? null) || null;
  }
  private dProductId(d: any): number | null {
    return Number(d?.idProduct ?? d?.product?.idProduct ?? d?.id_producto ?? d?.productId ?? null) || null;
  }
  private dQty(d: any): number {
    return Number(d?.quantity ?? d?.cantidad ?? 0);
  }
  private dSubtotal(d: any): number {
    return Number(d?.subtotal ?? 0);
  }

  private pNameById(id: number | null): string {
    if (!id) return 'Desconocido';
    const p = this.productos.find(x =>
      Number(x?.idProduct ?? x?.id ?? x?.id_producto) === Number(id)
    );
    return p ? String(p?.name ?? p?.nombre ?? 'Desconocido') : 'Desconocido';
  }

  intentarGenerarEstadisticas() {
    if (this.ventasCargadas && this.detallesCargados && this.productosCargados) {
      this.agregarDetallesAVentas();
      this.generarEstadisticasPorSemana();
      this.generarGananciasPorSemana();
    }
  }

  agregarDetallesAVentas() {
    const byOrder: Record<number, any[]> = {};
    for (const det of this.detallesPedido) {
      const key = this.dOrderId(det);
      if (!key) continue;
      (byOrder[key] ||= []).push(det);
    }
    for (const v of this.ventas) {
      const id = this.vIdOrder(v);
      (v as any).detalles = id ? (byOrder[id] ?? []) : [];
    }
  }

  onMesSeleccionado(date: Date, picker: any) {
    this.fechaSeleccionada = new Date(date.getFullYear(), date.getMonth(), 1);
    picker.close();
    this.generarGananciasPorSemana();
    this.generarEstadisticasPorSemana();
  }

  private ventasDelMes(): any[] {
    return this.ventas.filter(v => {
      const d = this.vDate(v);
      return d
        && d.getMonth() === this.fechaSeleccionada.getMonth()
        && d.getFullYear() === this.fechaSeleccionada.getFullYear();
    });
  }

  private bucketSemanas(ventas: any[]): any[][] {
    const semanas: any[][] = [[], [], [], []];
    for (const v of ventas) {
      const d = this.vDate(v);
      if (!d) continue;
      const day = d.getDate();
      let idx = 0;
      if (day <= 7) idx = 0;
      else if (day <= 14) idx = 1;
      else if (day <= 21) idx = 2;
      else idx = 3;
      semanas[idx].push(v);
    }
    return semanas;
  }

  generarGananciasPorSemana(): void {
    const semanas = this.bucketSemanas(this.ventasDelMes());

    this.gananciasSemanales = semanas.map((ventasSemana, i) => {
      let ganancia = 0;
      for (const v of ventasSemana) {
        if (this.isConfirmed(v)) {
          ganancia += this.vTotal(v);
        }
      }
      return { semana: `Semana ${i + 1}`, ganancia };
    });

    this.gananciaMensual = this.gananciasSemanales
      .reduce((acc, s) => acc + Number(s.ganancia || 0), 0);
  }

  generarEstadisticasPorSemana(): void {
    const semanas = this.bucketSemanas(this.ventasDelMes());

    this.estadisticasSemanales = semanas.map((ventasSemana, i) => {
      const contador: Record<string, number> = {};
      const porGanancia: Record<string, number> = {};

      for (const v of ventasSemana) {
        if (!this.isConfirmed(v)) continue;

        const detalles = (v as any).detalles ?? [];
        for (const det of detalles) {
          const pid = this.dProductId(det);
          const nombre = this.pNameById(pid);
          contador[nombre] = (contador[nombre] ?? 0) + this.dQty(det);
          porGanancia[nombre] = (porGanancia[nombre] ?? 0) + this.dSubtotal(det);
        }
      }

      const productoMasVendido = Object.entries(contador)
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Sin datos';
      const gananciaProducto = Number(porGanancia[productoMasVendido] ?? 0);

      return { semana: `Semana ${i + 1}`, producto: productoMasVendido, ganancia: gananciaProducto };
    });

    this.gananciaMensual = this.gananciasSemanales
      .reduce((acc, s) => acc + Number(s.ganancia || 0), 0);
  }

  obtenerNombreProducto(idProducto: number): string {
    return this.pNameById(idProducto);
  }

  private isConfirmed(v: any): boolean {
    const s = this.vStatus(v);
    return s === 'Confirmed';
  }

  // ====== Helpers de pageLoading en grupo ======
  private startLoadingGroup(n: number) {
    this.pendingLoads = n;
    this.started = true;
    this.pageLoading.start();
  }

  private finishOneLoad() {
    if (!this.started) return;
    this.pendingLoads = Math.max(0, this.pendingLoads - 1);
    if (this.pendingLoads === 0) {
      this.started = false;
      this.pageLoading.stop();
      this.contentReady = true;
    }
  }
}