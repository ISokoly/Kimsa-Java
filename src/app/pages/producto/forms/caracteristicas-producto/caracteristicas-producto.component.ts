import { ChangeDetectorRef, Component, EventEmitter, inject, Input, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSelectModule } from '@angular/material/select';

import { CaracteristicasComponent } from '../caracteristicas/caracteristicas.component';
import { OverlayHandle, OverlayPortalService } from '../../../../core/services/overlay-portal.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-caracteristicas-producto',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatAutocompleteModule,
    MatSelectModule,
    CaracteristicasComponent,
  ],
  templateUrl: './caracteristicas-producto.component.html',
  styleUrls: ['./caracteristicas-producto.component.scss']
})
export class CaracteristicasProductoComponent implements OnInit {

  @Output() closed = new EventEmitter<void>();

  // Si hay producto => modo API. Si es null y soloFormulario => modo borrador.
  @Input() productoSeleccionado: number | null = null;
  @Input() categoriaSeleccionada: number | null = null;
  @Input() soloFormulario: boolean = false;

  // 🔹 Borrador embebido
  @Input() draft: Array<{ idFeature: number; featureName: string; featureValue: string }> = [];
  @Output() draftChange = new EventEmitter<Array<{ idFeature: number; featureName: string; featureValue: string }>>();

  @Output() productFeatureDeleted = new EventEmitter<number>();

  @ViewChild('formCrearCaractTpl') formCrearCaractTpl!: TemplateRef<any>;
  @ViewChild('formOrgCaractTpl') formOrgCaractTpl!: TemplateRef<any>;

  private overlay = inject(OverlayPortalService);
  private crearCaractRef?: OverlayHandle;
  private orgCaractRef?: OverlayHandle;

  productFeatures: any[] = [];  // solo modo API
  features: any[] = [];

  formProductFeature = {
    featureValue: '',
    product: 0 as number | null,
    feature: 0 as number | null
  };
  selectedProductFeature: any = null;

  mostrarFormularioAgregarProductFeature = false;
  mostrarCrearFeatureSolo = false;
  mostrarConfigurarFeature = false;

  constructor(private apiService: ApiService, private toastService: ToastService, private cd: ChangeDetectorRef) { }

  async ngOnInit(): Promise<void> {
    // Cargar catálogo de características siempre
    await this.loadAllFeatures();

    // Modo API: requiere producto y categoría
    if (!this.soloFormulario || (this.soloFormulario && this.productoSeleccionado)) {
      if (!this.productoSeleccionado) {
        this.toastService.mostrarMensaje('❌ No se ha seleccionado un producto.');
        return;
      }
      if (!this.categoriaSeleccionada) {
        this.toastService.mostrarMensaje('❌ La categoría del producto es obligatoria.');
        return;
      }
      this.loadProductData(this.productoSeleccionado);
      this.loadProductFeatures();
    }
    this.cd.detectChanges();
  }

  /* ==================== CARGA ==================== */
  loadProductData(idProduct: number): void {
    this.apiService.getProductoById(idProduct).subscribe((product: any) => {
      this.formProductFeature.product = product?.idProduct ?? null;
    });
  }
  async loadAllFeatures(): Promise<void> {
    try {
      const data = await firstValueFrom(this.apiService.getFeatures());
      this.features = data || [];
    } catch {
      this.features = [];
    }
  }
  loadProductFeatures(): void {
    if (!this.productoSeleccionado) return;
    this.apiService.getProductFeaturesByProduct(this.productoSeleccionado).subscribe((data: any[]) => {
      this.productFeatures = data || [];
    });
  }
  onSelectOpened(opened: boolean): void {
    if (opened) this.loadAllFeatures();
  }

