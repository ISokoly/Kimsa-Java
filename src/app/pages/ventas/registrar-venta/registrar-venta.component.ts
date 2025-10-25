import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';

import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../../view/confirm-dialog/confirm-dialog.component';
import { PageLoadingService } from '../../../core/services/page-loading.service';

const GENERIC_DNI = '00000001';
type DayWeek = 'Lunes' | 'Martes' | 'Miercoles' | 'Jueves' | 'Viernes' | 'Sabado' | 'Domingo' | 'General';

type Product = { idProduct: number; name: string; price: number; disabled: boolean };
type CartItem = { idProduct: number; name: string; unitPrice: number; quantity: number; subtotal: number; discountPct?: number };
type Discount = { idProduct: number; percentage: number; typeDay: DayWeek; disabled: boolean };

@Component({
  selector: 'app-registrar-venta',
  standalone: true,
  imports: [
    FormsModule, RouterModule,
    MatInputModule, MatGridListModule, MatButtonModule, MatSelectModule, MatIconModule,
    MatFormFieldModule, MatAutocompleteModule, MatCheckboxModule,
  ],
  templateUrl: './registrar-venta.component.html',
  styleUrls: ['./registrar-venta.component.scss']
})
export class RegistrarVentaComponent implements OnInit {

  /* ==================== ESTADO DE CARGA ==================== */
  contentReady = false;
  private pendingLoads = 0;

  private groupStart() {
    if (this.pendingLoads === 0) this.pageLoading.start();
    this.pendingLoads++;
  }
  private groupEnd() {
    this.pendingLoads = Math.max(0, this.pendingLoads - 1);
    if (this.pendingLoads === 0) {
      this.pageLoading.stop();
      this.contentReady = true;
    }
  }

  /* ==================== DATOS ==================== */
  saleId: number | null = null;
  isSaving = false;
  isGeneric = true;

  isExistingClient = false;
  customerName = 'Cliente Genérico';
  customerDni = GENERIC_DNI;
  customerBirthdate = '2000-01-01';
  currentCustomer: { idClient: number; name: string; dni: string } | null = null;

  tables: any[] = [];
  selectedTableId: number | null = null;
  private allProducts: Product[] = [];

  products: Product[] = [];
  selectedProductId: number | null = null;
  selectedQty = 1;
  cart: CartItem[] = [];

  private discounts: Discount[] = [];
  private saleRefDate: Date = new Date();

  dniSuggestions: Array<{ dni: string; name: string; idClient?: number; birthdate?: string }> = [];

  private allClientsCache: Array<{ dni: string; name: string; idClient?: number; birthdate?: string }> = [];
  private allClientsLoaded = false;
  private dniSuggestTimer?: any;

  isDelivery = false;
  productSearch = '';
  filteredProducts: Product[] = [];

