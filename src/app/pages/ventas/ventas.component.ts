import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { PageLoadingService } from '../../core/services/page-loading.service';

/* === Modelos front === */
interface OrderDetail {
  idDetail: number;
  idOrder: number;
  idProduct: number;
  quantity: number;
  subtotal: number;
}
type OrderStatus = 'Pending' | 'Confirmed' | 'Cancelled';
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
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './ventas.component.html',
  styleUrls: ['./ventas.component.scss']
})
export class VentasComponent implements OnInit {
  contentReady = false;
  displayedColumns: string[] = ['number', 'producto', 'hora', 'estado', 'ganancia', 'opciones'];

  sales: Order[] = [];
  products: ProductLite[] = [];

  statusFilter: 'All' | OrderStatus = 'All';

  productQuery = '';
  selectedProductNames: string[] = [];
  productSuggestions: string[] = [];

  filteredSales: Order[] = [];
  visibleSales: Order[] = [];

  pageSize = 10;
  pageIndex = 0;
  displayEmpty = (_: any): string => '';

  fechaSeleccionada: Date = new Date();

  get fecha(): string {
    return this.fechaSeleccionada
      ? this.fechaSeleccionada.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';
  }

  private productNameById: Record<number, string> = {};

  constructor(private api: ApiService, private router: Router, private pageLoading: PageLoadingService) { }

  async ngOnInit(): Promise<void> {
    await this.initLoad();
  }

  private async initLoad(): Promise<void> {
    this.contentReady = false;
    this.pageLoading.start();
    try {
      await Promise.all([
        this.loadProducts(),
        this.loadSales()
      ]);
    } finally {
      this.contentReady = true;
      this.pageLoading.stop();
    }
  }

  /* === Carga de datos (async, sin parpadeo) === */
  private async loadSales(): Promise<void> {
    const targetIso = this.toIsoYYYYMMDD(this.fechaSeleccionada);

    try {
      const raw = await firstValueFrom(this.api.getSales()) as any[];
      const base: Order[] = (raw || []).map(v => ({
        idOrder: Number(v.idOrder ?? v.id),
        status: String(v.status ?? 'Pending') as OrderStatus,
        total: Number(v.total ?? 0),
        orderDate: String(v.orderDate ?? v.fecha_pedido ?? targetIso).slice(0, 10),
        orderTime: String(v.orderTime ?? v.hora_pedido ?? '00:00:00'),
        details: []
      }));

      this.sales = base
        .filter(v => v.orderDate === targetIso)
        .sort((a, b) => this.localMillis(b.orderDate, b.orderTime) - this.localMillis(a.orderDate, a.orderTime));
      await Promise.all(this.sales.map(async sale => {
        try {
          const [details, payments] = await Promise.allSettled([
            firstValueFrom(this.api.getOrderDetailsByOrderId(sale.idOrder)),
            firstValueFrom(this.api.getPaymentsByOrderId(sale.idOrder))
          ]);

          if (details.status === 'fulfilled') {
            const det = (details.value || []) as any[];
            sale.details = det.map(d => ({
              idDetail: Number(d.idDetail ?? d.id_detalle ?? 0),
              idOrder: Number(d.idOrder ?? d.id_pedido ?? sale.idOrder),
              idProduct: Number(d.idProduct ?? d.id_producto ?? 0),
              quantity: Number(d.quantity ?? d.cantidad ?? 0),
              subtotal: Number(d.subtotal ?? 0)
            }));
          } else {
            sale.details = [];
          }

          if (payments.status === 'fulfilled') {
            const p = payments.value as any[];
            sale.alreadyPaid = !!p && p.length > 0;
          } else {
            sale.alreadyPaid = false;
          }
        } catch {
          sale.details = [];
          sale.alreadyPaid = false;
        }
      }));

      this.pageIndex = 0;
      this.applyFilters();
    } catch {
      this.sales = [];
      this.applyFilters();
    }
  }

