import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';

import { ApiService } from '../../core/services/api.service';

/* === Modelos front === */
interface OrderDetail {
  idDetail: number;
  idOrder: number;
  idProduct: number;
  quantity: number;
  subtotal: number;
}
type OrderStatus = 'Pending' | 'Confirmed' | 'Canceled';
interface Order {
  idOrder: number;
  status: OrderStatus;
  total: number;
  orderDate: string;
  orderTime?: string;
  details: OrderDetail[];
  alreadyPaid?: boolean;
}
interface ProductLite { idProduct: number; name: string; }

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [
    CommonModule,            // 👈 necesario para *ngFor en chips
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatPaginatorModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatChipsModule
  ],
  templateUrl: './ventas.component.html',
  styleUrls: ['./ventas.component.scss']
})
export class VentasComponent implements OnInit {

  /* === Estado UI === */
  selectedDate: Date = new Date();
  displayedColumns: string[] = ['number', 'producto', 'estado', 'ganancia', 'opciones'];

  dataSource = new MatTableDataSource<Order>([]);
  sales: Order[] = [];
  products: ProductLite[] = [];

  // Filtros
  statusFilter: 'All' | OrderStatus = 'All';

  productQuery = '';
  selectedProductNames: string[] = [];   // 👈 por nombre
  productSuggestions: string[] = [];     // 👈 sugerencias por nombre

