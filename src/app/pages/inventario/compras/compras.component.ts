// oxlint-disable no-unused-expressions
import { Component, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';

import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageLoadingService } from '../../../core/services/page-loading.service';
import { firstValueFrom } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { OverlayHandle, OverlayPortalService } from '../../../core/services/overlay-portal.service';

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [
    FormsModule, RouterModule,
    MatInputModule, MatGridListModule, MatButtonModule, MatSelectModule, MatIconModule,
    MatFormFieldModule, DecimalPipe
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

  selectedPurchase: any = null;
  dto: { idSupplier: number | null } = { idSupplier: null };
  newItem: any = { idSupply: null, quantity: 1 };

  items: any[] = [];

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

  private groupStart() { if (this.pendingLoads === 0) this.pageLoading.start(); this.pendingLoads++; }
  private groupEnd() { this.pendingLoads = Math.max(0, this.pendingLoads - 1); if (this.pendingLoads === 0) { this.pageLoading.stop(); this.contentReady = true; } }

  async ngOnInit(): Promise<void> {
    this.contentReady = false;
    this.groupStart(); await this.loadCatalogs();
  }

  private async loadCatalogs(): Promise<void> {
    try {
      const [prov, ins] = await Promise.all([
        firstValueFrom(this.api.getSuppliers()),
        firstValueFrom(this.api.getSupplies())
      ]);
      this.suppliers = Array.isArray(prov) ? prov : [];
      this.supplies = Array.isArray(ins) ? ins : [];
    } catch {
      this.suppliers = []; this.supplies = [];
      this.toast.mostrarMensaje('❌ Error al cargar catálogos');
    } finally {
      this.groupEnd();
    }
  }

  /* ======== Add item flow ======== */
  syncNewItemPrice(): void {
    const _s = this.supplies.find(x => x.idSupply === this.newItem.idSupply);
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
    const qty = Math.max(0.01, Number(this.newItem.quantity) || 0);
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

    this.newItem = { idSupply: null, quantity: 1 };
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

  /* ======== Save purchase (multi-ítem) ======== */
  canSavePurchase(): boolean {
    return typeof this.dto.idSupplier === 'number' && this.items.length > 0 && this.items.every(i => i.quantity > 0);
  }

  async savePurchase(): Promise<void> {
    if (!this.canSavePurchase()) {
      this.toast.mostrarMensaje('⚠️ Completa proveedor y agrega al menos un insumo con cantidad > 0');
      return;
    }

    this.isSaving = true;
    try {
      // Payload multi-ítem (ajusta al backend)
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

      // Limpia formulario
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
  }


  onSupplierSelect(value: any, select: any): void {
    if (value === 'new') {
      setTimeout(() => select.writeValue(null));
      this.openNewSupplierForm();
      return;
    }
    this.dto.idSupplier = (value ?? null);
  }

  openNewSupplierForm(): void {
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
        // añade a la lista local, selecciona y cierra overlay
        this.suppliers.push(created);
        this.dto.idSupplier = created.idSupplier;
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

  goBack(): void { this.router.navigate(['/view/compras']); }
}

/* ======== Helpers ======== */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
