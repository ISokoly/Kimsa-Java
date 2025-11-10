// oxlint-disable no-unused-expressions
import { Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';
import { DecimalPipe } from '@angular/common';

import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageLoadingService } from '../../../core/services/page-loading.service';
import { OverlayHandle, OverlayPortalService } from '../../../core/services/overlay-portal.service';

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [
    FormsModule, RouterModule,
    MatInputModule, MatGridListModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatAutocompleteModule, MatOptionModule,
    DecimalPipe
  ],
  templateUrl: './compras.component.html',
  styleUrls: ['./compras.component.scss']
})
export class ComprasComponent implements OnInit {

  contentReady = false;
  private pendingLoads = 0;
  isSaving = false;

  suppliers: any[] = [];
  supplies: any[] = [];

  supplierQuery = '';
  supplyQuery = '';

  filteredSuppliers: any[] = [];
  filteredSupplies: any[] = [];

  // 🔒 bloqueo después de seleccionar
  supplierLocked = false;
  supplyLocked = false;

  selectedPurchase: any = null;

  dto: { idSupplier: number | null } = { idSupplier: null };
  newItem: { idSupply: number | null, quantity: number } = { idSupply: null, quantity: 1 };

  items: Array<{ idSupply: number, name: string, unitPrice: number, quantity: number, subtotal: number }> = [];

  grandTotal = 0;

  @ViewChild('newSupplierTpl') newSupplierTpl!: TemplateRef<any>;
  private overlay = inject(OverlayPortalService);
  private newSupplierRef?: OverlayHandle;

