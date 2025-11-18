// oxlint-disable no-unused-expressions
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
type DayWeek =
  | 'Lunes'
  | 'Martes'
  | 'Miercoles'
  | 'Jueves'
  | 'Viernes'
  | 'Sabado'
  | 'Domingo'
  | 'General';

type Product = { idProduct: number; name: string; price: number; disabled: boolean };
type CartItem = {
  idProduct: number;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  discountPct?: number;
};
type Discount = { idProduct: number; percentage: number; typeDay: DayWeek; disabled: boolean };

@Component({
  selector: 'app-registrar-venta',
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,
    MatInputModule,
    MatGridListModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    MatCheckboxModule,
  ],
  templateUrl: './registrar-venta.component.html',
  styleUrls: ['./registrar-venta.component.scss'],
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

  // 🔎 Autocomplete de productos
  productSearch = '';
  filteredProducts: Product[] = [];

  get total(): number {
    return this.cart.reduce((a, i) => a + (i.subtotal || 0), 0);
  }

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private pageLoading: PageLoadingService
  ) { }

  /* ==================== INICIO ==================== */
  ngOnInit(): void {
    this.contentReady = false;

    this.route.paramMap.subscribe((p) => {
      this.saleId = p.get('id') ? +p.get('id')! : null;
      this.init();
      this.onDniChange();
    });
  }

  private init(): void {
    this.groupStart();
    this.loadProducts();
    this.groupStart();
    this.loadDiscounts();

    if (this.saleId) {
      this.groupStart();
      this.loadExistingSale(this.saleId, () => {
        this.groupStart();
        this.loadTables(this.selectedTableId);
      });
    } else {
      this.setGenericCustomer();
      this.saleRefDate = new Date();
      this.groupStart();
      this.loadTables(null);
    }
  }

  /* ==================== NAVEGACIÓN ==================== */
  goBack(): void {
    this.router.navigate(['/view/ventas']);
  }

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
          .filter((m) => !m.active || (allowedId != null && m.idTable === allowedId))
          .filter((m) => !m.disabled);
      },
      error: () => this.toast.mostrarMensaje('❌ Error al cargar mesas'),
      complete: () => this.groupEnd(),
    });
  }

  loadProducts(): void {
    this.api.getProductos().subscribe({
      next: (res: any) => {
        const mapped = arr(res).map(this.mapProduct);
        this.allProducts = mapped;
        this.products = mapped.filter((p) => !p.disabled);
        this.filteredProducts = this.products.slice(0, 10);
      },
      error: () => {
        this.allProducts = [];
        this.products = [];
        this.toast.mostrarMensaje('❌ Error al cargar productos');
      },
      complete: () => this.groupEnd(),
    });
  }

  loadDiscounts(): void {
    this.api.getDescuentos().subscribe({
      next: (list: any[]) => {
        this.discounts = arr(list).map(this.mapDiscount).filter((d) => d.idProduct);
        this.refreshCartPricing();
      },
      error: () => {
        this.discounts = [];
      },
      complete: () => this.groupEnd(),
    });
  }

  loadExistingSale(id: number, after?: () => void): void {
    this.api.getSaleById(id).subscribe({
      next: (sale: any) => {
        const od = String(sale?.orderDate ?? '');
        const ot = String(sale?.orderTime ?? '00:00:00');
        this.saleRefDate = this.buildLocalDate(od, ot);
        this.isDelivery = !!sale?.delivery;
        this.selectedTableId = this.isDelivery ? null : sale?.idTable ?? null;

        const idClient = sale?.idClient ?? null;
        if (idClient) {
          this.groupStart();
          this.api.getClientesById(idClient).subscribe({
            next: (c: any) => this.applyLoadedClient(c),
            error: () => this.setGenericCustomer(),
            complete: () => this.groupEnd(),
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
          error: () => {
            this.cart = [];
          },
          complete: () => this.groupEnd(),
        });

        after?.();
      },
      error: () => this.toast.mostrarMensaje('❌ No se pudo cargar la venta'),
      complete: () => this.groupEnd(),
    });
  }

  /* ==================== GUARDAR ==================== */
  async saveSale(): Promise<void> {
    if (!this.isDelivery && !this.selectedTableId) {
      this.toast.mostrarMensaje('⚠️ Seleccione una mesa o marque Delivery');
      return;
    }
    if (!this.cart.length) {
      this.toast.mostrarMensaje('⚠️ Agregue al menos un producto');
      return;
    }

    this.isSaving = true;
    try {
      const customer = await this.ensureCustomer();
      const user = this.api.getUsuarioActual();
      const idUser = Number(user?.idUser ?? 1);

      const items = this.cart.map((i) => ({
        idProduct: i.idProduct,
        quantity: i.quantity,
      }));

      const payload: any = {
        idClient: customer.idClient,
        idUser,
        idTable: this.isDelivery ? null : this.selectedTableId,
        delivery: this.isDelivery,
        items,
      };

      const creando = !this.saleId;

      if (creando) {
        this.api.createSale(payload).subscribe({
          next: (order: any) => {
            const idOrder = order?.idOrder;
            if (!idOrder) {
              this.toast.mostrarMensaje(
                '⚠️ Venta creada pero sin ID de pedido, no se ajustó el stock'
              );
              this.isSaving = false;
              this.goBack();
              return;
            }

            this.api.consumeInventory(idOrder, true).subscribe({
              next: () => {
                // ✅ Venta OK → revisamos insumos bajos de ESTA venta
                this.checkLowStockWarnings(idOrder);
                this.toast.mostrarMensaje('✅ Venta registrada y stock actualizado');
                this.isSaving = false;
                this.goBack();
              },
              error: (err) => {
                const msg =
                  err?.error?.message ||
                  err?.error ||
                  'Stock insuficiente o error al actualizar inventario.';

                this.handleInventoryError(idOrder, msg);
              },
            });
          },
          error: () => {
            this.toast.mostrarMensaje('❌ Error al registrar la venta');
            this.isSaving = false;
          },
        });
      } else {
        const idOrder = this.saleId!;

        this.api.refundInventory(idOrder).subscribe({
          next: () => {
            this.api.updateSale(idOrder, payload).subscribe({
              next: () => {
                this.api.consumeInventory(idOrder, true).subscribe({
                  next: () => {
                    this.checkLowStockWarnings(idOrder);
                    this.toast.mostrarMensaje('✅ Venta actualizada y stock ajustado');
                    this.isSaving = false;
                    this.goBack();
                  },
                  error: (err) => {
                    const msg =
                      err?.error?.message ||
                      err?.error ||
                      'Stock insuficiente o error al actualizar inventario.';
                    this.handleInventoryError(idOrder, msg);
                  },
                });
              },
              error: () => {
                this.toast.mostrarMensaje('❌ Error al actualizar la venta');
                this.isSaving = false;
              },
            });
          },
          error: () => {
            this.toast.mostrarMensaje('❌ Error al devolver stock del pedido anterior');
            this.isSaving = false;
          },
        });
      }
    } catch (e: any) {
      this.toast.mostrarMensaje('❌ ' + (e?.toString?.() ?? 'Error al validar cliente'));
      this.isSaving = false;
    }
  }
  private handleInventoryError(idOrder: number, msg: string): void {
    this.api.updateSale(idOrder, { status: 'Cancelled' }).subscribe({
      next: () => {
        this.toast.mostrarMensaje('❌ ' + msg + ' La venta fue anulada.');
        this.isSaving = false;
      },
      error: () => {
        this.toast.mostrarMensaje(
          '❌ ' + msg + ' Además, no se pudo marcar la venta como anulada.'
        );
        this.isSaving = false;
      },
    });
  }

  private checkLowStockWarnings(idOrder: number): void {
    const anyApi: any = this.api as any;

    if (!anyApi.getLowStockByOrder) {
      return;
    }

    anyApi.getLowStockByOrder(idOrder).subscribe({
      next: (res: any[]) => {
        const list = Array.isArray(res) ? res : [];
        const critical: string[] = [];
        const low: string[] = [];

        for (const raw of list) {
          const name = String(raw?.name ?? raw?.nombre ?? 'Insumo');

          const stock = Number(
            raw?.currentStock ??
            raw?.stock ??
            raw?.quantity ??
            raw?.cantidad ??
            0
          );

          const unitRaw = String(raw?.unit ?? raw?.unidad ?? '').toLowerCase().trim();

          if (Number.isNaN(stock)) continue;

          // 🔴 Sin stock
          if (stock <= 0) {
            critical.push(`${name} (0 ${unitRaw || ''})`);
            continue;
          }

          // 🟡 A punto de acabarse según tipo de unidad (tolerante al texto)
          const isGram = unitRaw.includes('gram');         // grams, gramos, grams_unit, etc.
          const isMl = unitRaw.includes('ml') || unitRaw.includes('mili');
          const isUnit = unitRaw.includes('unit') || unitRaw.includes('uni');

          if (isGram && stock < 3000) {
            low.push(`${name} (${stock} g)`);
          } else if (isMl && stock < 3000) {
            low.push(`${name} (${stock} ml)`);
          } else if (isUnit && stock < 9) {
            low.push(`${name} (${stock} u)`);
          }
        }

        if (critical.length) {
          this.toast.mostrarMensaje(
            '❌ Insumos sin stock relacionados a la venta: ' + critical.join(', ')
          );
        }

        if (low.length) {
          this.toast.mostrarMensaje(
            '⚠️ Insumos casi agotados relacionados a la venta: ' + low.join(', ')
          );
        }
      },
    });
  }


  /* ==================== UTILIDADES ==================== */
  toggleGeneric(): void {
    this.isGeneric = !this.isGeneric;
    this.isGeneric ? this.setGenericCustomer() : this.clearCustomer();
    this.refreshCartPricing(); // recalcular descuentos (cumpleaños, etc.)
  }

  onToggleDelivery(): void {
    if (this.isDelivery) this.selectedTableId = null;
  }

  onDniChange(): void {
    const dni = (this.customerDni || '').trim();
    if (!dni || dni.length < 8 || this.isGeneric) {
      this.isExistingClient = false;
      return;
    }

    this.api.getClientesByDNI(dni).subscribe({
      next: (c: any | null) => {
        if (c?.idClient) {
          this.isExistingClient = true;
          this.applyLoadedClient(c);
        } else this.isExistingClient = false;
      },
      error: () => {
        this.isExistingClient = false;
      },
    });
  }

  onCustomerBirthdateChange(): void {
    if (this.isGeneric) return;
    this.refreshCartPricing();
  }

  /* ========= AUTOCOMPLETE PRODUCTO ========= */
  onProductTyping(): void {
    this.selectedProductId = null;
    this.filtrarProductos();
  }

  clearProductSelection(): void {
    this.productSearch = '';
    this.selectedProductId = null;
    this.filteredProducts = this.products.slice(0, 10);
  }

  filtrarProductos(): void {
    const q = (this.productSearch || '').toLowerCase().trim();
    this.filteredProducts = !q
      ? this.products.slice(0, 10)
      : this.products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 10);
  }

  get sortedTables() {
    if (!this.tables) return [];
    return [...this.tables].sort((a, b) => {
      if (a.number === 'delivery') return 1;
      if (b.number === 'delivery') return -1;
      return Number(a.number) - Number(b.number);
    });
  }

  onProductoSeleccionado(idProduct: number | null): void {
    if (idProduct == null) return;
    const prod = this.products.find((p) => p.idProduct === idProduct);
    if (!prod) return;

    this.selectedProductId = prod.idProduct;
    this.productSearch = prod.name;
  }

  ensureCustomer(): Promise<{ idClient: number; name: string; dni: string }> {
    return new Promise((resolve, reject) => {
      if (this.isGeneric && this.currentCustomer?.idClient) return resolve(this.currentCustomer);

      const dni = this.isGeneric ? GENERIC_DNI : (this.customerDni || '').trim();
      const name = this.isGeneric ? 'Cliente Genérico' : (this.customerName || '').trim();
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
        error: () => reject('❌ No se pudo asegurar/obtener el cliente.'),
      });
    });
  }

  private recalcItemPricing(i: CartItem): void {
    const pct = this.getDiscountPct(i.idProduct);
    i.discountPct = pct;
    i.subtotal = subTotal(i.unitPrice, i.quantity, pct);
  }

  private refreshCartPricing(): void {
    this.cart.forEach((i) => this.recalcItemPricing(i));
  }

  // cancelar venta SIN tocar stock desde frontend (el backend se encarga al cambiar status)
  cancelSale(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      maxWidth: '95vw',
      panelClass: 'custom-confirm-dialog',
      disableClose: true,
      data: { title: 'Cancelar venta', message: '¿Seguro que deseas cancelar esta venta?' },
    });

    dialogRef.afterClosed().subscribe((ok) => {
      if (!ok || !this.saleId) return;

      this.isSaving = true;

      this.api.updateSale(this.saleId!, { status: 'Cancelled' }).subscribe({
        next: () => {
          // Ahora devolvemos stock del pedido cancelado
          this.api.refundInventory(this.saleId!).subscribe({
            next: () => {
              this.toast.mostrarMensaje('✅ Venta cancelada y stock devuelto');
              this.isSaving = false;
              this.goBack();
            },
            error: () => {
              this.toast.mostrarMensaje(
                '⚠️ Venta cancelada pero hubo un error al devolver el stock'
              );
              this.isSaving = false;
              this.goBack();
            },
          });
        },
        error: () => {
          this.toast.mostrarMensaje('❌ Error al cancelar la venta (estado)');
          this.isSaving = false;
        },
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
    this.currentCustomer = {
      idClient: toNum(c.idClient),
      name: String(c.name ?? ''),
      dni: String(c.dni ?? ''),
    };
    this.customerName = isGeneric ? 'Cliente Genérico' : this.currentCustomer.name;
    this.customerDni = isGeneric ? GENERIC_DNI : this.currentCustomer.dni;
    this.customerBirthdate = c?.birthdate ?? '2000-01-01';
    this.refreshCartPricing(); // por si aplica descuento de cumpleaños
  }

  addToCart(): void {
    if (!this.selectedProductId || this.selectedQty <= 0) return;
    const prod = this.products.find((p) => p.idProduct === this.selectedProductId);
    if (!prod) return;

    const pct = this.getDiscountPct(prod.idProduct);
    const existing = this.cart.find((i) => i.idProduct === prod.idProduct);

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
        subtotal: subTotal(prod.price, this.selectedQty, pct),
      });
    }

    this.selectedProductId = null;
    this.selectedQty = 1;
    this.productSearch = '';
    this.filteredProducts = this.products.slice(0, 10);
  }

  updateQty(item: CartItem, qty: number): void {
    item.quantity = Math.max(1, Math.floor(toNum(qty) || 1));
    const pct = this.getDiscountPct(item.idProduct);
    item.discountPct = pct;
    item.subtotal = subTotal(item.unitPrice, item.quantity, pct);
  }

  removeItem(item: CartItem): void {
    this.cart = this.cart.filter((i) => i !== item);
  }

  clearCart(): void {
    this.cart = [];
  }

  soloNumeros(e: KeyboardEvent): void {
    const ok =
      /^\d$/.test(e.key) || ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key);
    if (!ok) e.preventDefault();
  }

  private normalizeNoAccent(s: string): string {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private limaDayName(date: Date): DayWeek {
    const raw = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      weekday: 'long',
    }).format(date);
    const key = this.normalizeNoAccent(raw);
    const map: Record<string, DayWeek> = {
      lunes: 'Lunes',
      martes: 'Martes',
      miercoles: 'Miercoles',
      jueves: 'Jueves',
      viernes: 'Viernes',
      sabado: 'Sabado',
      domingo: 'Domingo',
    };
    return map[key] ?? 'General';
  }

  // 🎂 ¿Es cumpleaños de un cliente NO genérico?
  private isBirthdayNonGeneric(): boolean {
    if (this.isGeneric) return false;

    const birth = (this.customerBirthdate || '').trim();
    if (!birth) return false;

    // oxlint-disable-next-line no-unused-vars
    const [y, m, d] = birth.split('-').map((v) => parseInt(v, 10));
    if (!m || !d) return false;

    const ref = this.saleRefDate || new Date();
    const month = ref.getMonth() + 1;
    const day = ref.getDate();

    return month === m && day === d;
  }

  // Descuento normal según día/producto
  private getBaseDiscountPct(productId: number): number {
    const today = this.limaDayName(this.saleRefDate);
    const active = this.discounts.filter((d) => !d.disabled && d.idProduct === productId);
    const pick = active.filter((d) => d.typeDay !== 'General' && d.typeDay === today);
    const bag = pick.length ? pick : active.filter((d) => d.typeDay === 'General');
    return bag.length ? Math.max(...bag.map((d) => d.percentage || 0)) : 0;
  }

  // Descuento final (incluye cumpleaños 50%)
  private getDiscountPct(productId: number): number {
    // 🎂 Si es cliente NO genérico y HOY es su cumpleaños → 50% fijo
    if (this.isBirthdayNonGeneric()) {
      return 50;
    }

    return this.getBaseDiscountPct(productId);
  }

  private buildLocalDate(orderDate: string, orderTime?: string): Date {
    const [y, m, d] = (orderDate || '').split('-').map((n) => parseInt(n, 10));
    let hh = 0,
      mm = 0,
      ss = 0;
    if (orderTime) {
      const [h, m2, s] = orderTime.split(':').map((n) => parseInt(n || '0', 10));
      hh = h || 0;
      mm = m2 || 0;
      ss = s || 0;
    }
    return new Date(y, m - 1, d, hh, mm, ss);
  }

  private mapProduct = (raw: any): Product => ({
    idProduct: toNum(raw?.idProduct ?? raw?.id_producto ?? raw?.id),
    name: String(raw?.name ?? raw?.nombre ?? ''),
    price: toNum(raw?.price ?? raw?.precio ?? 0),
    disabled: !!raw?.disabled,
  });

  private mapDiscount = (d: any): Discount => ({
    idProduct: toNum(d?.idProduct ?? d?.id_producto),
    percentage: toNum(d?.percentage ?? d?.porcentaje ?? 0),
    typeDay: String(d?.typeDay ?? d?.dia_semana ?? 'General') as DayWeek,
    disabled: !!d?.disabled,
  });

  private mapDetailToCart(d: any): CartItem {
    const idProduct = toNum(d?.idProduct ?? d?.id_producto);
    const prod = this.allProducts.find((p) => p.idProduct === idProduct);
    const qty = toNum(d?.quantity ?? d?.cantidad ?? 1);
    const unit = prod?.price ?? toNum(d?.subtotal) / Math.max(1, qty);
    const pct = this.getDiscountPct(idProduct);
    return {
      idProduct,
      name: prod?.name ?? `#${idProduct}`,
      unitPrice: unit,
      quantity: qty,
      discountPct: pct,
      subtotal: subTotal(unit, qty, pct),
    };
  }

  onDniInput(term: string): void {
    const q = (term || '').trim();
    this.customerDni = q;

    if (q.length < 1) {
      this.dniSuggestions = [];
      return;
    }

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
        .filter((c) => c.dni?.toLowerCase().startsWith(p))
        .slice(0, 10);
    };

    if (this.allClientsLoaded) {
      doFilter();
      return;
    }

    const list$ = (this.api as any).getAllClientes?.() || (this.api as any).getClientes?.();

    if (!list$) {
      this.allClientsLoaded = true;
      this.allClientsCache = [];
      this.dniSuggestions = [];
      return;
    }

    list$.subscribe({
      next: (arrList: any[]) => {
        const list = Array.isArray(arrList) ? arrList : [];
        this.allClientsCache = list
          .map((c) => ({
            idClient: c?.idClient ?? c?.id_cliente,
            name: String(c?.name ?? c?.nombre ?? ''),
            dni: String(c?.dni ?? ''),
            birthdate: c?.birthdate ?? c?.fecha_nacimiento,
          }))
          .filter((c) => !!c.dni);
        this.allClientsLoaded = true;
        doFilter();
      },
      error: () => {
        this.allClientsLoaded = true;
        this.allClientsCache = [];
        this.dniSuggestions = [];
      },
    });
  }
}

/* ==================== HELPERS ==================== */
function toNum(v: any, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function arr<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}
function subTotal(unit: number, qty: number, pct: number): number {
  const base = (unit || 0) * Math.max(1, qty || 1);
  return Math.round(base * (1 - toNum(pct) / 100) * 100) / 100;
}
