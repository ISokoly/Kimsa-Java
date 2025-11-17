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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { PageLoadingService } from '../../core/services/page-loading.service';

// ===== CHART JS =====
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

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
    MatButtonToggleModule,
    DecimalPipe
  ],
  templateUrl: './estadisticas.component.html',
  styleUrls: ['./estadisticas.component.scss']
})
export class EstadisticasComponent implements OnInit {

  private _vista: 'tablas' | 'graficos' = 'tablas';
  get vista(): 'tablas' | 'graficos' { return this._vista; }
  set vista(v: 'tablas' | 'graficos') {
    this._vista = v;
    if (v === 'graficos') {
      setTimeout(() => this.tryDrawCharts(), 80);
    } else {
      this.destroyCharts();
    }
  }

  colsTop = ['semana', 'producto', 'ganancia'];
  colsGan = ['semana', 'ganancia'];

  estadisticasSemanales: { semana: string; producto: string; ganancia: number; }[] = [];
  gananciasSemanales: { semana: string; ganancia: number; }[] = [];
  labelsSemanas: string[] = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"];

  gananciaMensual = 0;
  ventas: any[] = [];
  detallesPedido: any[] = [];
  productos: any[] = [];
  productosDelMes: string[] = [];
  mapaVentasPorProducto: Record<string, number[]> = {};

  chartLineaProductos: any;

  ventasCargadas = false;
  detallesCargados = false;
  productosCargados = false;
  fechaSeleccionada: Date = new Date();

  contentReady = false;
  private pendingLoads = 0;
  private started = false;