  newSupplier: any = { name: '', phone: '', address: '', email: '' };

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private pageLoading: PageLoadingService,
    private router: Router
  ) { }

  /* ====== loading agrupado ====== */
  private groupStart() { if (this.pendingLoads === 0) this.pageLoading.start(); this.pendingLoads++; }
  private groupEnd() { this.pendingLoads = Math.max(0, this.pendingLoads - 1); if (this.pendingLoads === 0) { this.pageLoading.stop(); this.contentReady = true; } }

  async ngOnInit(): Promise<void> {
    this.contentReady = false;
    this.groupStart();
    await this.loadCatalogs();
    this.refreshFilters();
  }

  private async loadCatalogs(): Promise<void> {
    try {
      const [prov, ins] = await Promise.all([
        firstValueFrom(this.api.getSuppliers()),
        firstValueFrom(this.api.getSupplies())
      ]);
      this.suppliers = Array.isArray(prov) ? prov : [];
      this.supplies  = Array.isArray(ins)  ? ins  : [];
    } catch {
      this.suppliers = []; this.supplies = [];
      this.toast.mostrarMensaje('❌ Error al cargar catálogos');
    } finally {
      this.groupEnd();
    }
  }

  /* ========== Helpers ========== */
  private norm(v: any): string { return (v ?? '').toString().trim().toLowerCase(); }

  private refreshFilters(): void {
    this.filteredSuppliers = this.suppliers.slice(0, 30);
    this.filteredSupplies  = this.supplies.slice(0, 30);
  }

  /* ========== Proveedor (autocomplete) ========== */
  onSupplierInput(): void {
    if (this.supplierLocked) return; // no filtrar si está bloqueado
    const q = this.norm(this.supplierQuery);
    this.filteredSuppliers = !q
      ? this.suppliers.slice(0, 30)
      : this.suppliers.filter(s => this.norm(s.name).includes(q)).slice(0, 30);
  }

  onSupplierOptionSelected(ev: any): void {
    const value = ev?.option?.value;
    if (value && value.idSupplier) {
      this.dto.idSupplier = value.idSupplier;
      this.supplierQuery = value.name;
      this.supplierLocked = true;   // 🔒
      this.filteredSuppliers = [];  // ocultar sugerencias
    }
  }

  onSupplierClear(e?: MouseEvent): void {
    if (e) e.stopPropagation();
    this.dto.idSupplier = null;
    this.supplierQuery = '';
    this.supplierLocked = false; // 🔓
    this.refreshFilters();
  }

  /* ========== Insumo (autocomplete) ========== */
  onSupplyInput(): void {
    if (this.supplyLocked) return;
    const q = this.norm(this.supplyQuery);
    if (!q) {
      this.filteredSupplies = this.supplies.slice(0, 30);
      this.newItem.idSupply = null;
      return;
    }
    this.filteredSupplies = this.supplies
      .filter(s => this.norm(s.name).includes(q))
      .slice(0, 30);
    this.newItem.idSupply = null;
  }

  onSupplyOptionSelected(ev: any): void {
    const value = ev?.option?.value;
    if (value && value.idSupply) {
      this.newItem.idSupply = value.idSupply;
      this.supplyQuery = value.name;
      this.supplyLocked = true;     // 🔒
      this.filteredSupplies = [];   // ocultar sugerencias
      this.syncNewItemPrice();
    }
  }

  onSupplyClear(e?: MouseEvent): void {
    if (e) e.stopPropagation();
    this.newItem.idSupply = null;
    this.supplyQuery = '';
    this.supplyLocked = false; // 🔓
    this.refreshFilters();
  }

  /* ========== Add item flow ========== */
  syncNewItemPrice(): void {
    const _s = this.supplies.find(x => x.idSupply === this.newItem.idSupply);
    // usar price si lo necesitas
  }

  clampNewQty(): void {
    const q = Number(this.newItem.quantity) || 0;
    this.newItem.quantity = q > 0 ? q : 1;
  }

  canAddItem(): boolean {
    return typeof this.newItem.idSupply === 'number' && (Number(this.newItem.quantity) || 0) > 0;
  }

  addItem(): void {
    if (!this.canAddItem()) {
      this.toast.mostrarMensaje('⚠️ Selecciona insumo y cantidad > 0');
      return;
    }
    const s = this.supplies.find(x => x.idSupply === this.newItem.idSupply);
    if (!s) {
      this.toast.mostrarMensaje('❌ Insumo inválido');
      return;
    }

    const unit = Number(s.unitPrice) || 0;
    const qty  = Math.max(0.01, Number(this.newItem.quantity) || 0);
    const existing = this.items.find(i => i.idSupply === s.idSupply);

    if (existing) {
      existing.quantity = round2(existing.quantity + qty);
      existing.subtotal = round2(existing.quantity * existing.unitPrice);
    } else {
      this.items.push({
        idSupply: s.idSupply,
        name: s.name,
        unitPrice: unit,
        quantity: round2(qty),
        subtotal: round2(unit * qty)
      });
    }

    // reset insumo
    this.newItem = { idSupply: null, quantity: 1 };
    this.supplyQuery = '';
    this.supplyLocked = false;
    this.refreshFilters();
    this.recalcGrandTotal();
  }

  updateItemQty(it: any, value: any): void {
    const qty = Math.max(0.01, Number(value) || 0.01);
    it.quantity = round2(qty);
    it.subtotal = round2(it.unitPrice * it.quantity);
    this.recalcGrandTotal();
  }

  removeItem(it: any): void {
    this.items = this.items.filter(x => x !== it);
    this.recalcGrandTotal();
  }

  private recalcGrandTotal(): void {
    this.grandTotal = round2(this.items.reduce((a, x) => a + Number(x.subtotal || 0), 0));
  }

  /* ========== Guardado compra ========== */
  canSavePurchase(): boolean {
    return typeof this.dto.idSupplier === 'number'
      && this.items.length > 0
      && this.items.every(i => i.quantity > 0);
  }

  async savePurchase(): Promise<void> {
    if (!this.canSavePurchase()) {
      this.toast.mostrarMensaje('⚠️ Completa proveedor y agrega al menos un insumo con cantidad > 0');
      return;
    }

    this.isSaving = true;
    try {
      const payload = {
        idSupplier: this.dto.idSupplier as number,
        items: this.items.map(i => ({ idSupply: i.idSupply, quantity: i.quantity }))
      };

      if (this.selectedPurchase?.idPurchase) {
        await firstValueFrom(this.api.updatePurchase(this.selectedPurchase.idPurchase, payload));
        this.toast.mostrarMensaje('✅ Compra actualizada');
      } else {
        await firstValueFrom(this.api.createPurchase(payload));
        this.toast.mostrarMensaje('✅ Compra registrada');
      }

      this.resetForm();
    } catch {
      this.toast.mostrarMensaje('❌ Error al guardar la compra');
    } finally {
      this.isSaving = false;
    }
  }

  cancelEdit(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.selectedPurchase = null;
    this.dto = { idSupplier: null };
    this.newItem = { idSupply: null, quantity: 1 };
    this.items = [];
    this.grandTotal = 0;
    this.supplierQuery = '';
    this.supplyQuery = '';
    this.supplierLocked = false;
    this.supplyLocked = false;
    this.refreshFilters();
  }

  /* ========== Nuevo proveedor (overlay) ========== */
  openNewSupplierForm(): void {
    if (this.supplierLocked) return; // no abrir si está bloqueado
    this.newSupplier = { name: '', phone: '', address: '', email: '' };
    this.newSupplierRef?.close();
    this.newSupplierRef = this.overlay.open(this.newSupplierTpl);
  }

  closeNewSupplierForm(): void {
    this.newSupplierRef?.close();
    this.newSupplierRef = undefined;
  }

  async saveNewSupplier(): Promise<void> {
    if (!this.newSupplier.name?.trim()) {
      this.toast.mostrarMensaje('⚠️ Escribe un nombre de proveedor');
      return;
    }

    this.isSaving = true;
    try {
      const created = await firstValueFrom(this.api.createSupplier(this.newSupplier));
      if (created?.idSupplier) {
        this.suppliers.push(created);
        this.dto.idSupplier = created.idSupplier;
        this.supplierQuery = created.name;
        this.supplierLocked = true;   // 🔒 al crear también
        this.filteredSuppliers = [];
        this.toast.mostrarMensaje('✅ Proveedor registrado');
        this.closeNewSupplierForm();
      } else {
        this.toast.mostrarMensaje('❌ Respuesta inválida al crear proveedor');
      }
    } catch {
      this.toast.mostrarMensaje('❌ Error al registrar proveedor');
    } finally {
      this.isSaving = false;
    }
  }

  /* ========== Navegación ========== */
  goBack(): void { this.router.navigate(['/view/inventario']); }
}

/* ======== Helpers ======== */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
