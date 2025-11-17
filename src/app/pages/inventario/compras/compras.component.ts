import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';

import { ApiService } from '../../../core/services/api.service';
import { PageLoadingService } from '../../../core/services/page-loading.service';

/** ====== MODELOS ====== */

interface PurchaseItem {
  idPurchaseItem?: number;
  supply?: {
    idSupply?: number;
    name?: string;
    unit?: string;       // "Units", "Grams", "Milliliters", etc.
  };
  quantity: number;      // SIEMPRE viene en unidad base (lo que guarda el backend)
  unitPrice?: number;
  subtotal?: number;
}

interface Purchase {
  idPurchase: number;
  supplier: { name?: string } | null;
  purchaseDate: string;
  total: number;
  items: PurchaseItem[];
  raw?: any;
}

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatAutocompleteModule,
    MatOptionModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule
  ],
  templateUrl: './compras.component.html',
  styleUrls: ['./compras.component.scss']
})
export class ComprasComponent implements OnInit {

  purchases: Purchase[] = [];
  suppliers: any[] = [];
  supplies: any[] = [];

  suppliersList: string[] = [];
  suppliesList: string[] = [];

  fechaSeleccionada: Date | null = null;
  supplierQuery = '';
  supplyQuery = '';

  filteredSuppliers: string[] = [];
  filteredSupplies: string[] = [];

  visiblePurchases: Purchase[] = [];
  pageIndex = 0;
  pageSize = 12;
  totalPages = 0;
  pagesArray: number[] = [];

  contentReady = false;
  private pendingLoads = 0;
  isLoading = false;

  displayedColumns = ['number', 'fecha', 'proveedor', 'insumos', 'total', 'opciones'];

  constructor(
    private api: ApiService,
    private pageLoading: PageLoadingService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.initLoad();
  }

  private initLoad() {
    this.contentReady = false;
    this.startLoadingGroup(3);
    this.loadPurchases();
    this.loadSuppliers();
    this.loadSupplies();
  }

  /** ========== CARGA DE COMPRAS ========== */
  private loadPurchases() {
    this.api.getPurchases().subscribe({
      next: (res: any) => {
        console.log('[Compras] Respuesta cruda /purchases =>', res);

        const rawList: any[] = Array.isArray(res)
          ? res
          : (res?.content && Array.isArray(res.content)
            ? res.content
            : (res ? [res] : []));

        this.purchases = rawList.map((p: any): Purchase => {
          const idPurchase = Number(p.idPurchase ?? p.id ?? 0);
          const supplier = p.supplier ?? null;
          const purchaseDate = String(
            p.purchaseDate ?? p.date ?? p.fecha ?? p.createdAt ?? ''
          );
          const total = Number(p.total ?? 0);

          const items: PurchaseItem[] = Array.isArray(p.items)
            ? p.items
            : [];

          return {
            idPurchase,
            supplier,
            purchaseDate,
            total,
            items,
            raw: p
          };
        });

        console.log('[Compras] Normalizado =>', this.purchases);
        this.applyFilters();
      },
      error: (err) => {
        console.error('[Compras] Error al cargar /purchases =>', err);
        this.purchases = [];
        this.applyFilters();
      },
      complete: () => this.finishOneLoad()
    });
  }

  /** ========== CARGA DE PROVEEDORES ========== */
  private loadSuppliers() {
    this.api.getSuppliers().subscribe({
      next: (res: any[]) => {
        this.suppliers = Array.isArray(res) ? res : (res ? [res] : []);
        this.suppliersList = this.suppliers
          .map(s => String(s?.name ?? s?.nombre ?? s).trim())
          .filter(Boolean)
          .sort();
        this.filteredSuppliers = this.suppliersList.slice(0, 50);
      },
      error: () => {
        this.suppliers = [];
        this.suppliersList = [];
        this.filteredSuppliers = [];
      },
      complete: () => this.finishOneLoad()
    });
  }