  get total(): number { return this.cart.reduce((a, i) => a + (i.subtotal || 0), 0); }

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private pageLoading: PageLoadingService
  ) {}

  /* ==================== INICIO ==================== */
  ngOnInit(): void {
    this.contentReady = false;

    this.route.paramMap.subscribe(p => {
      this.saleId = p.get('id') ? +p.get('id')! : null;
      this.init();
      this.onDniChange();
    });
  }

  private init(): void {
    // Arrancamos las cargas principales con el spinner
    this.groupStart(); this.loadProducts();
    this.groupStart(); this.loadDiscounts();

    if (this.saleId) {
      this.groupStart();
      this.loadExistingSale(this.saleId, () => {
        this.groupStart(); this.loadTables(this.selectedTableId);
      });
    } else {
      this.setGenericCustomer();
      this.saleRefDate = new Date();
      this.groupStart(); this.loadTables(null);
    }
  }

  /* ==================== NAVEGACIÓN ==================== */
  goBack(): void { this.router.navigate(['/view/ventas']); }

  /* ==================== CARGA DE DATOS ==================== */
  private mapMesa = (m: any) => ({
    idTable: Number(m?.idTable ?? m?.id ?? 0),
    number: String(m?.number ?? ''),
    active: Boolean(m?.active ?? m?.isActive ?? m?.activo ?? false),
    disabled: Boolean(m?.disabled ?? m?.inhabilitado ?? false),
  });

  loadTables(keepId: number | null = null): void {
    this.api.getMesas().subscribe({
      next: (res: any[]) => {
        const mesas = (Array.isArray(res) ? res : []).map(this.mapMesa);
        const allowedId = keepId ?? this.selectedTableId ?? null;
        this.tables = mesas
          .filter(m => !m.active || (allowedId != null && m.idTable === allowedId))
          .filter(m => !m.disabled);
      },
      error: () => this.toast.mostrarMensaje('❌ Error al cargar mesas'),
      complete: () => this.groupEnd()
    });
  }

  loadProducts(): void {
    this.api.getProductos().subscribe({
      next: (res: any) => {
        const mapped = arr(res).map(this.mapProduct);
        this.allProducts = mapped;
        this.products = mapped.filter(p => !p.disabled);
        this.filteredProducts = this.products.slice(0, 10);
      },
      error: () => {
        this.allProducts = [];
        this.products = [];
        this.toast.mostrarMensaje('❌ Error al cargar productos');
      },
      complete: () => this.groupEnd()
    });
  }

  loadDiscounts(): void {
    this.api.getDescuentos().subscribe({
      next: (list: any[]) => {
        this.discounts = arr(list).map(this.mapDiscount).filter(d => d.idProduct);
        this.refreshCartPricing();
      },
      error: () => { this.discounts = []; },
      complete: () => this.groupEnd()
    });
  }

  loadExistingSale(id: number, after?: () => void): void {
    this.api.getSaleById(id).subscribe({
      next: (sale: any) => {
        const od = String(sale?.orderDate ?? '');
        const ot = String(sale?.orderTime ?? '00:00:00');
        this.saleRefDate = this.buildLocalDate(od, ot);
        this.isDelivery = !!sale?.delivery;
        this.selectedTableId = this.isDelivery ? null : (sale?.idTable ?? null);

        const idClient = sale?.idClient ?? null;
        if (idClient) {
          this.groupStart();
          this.api.getClientesById(idClient).subscribe({
            next: (c: any) => this.applyLoadedClient(c),
            error: () => this.setGenericCustomer(),
            complete: () => this.groupEnd()
          });
        } else {
          this.setGenericCustomer();
        }

        this.groupStart();
        this.api.getOrderDetailsByOrderId(id).subscribe({
          next: (details: any[]) => {
            this.cart = arr(details).map(this.mapDetailToCart, this);
            this.refreshCartPricing();
          },
          error: () => { this.cart = []; },
          complete: () => this.groupEnd()
        });

        after?.();
      },
      error: () => this.toast.mostrarMensaje('❌ No se pudo cargar la venta'),
      complete: () => this.groupEnd()
    });
  }

  /* ==================== GUARDAR ==================== */
  async saveSale(): Promise<void> {
    if (!this.isDelivery && !this.selectedTableId) {
      return this.toast.mostrarMensaje('⚠️ Seleccione una mesa o marque Delivery');
    }
    if (!this.cart.length) return this.toast.mostrarMensaje('⚠️ Agregue al menos un producto');

    this.isSaving = true;
    try {
      const customer = await this.ensureCustomer();
      const user = this.api.getUsuarioActual?.();
      const idUser = toNum(user?.idUser ?? user?.id_usuario ?? 1);

      const payload = {
        idClient: customer.idClient,
        idUser,
        idTable: this.isDelivery ? null : this.selectedTableId,
        delivery: this.isDelivery,
        items: this.cart.map(i => ({ idProduct: i.idProduct, quantity: i.quantity }))
      };

      const req$ = this.saleId ? this.api.updateSale(this.saleId, payload) : this.api.createSale(payload);
      req$.subscribe({
        next: () => {
          this.toast.mostrarMensaje(this.saleId ? '✅ Venta actualizada correctamente' : '✅ Venta registrada correctamente');
          this.goBack();
        },
        error: () => {
          this.toast.mostrarMensaje(this.saleId ? '❌ Error al actualizar la venta' : '❌ Error al registrar la venta');
          if (this.saleId != null) this.loadExistingSale(this.saleId, () => this.loadTables(this.selectedTableId));
        },
        complete: () => (this.isSaving = false)
      });
    } catch (e: any) {
      this.toast.mostrarMensaje('❌ ' + (e?.toString?.() ?? 'Error al validar cliente'));
      this.isSaving = false;
    }
  }

  /* ==================== UTILIDADES ==================== */
  toggleGeneric(): void {
    this.isGeneric = !this.isGeneric;
    this.isGeneric ? this.setGenericCustomer() : this.clearCustomer();
  }
  onToggleDelivery(): void { if (this.isDelivery) this.selectedTableId = null; }

  onDniChange(): void {
    const dni = (this.customerDni || '').trim();
    if (!dni || dni.length < 8 || this.isGeneric) { this.isExistingClient = false; return; }

    this.api.getClientesByDNI(dni).subscribe({
      next: (c: any | null) => {
        if (c?.idClient) {
          this.isExistingClient = true;
          this.applyLoadedClient(c);
        } else this.isExistingClient = false;
      },
      error: () => { this.isExistingClient = false; }
    });
  }

  filtrarProductos(): void {
    const q = this.productSearch.toLowerCase().trim();
    this.filteredProducts = !q
      ? this.products.slice(0, 10)
      : this.products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 10);
  }

  onProductoSeleccionado(producto: Product): void {
    this.selectedProductId = producto.idProduct;
    this.productSearch = `${producto.name} — S/${producto.price}`;
  }

  ensureCustomer(): Promise<{ idClient: number; name: string; dni: string }> {
    return new Promise((resolve, reject) => {
      if (this.isGeneric && this.currentCustomer?.idClient) return resolve(this.currentCustomer);

      const dni = (this.isGeneric ? GENERIC_DNI : (this.customerDni || '').trim());
      const name = (this.isGeneric ? 'Cliente Genérico' : (this.customerName || '').trim());
      const birthdate = this.customerBirthdate || '2000-01-01';

      if (!dni || !name) return reject('⚠️ Complete nombre y DNI del cliente.');
      if (!/^\d{8}$/.test(dni)) return reject('⚠️ Escriba un DNI válido (8 dígitos numéricos).');

      this.api.ensureCliente({ name, dni, birthdate }).subscribe({
        next: (c: any) => {
          if (c?.idClient) {
            this.currentCustomer = { idClient: c.idClient, name: c.name, dni: c.dni };
            resolve(this.currentCustomer);
          } else reject('❌ Respuesta inválida del servidor.');
        },
        error: () => reject('❌ No se pudo asegurar/obtener el cliente.')
      });
    });
  }

  private recalcItemPricing(i: CartItem): void {
    const pct = this.getDiscountPct(i.idProduct);
    i.discountPct = pct;
    i.subtotal = subTotal(i.unitPrice, i.quantity, pct);
  }
  private refreshCartPricing(): void { this.cart.forEach(i => this.recalcItemPricing(i)); }

  cancelSale(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px', maxWidth: '95vw', panelClass: 'custom-confirm-dialog', disableClose: true,
      data: { title: 'Cancelar venta', message: '¿Seguro que deseas cancelar esta venta?' }
    });

    dialogRef.afterClosed().subscribe(ok => {
      if (!ok || !this.saleId) return;

      this.isSaving = true;
      this.api.updateSale(this.saleId, { status: 'Cancelled' }).subscribe({
        next: () => { this.toast.mostrarMensaje('✅ Venta cancelada correctamente'); this.goBack(); },
        error: () => this.toast.mostrarMensaje('❌ Error al cancelar la venta'),
        complete: () => (this.isSaving = false)
      });
    });
  }

  private setGenericCustomer(): void {
    this.isGeneric = true;
    this.isExistingClient = true;
    this.customerName = 'Cliente Genérico';
    this.customerDni = GENERIC_DNI;
    this.customerBirthdate = '2000-01-01';
    this.currentCustomer = null;
  }
  private clearCustomer(): void {
    this.isExistingClient = false;
    this.customerName = '';
    this.customerDni = '';
    this.customerBirthdate = '2000-01-01';
    this.currentCustomer = null;
  }

  private applyLoadedClient(c: any): void {
    if (!c) return this.setGenericCustomer();
    const isGeneric = String(c?.dni) === GENERIC_DNI;
    this.isGeneric = isGeneric;
    this.isExistingClient = true;
    this.currentCustomer = { idClient: toNum(c.idClient), name: String(c.name ?? ''), dni: String(c.dni ?? '') };
    this.customerName = isGeneric ? 'Cliente Genérico' : this.currentCustomer.name;
    this.customerDni = isGeneric ? GENERIC_DNI : this.currentCustomer.dni;
    this.customerBirthdate = c?.birthdate ?? '2000-01-01';
  }

  addToCart(): void {
    if (!this.selectedProductId || this.selectedQty <= 0) return;
    const prod = this.products.find(p => p.idProduct === this.selectedProductId);
    if (!prod) return;

    const pct = this.getDiscountPct(prod.idProduct);
    const existing = this.cart.find(i => i.idProduct === prod.idProduct);

    if (existing) {
      existing.quantity += this.selectedQty;
      existing.discountPct = pct;
      existing.subtotal = subTotal(existing.unitPrice, existing.quantity, pct);
    } else {
      this.cart.push({
        idProduct: prod.idProduct,
        name: prod.name,
        unitPrice: prod.price,
        quantity: this.selectedQty,
        discountPct: pct,
        subtotal: subTotal(prod.price, this.selectedQty, pct)
      });
    }

    this.selectedProductId = null;
    this.selectedQty = 1;
  }

  updateQty(item: CartItem, qty: number): void {
    item.quantity = Math.max(1, Math.floor(toNum(qty) || 1));
    const pct = this.getDiscountPct(item.idProduct);
    item.discountPct = pct;
    item.subtotal = subTotal(item.unitPrice, item.quantity, pct);
  }

  removeItem(item: CartItem): void { this.cart = this.cart.filter(i => i !== item); }
  clearCart(): void { this.cart = []; }

  soloNumeros(e: KeyboardEvent): void {
    const ok = /^\d$/.test(e.key) || ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key);
    if (!ok) e.preventDefault();
  }

  private normalizeNoAccent(s: string): string {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
  private limaDayName(date: Date): DayWeek {
    const raw = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'long' }).format(date);
    const key = this.normalizeNoAccent(raw);
    const map: Record<string, DayWeek> = {
      'lunes': 'Lunes', 'martes': 'Martes', 'miercoles': 'Miercoles', 'jueves': 'Jueves',
      'viernes': 'Viernes', 'sabado': 'Sabado', 'domingo': 'Domingo'
    };
    return map[key] ?? 'General';
  }
  private getDiscountPct(productId: number): number {
    const today = this.limaDayName(this.saleRefDate);
    const active = this.discounts.filter(d => !d.disabled && d.idProduct === productId);
    const pick = active.filter(d => d.typeDay !== 'General' && d.typeDay === today);
    const bag = pick.length ? pick : active.filter(d => d.typeDay === 'General');
    return bag.length ? Math.max(...bag.map(d => d.percentage || 0)) : 0;
  }

  private buildLocalDate(orderDate: string, orderTime?: string): Date {
    const [y, m, d] = (orderDate || '').split('-').map(n => parseInt(n, 10));
    let hh = 0, mm = 0, ss = 0;
    if (orderTime) {
      const [h, m2, s] = orderTime.split(':').map(n => parseInt(n || '0', 10));
      hh = h || 0; mm = m2 || 0; ss = s || 0;
    }
    return new Date(y, (m - 1), d, hh, mm, ss);
  }

  private mapProduct = (raw: any): Product => ({
    idProduct: toNum(raw?.idProduct ?? raw?.id_producto ?? raw?.id),
    name: String(raw?.name ?? raw?.nombre ?? ''),
    price: toNum(raw?.price ?? raw?.precio ?? 0),
    disabled: !!raw?.disabled
  });

  private mapDiscount = (d: any): Discount => ({
    idProduct: toNum(d?.idProduct ?? d?.id_producto),
    percentage: toNum(d?.percentage ?? d?.porcentaje ?? 0),
    typeDay: String(d?.typeDay ?? d?.dia_semana ?? 'General') as DayWeek,
    disabled: !!d?.disabled
  });

  private mapDetailToCart(d: any): CartItem {
    const idProduct = toNum(d?.idProduct ?? d?.id_producto);
    const prod = this.allProducts.find(p => p.idProduct === idProduct);
    const qty = toNum(d?.quantity ?? d?.cantidad ?? 1);
    const unit = prod?.price ?? (toNum(d?.subtotal) / Math.max(1, qty));
    const pct = this.getDiscountPct(idProduct);
    return { idProduct, name: prod?.name ?? `#${idProduct}`, unitPrice: unit, quantity: qty, discountPct: pct, subtotal: subTotal(unit, qty, pct) };
  }

  onDniInput(term: string): void {
    const q = (term || '').trim();
    this.customerDni = q;

    if (q.length < 1) { this.dniSuggestions = []; return; }

    if (this.dniSuggestTimer) clearTimeout(this.dniSuggestTimer);
    this.dniSuggestTimer = setTimeout(() => this.fetchDniSuggestions(q), 200);
  }
  onDniSelected(dni: string): void {
    this.customerDni = dni;
    this.onDniChange();
  }

  private fetchDniSuggestions(prefix: string): void {
    const doFilter = () => {
      const p = prefix.toLowerCase();
      this.dniSuggestions = this.allClientsCache
        .filter(c => c.dni?.toLowerCase().startsWith(p))
        .slice(0, 10);
    };

    if (this.allClientsLoaded) { doFilter(); return; }

    const list$ = (this.api as any).getAllClientes?.() || (this.api as any).getClientes?.();

    if (!list$) {
      this.allClientsLoaded = true; this.allClientsCache = []; this.dniSuggestions = [];
      return;
    }

    list$.subscribe({
      next: (arr: any[]) => {
        const list = Array.isArray(arr) ? arr : [];
        this.allClientsCache = list.map(c => ({
          idClient: c?.idClient ?? c?.id_cliente,
          name: String(c?.name ?? c?.nombre ?? ''),
          dni: String(c?.dni ?? ''),
          birthdate: c?.birthdate ?? c?.fecha_nacimiento
        })).filter(c => !!c.dni);
        this.allClientsLoaded = true;
        doFilter();
      },
      error: () => {
        this.allClientsLoaded = true; this.allClientsCache = []; this.dniSuggestions = [];
      }
    });
  }
}

/* ==================== HELPERS ==================== */
function toNum(v: any, def = 0): number { const n = Number(v); return Number.isFinite(n) ? n : def; }
function arr<T = any>(v: any): T[] { return Array.isArray(v) ? v : (v ? [v] : []); }
function subTotal(unit: number, qty: number, pct: number): number {
  const base = (unit || 0) * Math.max(1, qty || 1);
  return Math.round(base * (1 - (toNum(pct) / 100)) * 100) / 100;
}