  private async loadProducts(): Promise<void> {
    try {
      const resp = await firstValueFrom(this.api.getProductos()) as any[];
      const arr = Array.isArray(resp) ? resp : (resp ? [resp] : []);
      const enabled: ProductLite[] = [];
      this.productNameById = {};

      arr.forEach(raw => {
        const id = Number(raw?.idProduct ?? raw?.id ?? raw?.idProduct);
        const name = String(raw?.name ?? raw?.nombre ?? '');
        const disabled = !!raw?.disabled;

        if (id) this.productNameById[id] = name;
        if (!disabled && id && name) enabled.push({ idProduct: id, name });
      });

      this.products = enabled;
      this.recomputeSuggestions();
    } catch {
      this.products = [];
      this.productNameById = {};
      this.recomputeSuggestions();
    }
  }

  onStatusChange(): void {
    this.pageIndex = 0;
    this.applyFilters();
  }

  async onDateChange(ev: MatDatepickerInputEvent<Date>): Promise<void> {
    this.fechaSeleccionada = ev.value ?? new Date();
    this.pageIndex = 0;
    this.contentReady = false;
    this.pageLoading.start();
    try {
      await this.loadSales();
    } finally {
      this.contentReady = true;
      this.pageLoading.stop();
    }
  }

  onProductFilterInput(val: any): void {
    this.productQuery = (val ?? '').toString();
    this.recomputeSuggestions();
  }

  onProductSuggestionSelected(name: string): void {
    this.addProductName(name);
    this.productQuery = '';
    this.recomputeSuggestions();
  }

  removeSelectedProduct(name: string): void {
    this.selectedProductNames = this.selectedProductNames
      .filter(n => n.toLowerCase() !== name.toLowerCase());
    this.recomputeSuggestions();
    this.pageIndex = 0;
    this.applyFilters();
  }

  clearAllFilters(): void {
    this.statusFilter = 'All';
    this.productQuery = '';
    this.selectedProductNames = [];
    this.recomputeSuggestions();
    this.pageIndex = 0;
    this.applyFilters();
  }

  get totalPages(): number {
    const total = this.filteredSales.length;
    return Math.max(1, Math.ceil(total / this.pageSize));
  }

  get pagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  goToPage(i: number): void {
    if (i < 0 || i >= this.totalPages) return;
    this.pageIndex = i;
    this.sliceToPage();
  }
  nextPage(): void { this.goToPage(this.pageIndex + 1); }
  prevPage(): void { this.goToPage(this.pageIndex - 1); }

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

    if (this.pageIndex >= this.totalPages) this.pageIndex = Math.max(0, this.totalPages - 1);
    this.sliceToPage();
  }

  private sliceToPage(): void {
    const start = this.pageIndex * this.pageSize;
    this.visibleSales = this.filteredSales.slice(start, start + this.pageSize);
  }

  private saleHasAllSelectedProducts(sale: Order, selectedLowerNames: string[]): boolean {
    if (!sale.details || sale.details.length === 0) return false;

    const saleNames = new Set(
      sale.details
        .map(d => this.getProductName(d.idProduct)?.toLowerCase().trim())
        .filter(Boolean) as string[]
    );

    return selectedLowerNames.every(name => saleNames.has(name));
  }

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
      this.pageIndex = 0;
      this.applyFilters();
    }
  }

  /* === Helpers UI === */
  getLimitedDetails(sale: Order): string {
    if (!sale.details?.length || sale.status === 'Cancelled') return '';
    let txt = sale.details.map(d => `${this.getProductName(d.idProduct)} x${d.quantity}`).join(', ');
    return txt.length > 40 ? (txt.slice(0, 40) + '...') : txt;
  }

  getProductName(id: number): string {
    return this.productNameById[id] ?? '';
  }

  getHoraMinutos(time: string): string {
    if (!time) return '';
    const [h, m] = time.split(':');
    return `${h}:${m}`;
  }

  private toIsoYYYYMMDD(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
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