  /** ========== CARGA DE INSUMOS (solo para filtros) ========== */
  private loadSupplies() {
    this.api.getSupplies().subscribe({
      next: (res: any[]) => {
        this.supplies = Array.isArray(res) ? res : (res ? [res] : []);
        this.suppliesList = this.supplies
          .map(s => String(s?.name ?? s?.nombre ?? s).trim())
          .filter(Boolean)
          .sort();
        this.filteredSupplies = this.suppliesList.slice(0, 50);
      },
      error: () => {
        this.supplies = [];
        this.suppliesList = [];
        this.filteredSupplies = [];
      },
      complete: () => this.finishOneLoad()
    });
  }

  /** ========== AUTOCOMPLETE PROVEEDORES ========== */
  onSupplierInput(): void {
    const q = (this.supplierQuery ?? '').toString().trim().toLowerCase();
    if (!q) {
      this.filteredSuppliers = this.suppliersList.slice(0, 50);
      return;
    }
    this.filteredSuppliers = this.suppliersList
      .filter(x => x.toLowerCase().includes(q))
      .slice(0, 50);
  }

  onSupplierSelected(ev: MatAutocompleteSelectedEvent) {
    this.supplierQuery = ev.option.value ?? '';
    this.applyFilters();
  }

  /** ========== AUTOCOMPLETE INSUMOS ========== */
  onSupplyInput(): void {
    const q = (this.supplyQuery ?? '').toString().trim().toLowerCase();
    if (!q) {
      this.filteredSupplies = this.suppliesList.slice(0, 50);
      return;
    }
    this.filteredSupplies = this.suppliesList
      .filter(x => x.toLowerCase().includes(q))
      .slice(0, 50);
  }

  onSupplySelected(ev: MatAutocompleteSelectedEvent) {
    this.supplyQuery = ev.option.value ?? '';
    this.applyFilters();
  }

  resetFilters(): void {
    this.fechaSeleccionada = null;
    this.supplierQuery = '';
    this.supplyQuery = '';

    this.filteredSuppliers = this.suppliersList.slice(0, 50);
    this.filteredSupplies = this.suppliesList.slice(0, 50);

    this.applyFilters();
  }

  /** ========== FILTROS EN CLIENTE ========== */
  applyFilters(): void {
    let list = [...this.purchases];

    if (this.fechaSeleccionada) {
      const sel = new Date(
        this.fechaSeleccionada.getFullYear(),
        this.fechaSeleccionada.getMonth(),
        this.fechaSeleccionada.getDate()
      ).getTime();

      list = list.filter(p => {
        const d = this.safeDateFromPurchase(p);
        if (!d) return false;
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        return day === sel;
      });
    }

    if (this.supplierQuery?.trim()) {
      const q = this.supplierQuery.trim().toLowerCase();
      list = list.filter(p => {
        const sup = p.supplier;
        const name = String(sup?.name ?? '').toLowerCase();
        return name.includes(q);
      });
    }

    if (this.supplyQuery?.trim()) {
      const q = this.supplyQuery.trim().toLowerCase();
      list = list.filter((p: any) => {
        const items: PurchaseItem[] = Array.isArray(p.items) ? p.items : [];
        const names = items
          .map(it => String(it?.supply?.name ?? '').toLowerCase())
          .filter(n => !!n);
        return names.some(n => n.includes(q));
      });
    }

    this.pageIndex = 0;
    this.setVisible(list);
  }

  private setVisible(list: Purchase[]) {
    this.totalPages = Math.max(1, Math.ceil(list.length / this.pageSize));
    this.pagesArray = Array.from({ length: this.totalPages }, (_, i) => i);
    const start = this.pageIndex * this.pageSize;
    this.visiblePurchases = list.slice(start, start + this.pageSize);
  }

  /** ========== PAGINADOR ========== */
  prevPage() {
    if (this.pageIndex === 0) return;
    this.pageIndex--;
    this.applyFiltersAfterPaging();
  }

  nextPage() {
    if (this.pageIndex >= this.totalPages - 1) return;
    this.pageIndex++;
    this.applyFiltersAfterPaging();
  }

  goToPage(p: number) {
    if (p < 0 || p >= this.totalPages) return;
    this.pageIndex = p;
    this.applyFiltersAfterPaging();
  }

