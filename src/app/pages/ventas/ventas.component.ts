import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

import { ApiService } from '../../core/services/api.service';

/* ==================== MODELOS FRONT (simples) ==================== */
interface OrderDetail {
  idDetail: number;
  idOrder: number;
  idProduct: number;
  quantity: number;
  subtotal: number;
}

interface Order {
  idOrder: number;
  status: 'Pending' | 'Confirmed' | 'Canceled';
  total: number;
  orderDate: string;   // 'yyyy-MM-dd'
  orderTime?: string;  // 'HH:mm:ss'
  details: OrderDetail[];
  alreadyPaid?: boolean;
}

interface ProductLite {
  idProduct: number;
  name: string;
}

/* ================================================================ */

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatPaginatorModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './ventas.component.html',
  styleUrls: ['./ventas.component.scss']
})
export class VentasComponent implements OnInit {

  /* ==================== ESTADO UI ==================== */
  selectedDate: Date = new Date();
  displayedColumns: string[] = ['number', 'producto', 'estado', 'ganancia', 'opciones'];

  dataSource = new MatTableDataSource<Order>([]);
  sales: Order[] = [];
  products: ProductLite[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private apiService: ApiService,
    private router: Router
  ) { }

  /* ==================== CICLO DE VIDA ==================== */
  ngOnInit(): void {
    this.loadProducts();
    this.loadSales();
  }

  /* ==================== CARGA DE DATOS ==================== */
  loadSales(): void {
    const targetIsoLima = this.toIsoDateInLima(this.selectedDate); // 'yyyy-MM-dd' en zona Lima

    this.apiService.getSales().subscribe({
      next: (data: any[]) => {
        // Normaliza SIN crear Date desde 'yyyy-MM-dd'
        const normalized: Order[] = (data || []).map((v: any) => ({
          idOrder: Number(v.idOrder ?? v.id),
          status: (v.status ?? 'Pending') as Order['status'],
          total: Number(v.total ?? 0),
          orderDate: String(v.orderDate ?? v.fecha_pedido ?? new Date().toISOString().slice(0, 10)), // 'yyyy-MM-dd'
          orderTime: String(v.orderTime ?? v.hora_pedido ?? '00:00:00'),                               // 'HH:mm:ss[.SSS]'
          details: []
        }));

        // Filtra comparando 'yyyy-MM-dd' (evita crear Date)
        this.sales = normalized
          .filter(v => (v.orderDate === targetIsoLima))
          .sort((a, b) => this.localMillis(a.orderDate, a.orderTime) - this.localMillis(b.orderDate, b.orderTime))
          .reverse(); // más recientes primero

        // Carga detalles/pagos
        this.sales.forEach((sale) => {
          this.apiService.getOrderDetailsByOrderId(sale.idOrder).subscribe({
            next: (details: any[]) => {
              sale.details = (details || []).map(d => ({
                idDetail: Number(d.idDetail ?? d.id_detalle ?? 0),
                idOrder: Number(d.idOrder ?? d.id_pedido ?? sale.idOrder),
                idProduct: Number(d.idProduct ?? d.id_producto ?? 0),
                quantity: Number(d.quantity ?? d.cantidad ?? 0),
                subtotal: Number(d.subtotal ?? 0)
              }));
              this.refreshCurrentPage();
            },
            error: () => { sale.details = []; this.refreshCurrentPage(); }
          });

          this.loadPaymentsDone(sale);
        });

        // Primera página
        this.dataSource.data = this.sales.slice(0, 10);
        if (this.paginator) {
          this.dataSource.paginator = this.paginator;
          this.paginator.length = this.sales.length;
          this.paginator.firstPage();
        }
      },
      error: (err) => {
        console.error('Error loading sales:', err);
        this.sales = [];
        this.dataSource.data = [];
      }
    });
  }

  loadPaymentsDone(sale: Order): void {
    this.apiService.getPaymentsByOrderId(sale.idOrder).subscribe({
      next: (payments: any[]) => sale.alreadyPaid = !!payments && payments.length > 0,
      error: () => sale.alreadyPaid = false
    });
  }

  loadProducts(): void {
    this.apiService.getProductos().subscribe({
      next: (resp: any[]) => {
        const arr = Array.isArray(resp) ? resp : (resp ? [resp] : []);
        this.products = arr.map((raw: any) => ({
          idProduct: Number(raw?.idProduct ?? raw?.id ?? raw?.idProduct),
          name: String(raw?.name ?? raw?.nombre ?? '')
        }));
      },
      error: () => this.products = []
    });
  }

  /* ==================== HELPERS ==================== */
  getLimitedDetails(sale: Order): string {
    if (!sale.details || sale.details.length === 0 || sale.status === 'Canceled') return '';
    let text = sale.details
      .map(d => `${this.getProductName(d.idProduct)} x${d.quantity}`)
      .join(', ');
    if (text.length > 40) text = text.slice(0, 40) + '...';
    return text;
  }

  getProductName(idProduct: number): string {
    const p = this.products.find(x => x.idProduct === idProduct);
    return p ? p.name : '';
  }

  private toIsoDateInLima(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', { // en-CA => yyyy-MM-dd
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  }

  /** Convierte orderDate ('yyyy-MM-dd') + orderTime ('HH:mm:ss[.SSS]') a millis *locales* (sin UTC). */
  private localMillis(orderDate: string, orderTime?: string): number {
    const [y, m, d] = orderDate.split('-').map(n => parseInt(n, 10));
    let hh = 0, mm = 0, ss = 0, ms = 0;
    if (orderTime) {
      const [hms, msPart] = orderTime.split('.');
      const [h, m2, s] = (hms || '').split(':').map(n => parseInt(n || '0', 10));
      hh = h || 0; mm = m2 || 0; ss = s || 0; ms = msPart ? parseInt(msPart, 10) : 0;
    }
    // Construye Date en *hora local* (usuario en America/Lima según tu app)
    return new Date(y, (m - 1), d, hh, mm, ss, ms).getTime();
  }

  /* ==================== EVENTOS UI ==================== */
  filterByDate(): void {
    this.loadSales();
  }

  onPage(event: any): void {
    const start = event.pageIndex * event.pageSize;
    const end = start + event.pageSize;
    this.dataSource.data = this.sales.slice(start, end);
  }

  private refreshCurrentPage(): void {
    const pageIndex = this.paginator?.pageIndex ?? 0;
    const pageSize = this.paginator?.pageSize ?? 10;
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    this.dataSource.data = this.sales.slice(start, end);
  }

  /* ==================== NAVEGACIÓN ==================== */
  registerNewSale(): void {
    this.router.navigate(['/view/ventas/registrar-venta']);
  }

  editSale(sale: Order): void {
    this.router.navigate([`/view/ventas/editar/${sale.idOrder}`]);
  }

  paySale(sale: Order): void {
    this.router.navigate([`/view/ventas/pagos/${sale.idOrder}`]);
  }
}