  /* ==================== CREAR / ACTUALIZAR ==================== */
  createProductFeature(): void {
    // Modo borrador
    if (this.soloFormulario && !this.productoSeleccionado) {
      if (!this.formProductFeature.feature || !this.formProductFeature.featureValue.trim()) {
        this.toastService.mostrarMensaje('⚠️ Selecciona característica y valor.');
        return;
      }
      const featureDef = this.features.find((f: any) => f.idFeature === Number(this.formProductFeature.feature));
      if (!featureDef) { this.toastService.mostrarMensaje('❌ Característica inválida'); return; }

      const exists = this.draft.find(d => d.idFeature === featureDef.idFeature && d.featureValue.toLowerCase() === this.formProductFeature.featureValue.trim().toLowerCase());
      if (exists) {
        this.toastService.mostrarMensaje('⚠️ Ya agregaste ese valor.');
        return;
      }

      const next = [...this.draft, {
        idFeature: featureDef.idFeature,
        featureName: featureDef.featureName,
        featureValue: this.formProductFeature.featureValue.trim()
      }];
      this.draft = next;
      this.draftChange.emit(next);
      this.formProductFeature = { featureValue: '', product: null, feature: null };
      this.mostrarFormularioAgregarProductFeature = false;
      return;
    }

    // Modo API
    if (!this.formProductFeature.featureValue.trim()) {
      this.toastService.mostrarMensaje('❌ El valor de la característica es obligatorio.');
      return;
    }
    const payload = {
      featureValue: this.formProductFeature.featureValue,
      product: { idProduct: this.productoSeleccionado },
      feature: this.formProductFeature.feature ? { idFeature: Number(this.formProductFeature.feature) } : null
    };
    this.apiService.createProductFeature(payload).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Detalle de característica creado correctamente');
        this.loadProductFeatures();
        this.cancelEditProductFeature();
      },
      error: () => this.toastService.mostrarMensaje('❌ Ocurrió un error al crear el detalle de característica.')
    });
  }

  updateProductFeature(): void {
    // Modo borrador (update simple: reemplazar por índice)
    if (this.soloFormulario && !this.productoSeleccionado) {
      if (!this.selectedProductFeature) return;
      if (!this.formProductFeature.feature || !this.formProductFeature.featureValue.trim()) {
        this.toastService.mostrarMensaje('⚠️ Selecciona característica y valor.');
        return;
      }
      const featureDef = this.features.find((f: any) => f.idFeature === Number(this.formProductFeature.feature));
      if (!featureDef) { this.toastService.mostrarMensaje('❌ Característica inválida'); return; }

      const idx = this.draft.findIndex(d =>
        d.idFeature === this.selectedProductFeature.idFeature &&
        d.featureValue === this.selectedProductFeature.featureValue
      );
      const next = [...this.draft];
      const updated = {
        idFeature: featureDef.idFeature,
        featureName: featureDef.featureName,
        featureValue: this.formProductFeature.featureValue.trim()
      };
      if (idx >= 0) next[idx] = updated; else next.push(updated);
      this.draft = next;
      this.draftChange.emit(next);
      this.cancelEditProductFeature();
      return;
    }

    // Modo API
    if (!this.formProductFeature.featureValue.trim()) {
      this.toastService.mostrarMensaje('❌ El valor de la característica es obligatorio.');
      return;
    }
    if (!this.selectedProductFeature) return;
    const payload = {
      featureValue: this.formProductFeature.featureValue,
      product: { idProduct: this.productoSeleccionado },
      feature: this.formProductFeature.feature ? { idFeature: Number(this.formProductFeature.feature) } : null
    };
    this.apiService.updateProductFeature(this.selectedProductFeature.idProductFeature, payload).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Detalle de característica actualizado correctamente');
        this.loadProductFeatures();
        this.cancelEditProductFeature();
      },
      error: () => this.toastService.mostrarMensaje('❌ Ocurrió un error al actualizar el detalle de característica.')
    });
  }

  /* ==================== FORM PF ==================== */
  abrirFormularioAgregarProductFeature(productFeature: any = null): void {
    // Modo borrador: productFeature es un draft item
    if (this.soloFormulario && !this.productoSeleccionado) {
      if (productFeature) {
        this.selectedProductFeature = productFeature;
        const featureId = Number(productFeature.idFeature ?? null);
        this.formProductFeature = {
          featureValue: productFeature.featureValue,
          product: null,
          feature: featureId || null
        };
      } else {
        this.selectedProductFeature = null;
        this.formProductFeature = { featureValue: '', product: null, feature: null };
      }
      this.mostrarFormularioAgregarProductFeature = true;
      return;
    }

    // Modo API
    if (productFeature) {
      this.selectedProductFeature = productFeature;
      const featureId = productFeature.feature?.idFeature ?? productFeature.idFeature ?? null;
      this.formProductFeature = {
        featureValue: productFeature.featureValue,
        product: this.productoSeleccionado,
        feature: featureId || null
      };
    } else {
      this.selectedProductFeature = null;
      this.formProductFeature = { featureValue: '', product: this.productoSeleccionado, feature: null };
    }
    this.mostrarFormularioAgregarProductFeature = true;
  }

  cerrarFormularioProductFeature(): void {
    this.mostrarFormularioAgregarProductFeature = false;
    if (!this.soloFormulario || this.productoSeleccionado) {
      this.closed.emit();
      this.loadProductFeatures();
    }
  }

  cancelEditProductFeature(): void {
    this.selectedProductFeature = null;
    this.formProductFeature = { featureValue: '', product: this.productoSeleccionado, feature: null };
    this.mostrarFormularioAgregarProductFeature = false;
    if (!this.productoSeleccionado) this.closed.emit();
    if (this.productoSeleccionado) this.loadProductFeatures();
  }

  /* ==================== MODALES: crear base / configurar base ==================== */
  abrirCrearFeatureSolo(): void {
    this.mostrarCrearFeatureSolo = true;
    this.crearCaractRef = this.overlay.open(this.formCrearCaractTpl)
  }
  cerrarCrearFeatureSolo(): void {
    this.mostrarCrearFeatureSolo = false;
    this.crearCaractRef?.close();
    this.crearCaractRef = undefined;
    this.loadAllFeatures();
  }

  abrirConfigurarFeature(): void {
    this.mostrarConfigurarFeature = true;
    this.orgCaractRef = this.overlay.open(this.formOrgCaractTpl)
  }
  cerrarConfigurarFeature(): void {
    this.mostrarConfigurarFeature = false;
    this.orgCaractRef?.close();
    this.orgCaractRef = undefined;
    this.loadAllFeatures();
  }

  /* ==================== UTILIDADES ==================== */
  editProductFeature(productFeature: any): void {
    this.abrirFormularioAgregarProductFeature(productFeature);
  }

  deleteProductFeature(id: number): void {
    // Borrador
    if (this.soloFormulario && !this.productoSeleccionado) {
      const next = this.draft.filter(d => !(d as any)._tmpId && d.idFeature !== id); // si mandas objeto completo
      // o si llega el draft item completo:
      // const next = this.draft.filter(d => d !== idItem);
      this.draft = next;
      this.draftChange.emit(next);
      return;
    }

    // API
    this.apiService.deleteProductFeature(id).subscribe(() => {
      this.toastService.mostrarMensaje('✅ Detalle de característica eliminado correctamente');
      this.loadProductFeatures();
      this.productFeatureDeleted.emit(id);
    });
  }

  /* ==================== GRID helpers (modo lista API) ==================== */
  getGridColumns(): number {
    if (this.productFeatures.length <= 3) return 1;
    return Math.ceil(Math.sqrt(this.productFeatures.length));
  }
  getModalWidth(): string {
    const extra = Math.floor(this.productFeatures.length / 4) * 200;
    return (400 + extra) + 'px';
  }
}