  private filteredSales: Order[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(private api: ApiService, private router: Router) { }

  /* === Ciclo de vida === */
  ngOnInit(): void {
    this.loadProducts();
    this.loadSales();
  }

  /* === Carga de datos === */
  loadSales(): void {
    const targetIso = this.isoInLima(this.selectedDate);

    this.api.getSales().subscribe({
      next: (raw: any[]) => {
        const base: Order[] = (raw || []).map(v => ({
          idOrder: Number(v.idOrder ?? v.id),
          status: String(v.status ?? 'Pending') as OrderStatus,
          total: Number(v.total ?? 0),
          orderDate: String(v.orderDate ?? v.fecha_pedido ?? new Date().toISOString().slice(0, 10)),
          orderTime: String(v.orderTime ?? v.hora_pedido ?? '00:00:00'),
          details: []
        }));

        this.sales = base
          .filter(v => v.orderDate === targetIso)
          .sort((a, b) => this.localMillis(b.orderDate, b.orderTime) - this.localMillis(a.orderDate, a.orderTime)); // recientes

        // Detalles + pagos, y re-aplicar filtros cuando llegan
        this.sales.forEach(sale => {
          this.api.getOrderDetailsByOrderId(sale.idOrder).subscribe({
            next: (details: any[]) => {
              sale.details = (details || []).map(d => ({
                idDetail: Number(d.idDetail ?? d.id_detalle ?? 0),
                idOrder: Number(d.idOrder ?? d.id_pedido ?? sale.idOrder),
                idProduct: Number(d.idProduct ?? d.id_producto ?? 0),
                quantity: Number(d.quantity ?? d.cantidad ?? 0),
                subtotal: Number(d.subtotal ?? 0)
              }));
              this.applyFilters();
            },
            error: () => { sale.details = []; this.applyFilters(); }
          });

          this.api.getPaymentsByOrderId(sale.idOrder).subscribe({
            next: (p: any[]) => { sale.alreadyPaid = !!p && p.length > 0; this.applyFilters(); },
            error: () => { sale.alreadyPaid = false; this.applyFilters(); }
          });
        });

        if (this.paginator) this.dataSource.paginator = this.paginator;
        if (this.paginator) this.paginator.firstPage();
        this.applyFilters();
      },
      error: () => { this.sales = []; this.applyFilters(); }
    });
  }

  loadProducts(): void {
    this.api.getProductos().subscribe({
      next: (resp: any[]) => {
        const arr = Array.isArray(resp) ? resp : (resp ? [resp] : []);
        this.products = arr.map(raw => ({
          idProduct: Number(raw?.idProduct ?? raw?.id ?? raw?.idProduct),
          name: String(raw?.name ?? raw?.nombre ?? '')
        }));
        this.recomputeSuggestions();
      },
      error: () => { this.products = []; this.recomputeSuggestions(); }
    });
  }

  /* === Filtros & paginación === */
  onStatusChange(): void {
    if (this.paginator) this.paginator.firstPage();
    this.applyFilters();
  }

  // Acepta string/any y evita "val.includes is not a function"
  onProductFilterInput(val: any): void {
    const value = (val ?? '').toString();

    // Soporte de coma: agrega términos completos y deja el último en curso
    if (value.includes(',')) {
      const parts = value.split(',').map((s: string) => s.trim()).filter(Boolean);
      for (let i = 0; i < parts.length - 1; i++) this.addProductByTerm(parts[i]);
      this.productQuery = parts[parts.length - 1] || '';
    } else {
      this.productQuery = value;
    }
    this.recomputeSuggestions();
  }

  onProductSuggestionSelected(name: string): void {
    this.addProductName(name);
  }

  removeSelectedProduct(name: string): void {
    this.selectedProductNames = this.selectedProductNames.filter(n => n.toLowerCase() !== name.toLowerCase());
    this.recomputeSuggestions();
    this.applyFilters();
  }

  clearAllFilters(): void {
    this.statusFilter = 'All';
    this.productQuery = '';
    this.selectedProductNames = [];
    this.recomputeSuggestions();
    if (this.paginator) this.paginator.firstPage();
    this.applyFilters();
  }

  onPage(e: any): void {
    this.sliceToPage(e.pageIndex, e.pageSize);
  }

  private applyFilters(): void {
    let arr = this.sales;

    if (this.statusFilter !== 'All') {
      arr = arr.filter(s => s.status === this.statusFilter);
    }

    if (this.selectedProductNames.length > 0) {
      const selected = this.selectedProductNames.map(n => n.toLowerCase().trim());
      arr = arr.filter(sale => this.saleHasAllSelectedProducts(sale, selected));
    }

    this.filteredSales = arr;

    const pageIndex = this.paginator?.pageIndex ?? 0;
    const pageSize = this.paginator?.pageSize ?? 10;
    this.sliceToPage(pageIndex, pageSize);
    if (this.paginator) this.paginator.length = this.filteredSales.length;
  }

  private saleHasAllSelectedProducts(sale: Order, selectedLowerNames: string[]): boolean {
    if (!sale.details || sale.details.length === 0) return false;

    // Set de nombres (lowercase) de los productos en esta venta
    const saleNames = new Set(
      sale.details
        .map(d => this.getProductName(d.idProduct)?.toLowerCase().trim())
        .filter(Boolean) as string[]
    );

    // Verifica que todos los seleccionados estén presentes
    return selectedLowerNames.every(name => saleNames.has(name));
  }

  private sliceToPage(pageIndex: number, pageSize: number): void {
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    this.dataSource.data = this.filteredSales.slice(start, end);
  }

  // Sugerencias por nombre (excluye ya seleccionados)
  private recomputeSuggestions(): void {
    const q = this.productQuery.trim().toLowerCase();
    const taken = new Set(this.selectedProductNames.map(n => n.toLowerCase()));
    this.productSuggestions = this.products
      .map(p => p.name)
      .filter(name => !!name)
      .filter(name => !taken.has(name.toLowerCase()))
      .filter(name => !q || name.toLowerCase().includes(q))
      .slice(0, 12);
  }

  private addProductName(name: string): void {
    const clean = (name || '').trim();
    if (!clean) return;
    const exists = this.selectedProductNames.some(n => n.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      this.selectedProductNames.push(clean);
      this.productQuery = '';
      this.recomputeSuggestions();
      this.applyFilters();
    }
  }

  private addProductByTerm(term: string): void {
    const t = term.trim();
    if (!t) return;

    // Coincidencia exacta o parcial por nombre
    const names = this.products.map(p => p.name).filter(Boolean);
    const exact = names.find(n => n.toLowerCase() === t.toLowerCase());
    const partial = exact ?? names.find(n => n.toLowerCase().includes(t.toLowerCase()));
    if (partial) this.addProductName(partial);
  }

  /* === Helpers UI === */
  getLimitedDetails(sale: Order): string {
    if (!sale.details?.length || sale.status === 'Canceled') return '';
    let txt = sale.details.map(d => `${this.getProductName(d.idProduct)} x${d.quantity}`).join(', ');
    return txt.length > 40 ? (txt.slice(0, 40) + '...') : txt;
  }

  getProductName(id: number): string {
    return this.products.find(p => p.idProduct === id)?.name ?? '';
  }

  private isoInLima(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
  }

  private localMillis(date: string, time?: string): number {
    const [y, m, d] = date.split('-').map(n => +n);
    let hh = 0, mm = 0, ss = 0, ms = 0;
    if (time) {
      const [hms, msPart] = time.split('.');
      const [h, m2, s] = (hms || '').split(':').map(n => +(n || 0));
      hh = h || 0; mm = m2 || 0; ss = s || 0; ms = msPart ? +msPart : 0;
    }
    return new Date(y, m - 1, d, hh, mm, ss, ms).getTime();
  }

  /* === Navegación === */
  registerNewSale(): void { this.router.navigate(['/view/ventas/registrar-venta']); }
  editSale(sale: Order): void { this.router.navigate([`/view/ventas/editar/${sale.idOrder}`]); }
  paySale(sale: Order): void { this.router.navigate([`/view/ventas/pagos/${sale.idOrder}`]); }
}
