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
import { HoverScrollDirective } from '../../../../core/extras/hover-scroll.directive';

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
  @Input() productoSeleccionado: number | null = null;
  @Input() categoriaSeleccionada: number | null = null;
  @Input() soloFormulario: boolean = false;
  @Output() productFeatureDeleted = new EventEmitter<number>();
  @ViewChild('formCrearCaractTpl') formCrearCaractTpl!: TemplateRef<any>;
  @ViewChild('formOrgCaractTpl') formOrgCaractTpl!: TemplateRef<any>;

  private overlay = inject(OverlayPortalService);

  private crearCaractRef?: OverlayHandle;
  private orgCaractRef?: OverlayHandle;

  productFeatures: any[] = [];
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

  ngOnInit(): void {
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
    this.loadAllFeatures();

    this.cd.detectChanges();
  }

  /* ==================== CARGA ==================== */
  loadProductData(idProduct: number): void {
    this.apiService.getProductoById(idProduct).subscribe((product: any) => {
      this.formProductFeature.product = product?.idProduct ?? null;
      this.loadAllFeatures();
    });
  }

  loadAllFeatures(): void {
    this.apiService.getFeatures().subscribe((data: any[]) => {
      this.features = data || [];
    });
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
    if (productFeature) {
      this.selectedProductFeature = productFeature;

      const featureId =
        productFeature.feature?.idFeature ??
        productFeature.idFeature ??
        null;

      const found = this.features.find((f: any) => f.idFeature === featureId) || null;

      this.formProductFeature = {
        featureValue: productFeature.featureValue,
        product: this.productoSeleccionado,
        feature: found ? found.idFeature : null
      };
    } else {
      this.selectedProductFeature = null;
      this.formProductFeature = {
        featureValue: '',
        product: this.productoSeleccionado,
        feature: null
      };
    }

    this.mostrarFormularioAgregarProductFeature = true;
  }

  cerrarFormularioProductFeature(): void {
    this.mostrarFormularioAgregarProductFeature = false;
    this.closed.emit();
    this.loadProductFeatures();
  }

  cancelEditProductFeature(): void {
    this.selectedProductFeature = null;
    this.formProductFeature = { featureValue: '', product: this.productoSeleccionado, feature: null };
    this.mostrarFormularioAgregarProductFeature = false;
    if (this.soloFormulario) this.closed.emit();
    this.loadProductFeatures();
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
    if (!productFeature || !productFeature.idProductFeature) return;
    this.abrirFormularioAgregarProductFeature(productFeature);
  }

  deleteProductFeature(idProductFeature: number): void {
    this.apiService.deleteProductFeature(idProductFeature).subscribe(() => {
      this.toastService.mostrarMensaje('✅ Detalle de característica eliminado correctamente');
      this.loadProductFeatures();
      this.productFeatureDeleted.emit(idProductFeature);
    });
  }

  /* ==================== GRID helpers ==================== */
  getGridColumns(): number {
    if (this.productFeatures.length <= 3) return 1;
    return Math.ceil(Math.sqrt(this.productFeatures.length));
  }

  getModalWidth(): string {
    const extra = Math.floor(this.productFeatures.length / 4) * 200;
    return (400 + extra) + 'px';
  }
}