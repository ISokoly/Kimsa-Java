import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';

import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

const GENERIC_DNI = '00000001';

type DayWeek = 'Lunes'|'Martes'|'Miercoles'|'Jueves'|'Viernes'|'Sabado'|'Domingo'|'General';

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
    MatFormFieldModule
  ],
  templateUrl: './registrar-venta.component.html',
  styleUrls: ['./registrar-venta.component.scss']
})
export class RegistrarVentaComponent implements OnInit {
  /* ==================== PROPIEDADES ==================== */
  saleId: number | null = null;
  isSaving = false;

  // Cliente
  isGeneric = true;
  customerName = 'Cliente Genérico';
  customerDni  = GENERIC_DNI;
  currentCustomer: any = null;

  // Mesa
  tables: any[] = [];
  selectedTableId: number | null = null;

  // Productos & Carrito
  products: Array<{ idProduct:number; name:string; price:number; }> = [];
  selectedProductId: number | null = null;
  selectedQty = 1;
  cart: Array<{ 
    idProduct:number; name:string; unitPrice:number; quantity:number; subtotal:number; 
    discountPct?: number 
  }> = [];

  // Descuentos
  private discounts: Array<{ idProduct:number; percentage:number; typeDay:DayWeek; disabled:boolean; }> = [];
  private saleRefDate: Date = new Date(); // referencia para calcular el día (Lima)