  // Instancias Chart.js
  private chartGanancias: Chart | null = null;
  private chartProductos: Chart | null = null;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private pageLoading: PageLoadingService
  ) { }

  ngOnInit(): void {
    this.initLoad();
  }

  private initLoad(): void {
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
      this.generarLineaProductosPorMes();
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
    this.generarLineaProductosPorMes();
    if (this.vista === 'graficos') {
      setTimeout(() => this.tryDrawCharts(), 80);
    }
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

    if (this.vista === 'graficos') {
      setTimeout(() => this.tryDrawCharts(), 80);
    }
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

    if (this.vista === 'graficos') {
      setTimeout(() => this.tryDrawCharts(), 80);
    }
  }

  obtenerNombreProducto(idProducto: number): string {
    return this.pNameById(idProducto);
  }

  private isConfirmed(v: any): boolean {
    const s = this.vStatus(v);
    return s === 'Confirmed';
  }

  // ====== CHARTS ======
  private tryDrawCharts(): void {
    if (!this.contentReady) return;

    const c1 = document.getElementById('chartGanancias') as HTMLCanvasElement | null;
    const c2 = document.getElementById('chartProductos') as HTMLCanvasElement | null;
    const c3 = document.getElementById('chartLineaProductos') as HTMLCanvasElement | null;

    // si no existen todavía, reintentar
    if (!c1 || !c2 || !c3) {
      setTimeout(() => this.tryDrawCharts(), 120);
      return;
    }

    this.drawGananciasChart(c1);
    this.drawProductosChart(c2);
    this.renderLineaProductos(); // ← 💥 AQUI ESTABA EL PROBLEMA
  }


  private drawGananciasChart(canvas: HTMLCanvasElement) {
    if (!canvas) return;
    if (this.chartGanancias) this.chartGanancias.destroy();

    const labels = this.gananciasSemanales.map(x => x.semana);
    const data = this.gananciasSemanales.map(x => Number(x.ganancia || 0));

    // evitar dibujar si no hay datos
    if (labels.length === 0) return;

    this.chartGanancias = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Ganancias (S/)',
          data,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      } as any
    });
  }

  private drawProductosChart(canvas: HTMLCanvasElement) {
    if (!canvas) return;
    if (this.chartProductos) this.chartProductos.destroy();

    const semanas = this.bucketSemanas(this.ventasDelMes()); // 4 semanas
    const labels: string[] = [];
    const data: number[] = [];
    const colors: string[] = [];

    semanas.forEach((ventasSemana, i) => {
      const semanaLabel = `Semana ${i + 1}`;
      const contador: Record<string, number> = {};

      // Contamos las cantidades por producto en esta semana
      for (const v of ventasSemana) {
        if (!this.isConfirmed(v)) continue;
        const detalles = (v as any).detalles ?? [];
        for (const det of detalles) {
          const pid = this.dProductId(det);
          const nombre = this.pNameById(pid);
          const cantidad = this.dQty(det);
          contador[nombre] = (contador[nombre] ?? 0) + cantidad;
        }
      }

      // Sacamos el producto más vendido de la semana
      const topProducto = Object.entries(contador)
        .sort((a, b) => b[1] - a[1])[0];

      if (topProducto) {
        labels.push(`${topProducto[0]} - ${semanaLabel}`);
        data.push(topProducto[1]);
        colors.push(`hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`);
      }
    });

    if (labels.length === 0) return;

    this.chartProductos = new Chart(canvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: '#fff',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          title: {
            display: true,
            text: 'Producto más vendido por semana'
          }
        }
      } as any
    });
  }

  private destroyCharts() {
    if (this.chartGanancias) {
      this.chartGanancias.destroy();
      this.chartGanancias = null;
    }
    if (this.chartProductos) {
      this.chartProductos.destroy();
      this.chartProductos = null;
    }
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

      if (this.vista === 'graficos') {
        setTimeout(() => this.tryDrawCharts(), 100);
      }
    }
  }

  generarLineaProductosPorMes() {
    const semanas = this.bucketSemanas(this.ventasDelMes());

    this.productosDelMes = [];
    this.mapaVentasPorProducto = {};

    semanas.forEach((ventasSemana, semanaIndex) => {
      for (const v of ventasSemana) {
        if (!this.isConfirmed(v)) continue;

        const detalles = (v as any).detalles ?? [];

        for (const det of detalles) {
          const pid = this.dProductId(det);
          const nombre = this.pNameById(pid);
          const qty = this.dQty(det);

          if (!this.productosDelMes.includes(nombre)) {
            this.productosDelMes.push(nombre);
            this.mapaVentasPorProducto[nombre] = [0, 0, 0, 0];
          }

          this.mapaVentasPorProducto[nombre][semanaIndex] += qty;
        }
      }
    });

    this.renderLineaProductos();
  }

  renderLineaProductos(): void {
    const canvas = document.getElementById('chartLineaProductos') as HTMLCanvasElement | null;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.chartLineaProductos) {
      this.chartLineaProductos.destroy();
    }

    // === Año y mes actual (del datepicker) ===
    const anio = this.fechaSeleccionada.getFullYear();
    const mes = this.fechaSeleccionada.getMonth(); // 0-11

    // === Número de días del mes ===
    const diasDelMes = new Date(anio, mes + 1, 0).getDate();

    // === Labels: 1..n ===
    const labels = Array.from({ length: diasDelMes }, (_, i) => (i + 1).toString());

    // === Mapa producto → [ventas por día] ===
    const productosMap: Record<string, number[]> = {};

    // Solo ventas del mes seleccionado
    const ventasMes = this.ventasDelMes();

    for (const venta of ventasMes) {
      const fecha = this.vDate(venta);
      if (!fecha) continue;

      const dia = fecha.getDate();
      const detalles = (venta as any).detalles ?? [];

      for (const det of detalles) {
        const pid = this.dProductId(det);
        const nombreProducto = this.pNameById(pid);
        const cantidad = this.dQty(det);

        if (!productosMap[nombreProducto]) {
          productosMap[nombreProducto] = Array(diasDelMes).fill(0);
        }

        productosMap[nombreProducto][dia - 1] += cantidad;
      }
    }

    const randomColor = () =>
      `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;

    const datasets = Object.keys(productosMap).map((prod) => ({
      label: prod,
      data: productosMap[prod],
      borderColor: randomColor(),
      fill: false,
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6
    }));

    this.chartLineaProductos = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true },
          title: {
            display: true,
            text: 'Ventas por Día del Mes'
          }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  colorAleatorio(): string {
    return `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
  }
}