  private applyFiltersAfterPaging() {
    let list = [...this.purchases];

    if (this.fechaSeleccionada) {
      const sel = new Date(
        this.fechaSeleccionada.getFullYear(),
        this.fechaSeleccionada.getMonth(),
        this.fechaSeleccionada.getDate()
      ).getTime();
      list = list.filter(p => {
        const d = this.safeDateFromPurchase(p);
        if (!d) return false;
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        return day === sel;
      });
    }

    if (this.supplierQuery?.trim()) {
      const q = this.supplierQuery.trim().toLowerCase();
      list = list.filter(p => {
        const sup = p.supplier;
        const name = String(sup?.name ?? '').toLowerCase();
        return name.includes(q);
      });
    }

    if (this.supplyQuery?.trim()) {
      const q = this.supplyQuery.trim().toLowerCase();
      list = list.filter((p: any) => {
        const items: PurchaseItem[] = Array.isArray(p.items) ? p.items : [];
        const names = items
          .map(it => String(it?.supply?.name ?? '').toLowerCase())
          .filter(n => !!n);
        return names.some(n => n.includes(q));
      });
    }

    this.setVisible(list);
  }

  /** ========== HELPERS DE FECHA / TEXTO ========== */
  safeDateFromPurchase(p: Purchase): Date | null {
    const raw = p.purchaseDate;
    const d = raw ? new Date(raw) : null;
    return (d && !isNaN(d.getTime())) ? d : null;
  }

  formatDate(d: Date | null): string {
    if (!d) return '---';
    try {
      return new Intl.DateTimeFormat('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }

  formatTime(d: Date | null): string {
    if (!d) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  purchaseSupplierName(p: Purchase): string {
    return String(p.supplier?.name ?? 'Desconocido');
  }

  purchaseTotal(p: Purchase): number {
    return Number(p.total ?? 0);
  }

  // Muestra insumos en texto bonito a partir de items[]
  purchaseItemsSummary(p: Purchase): string {
    const items: PurchaseItem[] = Array.isArray(p.items) ? p.items : [];

    if (!items.length) {
      return 'Sin insumos';
    }

    const formatItem = (it: PurchaseItem): string => {
      const supply = it?.supply ?? {};
      const name = String(supply.name ?? 'Insumo');

      let qtyBase = Number(it.quantity ?? 0);
      let unitLabel: string = supply.unit ?? '';

      // Normalizamos cantidades para mostrar
      const unitType = supply.unit as string | undefined;
      if (unitType === 'Grams') {
        qtyBase = qtyBase / 1000;
        unitLabel = 'kg';
      } else if (unitType === 'Milliliters') {
        qtyBase = qtyBase / 1000;
        unitLabel = 'L';
      }

      const qty = Math.round((qtyBase + Number.EPSILON) * 100) / 100;

      if (unitLabel) {
        return `${name} x${qty} ${unitLabel}`;
      }
      return `${name} x${qty}`;
    };

    if (items.length === 1) {
      return formatItem(items[0]);
    }

    const first = formatItem(items[0]);
    const extra = items.length - 1;

    return `${first} (+${extra} más)`;
  }

  /** ========== NAVEGACIÓN ========== */
  viewPurchase(p: Purchase) {
    console.log('[Compras] Ver compra =>', p);
    const id = Number(p.idPurchase ?? 0);
    if (id) this.router.navigate(['/purchases', id]);
  }

  editPurchase(p: Purchase) {
    const id = Number(p.idPurchase ?? 0);
    if (id) this.router.navigate(['/view/inventario/compras/editar', id]);
  }

  registerNewPurchase(): void {
    this.router.navigate(['/view/inventario/compras/registrar-compras']);
  }

  /** ========== LOADING GROUP HELPERS ========== */
  private startLoadingGroup(n = 1) {
    this.pendingLoads = n;
    this.isLoading = true;              // 🔹 Activamos bloqueo de botones
    this.pageLoading.start();
  }

  private finishOneLoad() {
    this.pendingLoads = Math.max(0, this.pendingLoads - 1);
    if (this.pendingLoads === 0) {
      this.pageLoading.stop();
      this.contentReady = true;
      this.isLoading = false;           // 🔹 Liberamos botones cuando todo termina
      this.applyFilters();
    }
  }

  volverInventario(): void {
    this.router.navigate([`/view/inventario`]);
  }
}
