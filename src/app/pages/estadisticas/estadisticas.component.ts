import { Component, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-estadisticas',
  imports: [CommonModule,
    FormsModule,
    MatButtonModule,
    MatPaginatorModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './estadisticas.component.html',
  styleUrl: './estadisticas.component.scss'
})
export class EstadisticasComponent implements OnInit {
  estadisticasSemanales: {
    semana: string;
    producto: string;
    ganancia: number;
  }[] = [];

  gananciasSemanales: {
    semana: string;
    ganancia: number;
  }[] = [];

  gananciaMensual: number = 0;
  ventas: any[] = [];
  detallesPedido: any[] = [];
  productos: any[] = [];

  ventasCargadas = false;
  detallesCargados = false;
  productosCargados = false;
  fechaSeleccionada: Date = new Date();

  constructor(private apiService: ApiService, private router: Router) { }

  ngOnInit(): void {
    this.cargarVentas();
    this.cargarDetallesPedido();
    this.cargarProductos();
  }

  cargarVentas() {
    this.apiService.getSales().subscribe(response => {
      this.ventas = response;
      this.ventasCargadas = true;
      this.intentarGenerarEstadisticas();
    });
  }

  cargarDetallesPedido() {
    this.apiService.getOrderDetails().subscribe(response => {
      this.detallesPedido = response;
      this.detallesCargados = true;
      this.intentarGenerarEstadisticas();
    });
  }

  cargarProductos() {
    this.apiService.getProductos().subscribe(response => {
      this.productos = response;
      this.productosCargados = true;
      this.intentarGenerarEstadisticas();
    });
  }

  intentarGenerarEstadisticas() {
    if (this.ventasCargadas && this.detallesCargados && this.productosCargados) {
      this.agregarDetallesAVentas();
      this.generarEstadisticasPorSemana();
      this.generarGananciasPorSemana();
    }
  }

  agregarDetallesAVentas() {
    this.ventas.forEach(venta => {
      venta.detalles = this.detallesPedido.filter(det => det.id_pedido === venta.id);
    });
  }

  onMesSeleccionado(date: Date, picker: any) {
    this.fechaSeleccionada = new Date(date.getFullYear(), date.getMonth(), 1);
    picker.close();
    this.generarGananciasPorSemana();
    this.generarEstadisticasPorSemana();
  }

  generarGananciasPorSemana(): void {
    const semanas: any[][] = [[], [], [], []];

    const ventasFiltradas = this.ventas.filter(venta => {
      const fecha = new Date(venta.fecha_pedido);
      return (
        this.fechaSeleccionada &&
        fecha.getMonth() === this.fechaSeleccionada.getMonth() &&
        fecha.getFullYear() === this.fechaSeleccionada.getFullYear()
      );
    });

    for (const venta of ventasFiltradas) {
      const fecha = new Date(venta.fecha_pedido);
      const dia = fecha.getDate();

      let indexSemana = 0;
      if (dia >= 1 && dia <= 7) indexSemana = 0;
      else if (dia >= 8 && dia <= 14) indexSemana = 1;
      else if (dia >= 15 && dia <= 21) indexSemana = 2;
      else if (dia >= 22) indexSemana = 3;

      semanas[indexSemana].push(venta);
    }

    this.gananciasSemanales = semanas.map((ventasSemana, i) => {
      let gananciaSemana = 0;

      for (const venta of ventasSemana) {
        if (venta.estado !== 'Cancelado') {
          gananciaSemana += Number(venta.total || 0);
        }
      }

      return {
        semana: `Semana ${i + 1}`,
        ganancia: gananciaSemana
      };
    });

    this.gananciaMensual = this.gananciasSemanales.reduce(
      (suma, s) => suma + Number(s.ganancia || 0),
      0
    );
  }

  generarEstadisticasPorSemana(): void {
    const semanas: any[][] = [[], [], [], []];

    const ventasFiltradas = this.ventas.filter(venta => {
      const fecha = new Date(venta.fecha_pedido);
      return (
        this.fechaSeleccionada &&
        fecha.getMonth() === this.fechaSeleccionada.getMonth() &&
        fecha.getFullYear() === this.fechaSeleccionada.getFullYear()
      );
    });

    for (const venta of ventasFiltradas) {
      const fecha = new Date(venta.fecha_pedido);
      const dia = fecha.getDate();

      let indexSemana = 0;
      if (dia >= 1 && dia <= 7) indexSemana = 0;
      else if (dia >= 8 && dia <= 14) indexSemana = 1;
      else if (dia >= 15 && dia <= 21) indexSemana = 2;
      else if (dia >= 22) indexSemana = 3;

      semanas[indexSemana].push(venta);
    }

    this.estadisticasSemanales = semanas.map((ventasSemana, i) => {
      const productosContador: { [key: string]: number } = {};
      const productosGanancia: { [key: string]: number } = {};
      let gananciaSemana = 0;

      for (const venta of ventasSemana) {
        if (venta.estado !== 'Cancelado') {
          gananciaSemana += Number(venta.total || 0);

          for (const detalle of venta.detalles || []) {
            const nombre = this.obtenerNombreProducto(detalle.id_producto);
            productosContador[nombre] = (productosContador[nombre] || 0) + Number(detalle.cantidad || 0);
            productosGanancia[nombre] = (productosGanancia[nombre] || 0) + Number(detalle.subtotal || 0);
          }
        }
      }

      const productoMasVendido = Object.entries(productosContador)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin datos';

      const gananciaProductoMasVendido = Number(productosGanancia[productoMasVendido]) || 0;

      return {
        semana: `Semana ${i + 1}`,
        producto: productoMasVendido,
        ganancia: gananciaProductoMasVendido
      };
    });

    this.gananciaMensual = semanas.reduce((suma, ventasSemana) => {
      let totalSemana = 0;
      for (const venta of ventasSemana) {
        if (venta.estado !== 'Cancelado') {
          totalSemana += Number(venta.total || 0);
        }
      }
      return suma + totalSemana;
    }, 0);
  }

  obtenerNombreProducto(idProducto: number): string {
    const producto = this.productos.find(p => p.id === idProducto);
    return producto ? producto.nombre : 'Desconocido';
  }
}