  /* ==================== GETTERS ==================== */
  get total(): number {
    return this.cart.reduce((acc, it) => acc + (it.subtotal || 0), 0);
  }

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  /* ==================== CICLO DE VIDA ==================== */
  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      this.saleId = id ? +id : null;
      this.init();
    });
  }

  private init(): void {
    this.loadTables();
    this.loadProducts();
    this.loadDiscounts();                 // ⬅️ cargar descuentos

    if (this.saleId) {
      this.isGeneric = false;
      this.loadExistingSale(this.saleId); // ⬅️ fijará saleRefDate a la fecha/hora de la venta
    } else {
      this.isGeneric = true;
      this.customerName = 'Cliente Genérico';
      this.customerDni  = GENERIC_DNI;
      this.saleRefDate  = new Date();     // nueva venta => hoy
    }
  }

  /* ==================== CARGA DE DATOS ==================== */
  loadTables(): void {
    this.api.getMesas().subscribe({
      next: (res: any[]) => this.tables = res || [],
      error: () => this.toast.mostrarMensaje('❌ Error al cargar mesas')
    });
  }

  loadProducts(): void {
    this.api.getProductos().subscribe({
      next: (res: any) => {
        const arr = Array.isArray(res) ? res : (res ? [res] : []);
        this.products = arr.map((raw: any) => ({
          idProduct: Number(raw?.idProduct ?? raw?.id_producto ?? raw?.id),
          name:      String(raw?.name ?? raw?.nombre ?? ''),
          price:     Number(raw?.price ?? raw?.precio ?? 0),
        }));
        if (this.products.length === 0) this.toast.mostrarMensaje('⚠️ No hay productos disponibles');
      },
      error: () => { this.toast.mostrarMensaje('❌ Error al cargar productos'); this.products = []; }
    });
  }

  loadDiscounts(): void {
    this.api.getDescuentos().subscribe({
      next: (list: any[]) => {
        const arr = Array.isArray(list) ? list : (list ? [list] : []);
        this.discounts = arr.map(d => ({
          idProduct: Number(d?.idProduct ?? d?.id_producto),
          percentage: Number(d?.percentage ?? d?.porcentaje ?? 0),
          typeDay: (String(d?.typeDay ?? d?.dia_semana ?? 'General') as DayWeek),
          disabled: !!d?.disabled
        }));
      },
      error: () => { this.discounts = []; }
    });
  }

  loadExistingSale(id: number): void {
    this.api.getSaleById(id).subscribe({
      next: (sale: any) => {
        this.selectedTableId = sale?.idTable ?? sale?.id_mesa ?? null;

        // fecha/hora de la venta -> referencia para descuentos
        const od = String(sale?.orderDate ?? sale?.fecha_pedido ?? '');
        const ot = String(sale?.orderTime ?? sale?.hora_pedido ?? '00:00:00');
        this.saleRefDate = this.buildLocalDate(od, ot);

        if (sale?.idClient) {
          this.currentCustomer = { idClient: sale.idClient, name: sale.customerName ?? '', dni: sale.customerDni ?? '' };
          this.customerName = this.currentCustomer.name || '';
          this.customerDni  = this.currentCustomer.dni  || '';
        }

        this.api.getOrderDetailsByOrderId(id).subscribe({
          next: (details: any[]) => {
            this.cart = (details || []).map((d: any) => {
              const idProduct = Number(d?.idProduct ?? d?.id_producto);
              const prod = this.products.find(p => p.idProduct === idProduct);
              const qty = Number(d?.quantity ?? d?.cantidad ?? 1);
              const unitPrice = prod?.price ?? (Number(d?.subtotal) / Math.max(1, qty));
              const pct = this.getDiscountPct(idProduct); // ⬅️ % del día
              return {
                idProduct,
                name: prod?.name ?? `#${idProduct}`,
                unitPrice,
                quantity: qty,
                subtotal: this.calcSubtotal(unitPrice, qty, pct),
                discountPct: pct
              };
            });
          },
          error: () => this.cart = []
        });
      },
      error: () => this.toast.mostrarMensaje('❌ No se pudo cargar la venta')
    });
  }

  /* ==================== CLIENTE ==================== */
  toggleGeneric(): void {
    this.isGeneric = !this.isGeneric;
    if (this.isGeneric) {
      this.customerName = 'Cliente Genérico';
      this.customerDni  = GENERIC_DNI;
      this.currentCustomer = null;
    } else {
      this.customerName = '';
      this.customerDni  = '';
      this.currentCustomer = null;
    }
  }

  ensureCustomer(): Promise<any> {
    return new Promise((resolve, reject) => {
      const dni = (this.customerDni || '').trim();
      const name = (this.customerName || '').trim();

      if (this.isGeneric) {
        this.api.getClientesByDNI(GENERIC_DNI).subscribe({
          next: (c: any) => {
            const out = { idClient: c.idClient, name: c.name, dni: c.dni };
            this.currentCustomer = out; resolve(out);
          },
          error: () => reject(`No existe cliente genérico (DNI ${GENERIC_DNI}).`)
        });
        return;
      }

      this.api.getClientesByDNI(dni).subscribe({
        next: (found: any) => {
          if (found?.idClient) {
            const out = { idClient: found.idClient, name: found.name, dni: found.dni };
            this.currentCustomer = out; resolve(out);
          } else {
            if (!dni || !name) return reject('Complete nombre y DNI.');
            this.api.createClientes({ name, dni, birthdate: '2000-01-01' }).subscribe({
              next: () => {
                this.api.getClientesByDNI(dni).subscribe((nuevo: any) => {
                  const out = { idClient: nuevo.idClient, name: nuevo.name, dni: nuevo.dni };
                  this.currentCustomer = out; resolve(out);
                });
              },
              error: () => reject('No se pudo crear el cliente.')
            });
          }
        },
        error: () => reject('Error al validar DNI.')
      });
    });
  }

  /* ==================== DESCUENTO (mínimo y directo) ==================== */

  /** Nombre de día (Lima) -> 'Lunes'...'Domingo' */
  private limaDayName(date: Date): DayWeek {
    const name = new Intl.DateTimeFormat('es-PE',{ timeZone:'America/Lima', weekday:'long' })
      .format(date);
    const cap = name.charAt(0).toUpperCase() + name.slice(1); // 'lunes' -> 'Lunes'
    return (cap as DayWeek);
  }

  /** % aplicable: si hay descuento para el día => ese; si no => General; ignora los disabled. Si hay varios, toma el mayor. */
  private getDiscountPct(productId: number): number {
    const today = this.limaDayName(this.saleRefDate);
    const active = this.discounts.filter(d => !d.disabled && d.idProduct === productId);
    const daySpecific = active.filter(d => d.typeDay !== 'General' && d.typeDay === today);
    const general     = active.filter(d => d.typeDay === 'General');

    const pickFrom = daySpecific.length ? daySpecific : general;
    if (!pickFrom.length) return 0;

    return Math.max(...pickFrom.map(d => d.percentage || 0));
  }

  private calcSubtotal(unitPrice: number, qty: number, pct: number): number {
    const base = (unitPrice || 0) * Math.max(1, qty || 1);
    return Math.round(base * (1 - (pct/100)) * 100) / 100;
  }

  /** Construye Date local (no UTC) desde yyyy-MM-dd + HH:mm:ss[.SSS] */
  private buildLocalDate(orderDate: string, orderTime?: string): Date {
    const [y,m,d] = (orderDate || '').split('-').map(n => parseInt(n,10));
    let hh=0, mm=0, ss=0, ms=0;
    if (orderTime) {
      const [hms, msPart] = orderTime.split('.');
      const [h,m2,s] = (hms||'').split(':').map(n => parseInt(n||'0',10));
      hh=h||0; mm=m2||0; ss=s||0; ms=msPart?parseInt(msPart,10):0;
    }
    return new Date(y, (m-1), d, hh, mm, ss, ms);
  }

  /* ==================== CARRITO ==================== */
  addToCart(): void {
    if (!this.selectedProductId || this.selectedQty <= 0) return;
    const prod = this.products.find(p => p.idProduct === this.selectedProductId);
    if (!prod) return;

    const pct = this.getDiscountPct(prod.idProduct);
    const existing = this.cart.find(i => i.idProduct === prod.idProduct);

    if (existing) {
      existing.quantity += this.selectedQty;
      existing.discountPct = pct; // mostrar el % vigente
      existing.subtotal = this.calcSubtotal(existing.unitPrice, existing.quantity, pct);
    } else {
      this.cart.push({
        idProduct: prod.idProduct,
        name: prod.name,
        unitPrice: prod.price,
        quantity: this.selectedQty,
        discountPct: pct,
        subtotal: this.calcSubtotal(prod.price, this.selectedQty, pct)
      });
    }

    this.selectedProductId = null;
    this.selectedQty = 1;
  }

  updateQty(item: any, qty: number): void {
    const q = Math.max(1, Math.floor(Number(qty) || 1));
    item.quantity = q;
    const pct = this.getDiscountPct(item.idProduct);
    item.discountPct = pct;
    item.subtotal = this.calcSubtotal(item.unitPrice, item.quantity, pct);
  }

  removeItem(item: any): void {
    this.cart = this.cart.filter(i => i !== item);
  }

  clearCart(): void {
    this.cart = [];
  }

  /* ==================== GUARDAR VENTA ==================== */
  async saveSale(): Promise<void> {
    if (!this.selectedTableId) {
      this.toast.mostrarMensaje('⚠️ Seleccione una mesa'); return;
    }
    if (!this.cart.length) {
      this.toast.mostrarMensaje('⚠️ Agregue al menos un producto'); return;
    }

    this.isSaving = true;
    try {
      const customer = await this.ensureCustomer();
      const user = this.api.getUsuarioActual?.();
      const idUser = user?.idUser ?? user?.id_usuario ?? 1;

      const payload = {
        idClient: customer.idClient,
        idUser,
        idTable: this.selectedTableId,
        items: this.cart.map(i => ({ idProduct: i.idProduct, quantity: i.quantity }))
      };

      const req$ = this.saleId ? this.api.updateSale(this.saleId, payload) : this.api.createSale(payload);
      req$.subscribe({
        next: () => { this.toast.mostrarMensaje('✅ Venta registrada'); this.router.navigate(['/view/ventas']); },
        error: () => this.toast.mostrarMensaje('❌ Error al registrar la venta')
      });

    } catch (err: any) {
      this.toast.mostrarMensaje('❌ ' + (err?.toString?.() ?? 'Error al validar cliente'));
    } finally {
      this.isSaving = false;
    }
  }

  /* ==================== UTILIDADES ==================== */
  goBack(): void { this.router.navigate(['/view/ventas']); }
}
