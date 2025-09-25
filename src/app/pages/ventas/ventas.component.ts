import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { ApiService } from '../../core/services/api.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatPaginatorModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    FormsModule
  ],
  templateUrl: './ventas.component.html',
  styleUrls: ['./ventas.component.scss']
})
export class VentasComponent implements OnInit {
i: number = 0;
  get fecha(): string {
    return this.fechaSeleccionada
      ? this.fechaSeleccionada.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';
  }
  fechaSeleccionada: Date = new Date();
  columnas = ['number', 'producto', 'estado', 'ganancia', 'opciones'];

  dataSource = new MatTableDataSource<any>([]);
  ventas: any[] = [];
  productos: any[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(private apiService: ApiService, private router: Router) { }

  ngOnInit(): void {
    this.cargarVentas();
    this.cargarProductos();
  }
cargarVentas(): void {
  const fechaFiltrada = this.formatFecha(this.fechaSeleccionada);

  this.apiService.getVentas().subscribe({
    next: (data: any[]) => {
      this.ventas = (data || [])
        .filter(v => this.formatFecha(new Date(v.fecha_pedido)) === fechaFiltrada)
        .map(v => ({
          id: v.id,
          estado: v.estado,
          total: v.total,
          fecha_pedido: v.fecha_pedido,
          detalles: []
        }))
        // Ordenar ventas de la más reciente a la más antigua
        .sort((a, b) => new Date(b.fecha_pedido).getTime() - new Date(a.fecha_pedido).getTime());

      this.ventas.forEach((venta) => {
        this.apiService.getDetallePedidoByIdPedido(venta.id).subscribe({
          next: (detalles) => {
            venta.detalles = detalles || [];
            // Actualiza dataSource sin perder la paginación
            this.dataSource.data = this.ventas.slice(0, 10);
          },
          error: (err) => {
            console.error('Error al obtener detalles de la venta', err);
            venta.detalles = [];
            this.dataSource.data = this.ventas.slice(0, 10);
          }
        });
        this.cargarPagosHechos(venta);
      });

      // Asignar sólo los primeros 10 para la primera carga
      this.dataSource.data = this.ventas.slice(0, 10);
      if (this.paginator) {
        this.paginator.length = this.ventas.length;
        this.paginator.firstPage();
      }
    },
    error: (err) => {
      console.error('Error al cargar ventas:', err);
      this.ventas = [{
        id: 0,
        estado: 'error',
        total: 0,
        fecha_pedido: fechaFiltrada,
        detalles: []
      }];
      this.dataSource.data = this.ventas;
    }
  });
}


  cargarPagosHechos(venta: any): void {
    this.apiService.getPagosByIdPedido(venta.id).subscribe((pagos: any[]) => {
      venta.yaPagado = pagos && pagos.length > 0;
    });
  }

  obtenerDetallesLimitados(venta: any): string {
    let detallesStr = '';
    if (venta.detalles && venta.detalles.length > 0) {
      detallesStr = venta.detalles
        .map((detalle: any, i: number) => `${this.obtenerNombreProducto(detalle.id_producto)} x${detalle.cantidad}`)
        .join(', ');

      if (detallesStr.length > 40) {
        detallesStr = detallesStr.slice(0, 40) + '...';
      }
    }
    return detallesStr;
  }

  cargarProductos() {
    this.apiService.getProductos().subscribe(response => {
      this.productos = response;
    });
  }

  obtenerNombreProducto(idProducto: number): string {
    const producto = this.productos.find(p => p.id === idProducto);
    return producto ? producto.nombre : '';
  }

  formatFecha(fecha: Date): string {
    return fecha.toLocaleDateString('es-PE', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  filtrarVentasPorFecha(): void {
    this.cargarVentas();
  }

  cambiarPagina(event: any): void {
    const start = event.pageIndex * event.pageSize;
    const end = start + event.pageSize;
    this.dataSource.data = this.ventas.slice(start, end);
  }

  registrarNuevaVenta(): void {
    this.router.navigate(['/view/ventas/registrar-venta']);
  }

  editarVenta(venta: any): void {
    this.router.navigate([`/view/ventas/editar/${venta.id}`]);
  }

  pagarVenta(venta: any): void {
    this.router.navigate([`/view/ventas/pagos/${venta.id}`]);
  }
}
