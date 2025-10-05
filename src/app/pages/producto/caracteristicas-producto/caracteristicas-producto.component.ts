import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import { MatSelectModule } from "@angular/material/select";
import { CaracteristicasComponent } from "../caracteristicas/caracteristicas.component";

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
    CaracteristicasComponent
  ],
  templateUrl: './caracteristicas-producto.component.html',
  styleUrl: './caracteristicas-producto.component.scss'
})
export class CaracteristicasProductoComponent implements OnInit {

  @Output() closed = new EventEmitter<void>();
  @Input() productoSeleccionado: number | null = null;
  @Input() categoriaSeleccionada: number | null = null;
  @Input() soloFormulario: boolean = false;
  @Output() productFeatureDeleted = new EventEmitter<number>();

  productFeatures: any[] = [];
  formProductFeature = { featureValue: '', product: 0 as number | null, feature: 0 as number | null };
  selectedProductFeature: any = null;

  mostrarFormularioAgregarProductFeature = false;
  mostrarCrearFeature = false;

  features: any[] = [];
  productCategoryId: number | null = null;
  selectedCategoryId: number | null = null;
  constructor(private apiService: ApiService,
    private toastService: ToastService,
    private cd: ChangeDetectorRef) { }

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
      // Guardamos el id del producto
      this.formProductFeature.product = product.idProduct;

      // Ya no filtramos por categoría, simplemente cargamos todas las características
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
      this.productFeatures = data;
    });
  }

  /* ==================== CREAR / ACTUALIZAR ==================== */
  createProductFeature(): void {
    if (!this.formProductFeature.featureValue.trim()) {
      this.toastService.mostrarMensaje('❌ El valor de la característica es obligatorio.');
      return;
    }

    const payload = {
      featureValue: this.formProductFeature.featureValue,
      product: { idProduct: this.productoSeleccionado }, // ✅ debe ser un objeto
      feature: this.formProductFeature.feature ? { idFeature: Number(this.formProductFeature.feature) } : null
    };

    this.apiService.createProductFeature(payload).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Detalle de característica creado correctamente');
        this.loadProductFeatures();
        this.cancelEditProductFeature();
      },
      error: (err) => {
        this.toastService.mostrarMensaje('❌ Ocurrió un error al crear el detalle de característica.');
      }
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
      product: { idProduct: this.productoSeleccionado }, // ✅ objeto
      feature: this.formProductFeature.feature ? { idFeature: Number(this.formProductFeature.feature) } : null
    };

    this.apiService.updateProductFeature(this.selectedProductFeature.idProductFeature, payload).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Detalle de característica actualizado correctamente');
        this.loadProductFeatures();
        this.cancelEditProductFeature();
      },
      error: (err) => {
        this.toastService.mostrarMensaje('❌ Ocurrió un error al actualizar el detalle de característica.');
      }
    });
  }

  /* ==================== FORMULARIO ==================== */
  abrirFormularioAgregarProductFeature(productFeature: any = null): void {
    if (productFeature) {
      this.selectedProductFeature = productFeature;

      const featureId =
        productFeature.feature?.idFeature ??
        productFeature.idFeature ??
        null;

      const featureEncontrado = this.features.find(f => f.idFeature === featureId) || null;

      this.formProductFeature = {
        featureValue: productFeature.featureValue,
        product: this.productoSeleccionado,
        feature: featureEncontrado ? featureEncontrado.idFeature : null
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

    if (this.soloFormulario) {
      this.closed.emit();
    }

    this.loadProductFeatures();
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

  abrirCrearFeature(): void {
    this.mostrarCrearFeature = true;
  }

  onFeatureCreated(): void {
    this.mostrarCrearFeature = false;
  }

  getGridColumns(): number {
    if (this.productFeatures.length <= 3) return 1;
    return Math.ceil(Math.sqrt(this.productFeatures.length));
  }

  getModalWidth(): string {
    const extra = Math.floor(this.productFeatures.length / 4) * 200;
    return (400 + extra) + 'px';
  }
}
