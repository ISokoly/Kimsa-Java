import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HoverScrollDirective } from "../../categorias/hover-scroll.directive";
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-caracteristicas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    HoverScrollDirective
  ],
  templateUrl: './caracteristicas.component.html',
  styleUrl: './caracteristicas.component.scss'
})
export class CaracteristicasComponent implements OnInit {

  @Output() closed = new EventEmitter<void>();
  @Input() soloFormulario: boolean = false;
  @Output() featureDeleted = new EventEmitter<number>();

  features: any[] = [];
  formFeature = { featureName: '' };
  selectedFeature: any = null;

  mostrarFormularioAgregarFeature = false;

  constructor(private apiService: ApiService, private toastService: ToastService) { }

  ngOnInit(): void {
    this.loadFeatures();
  }

  /* ==================== CARGA ==================== */
  loadFeatures(): void {
    this.apiService.getFeatures().subscribe((data: any[]) => {
      this.features = data || [];
    });
  }

  /* ==================== CREAR / ACTUALIZAR ==================== */
  createFeature(): void {
    if (!this.formFeature.featureName.trim()) {
      this.toastService.mostrarMensaje('❌ El nombre de la característica es obligatorio.');
      return;
    }

    const payload = {
      featureName: this.formFeature.featureName.trim()
    };

    this.apiService.createFeature(payload).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Característica creada correctamente');
        this.loadFeatures();
        this.cancelEditFeature();
      },
      error: () => {
        this.toastService.mostrarMensaje('❌ Error al crear la característica.');
      }
    });
  }

  updateFeature(): void {
    if (!this.formFeature.featureName.trim()) {
      this.toastService.mostrarMensaje('❌ El nombre de la característica es obligatorio.');
      return;
    }

    if (!this.selectedFeature || !this.selectedFeature.idFeature) {
      this.toastService.mostrarMensaje('⚠️ No hay característica seleccionada para actualizar.');
      return;
    }

    const payload = {
      featureName: this.formFeature.featureName.trim()
    };

    this.apiService.updateFeature(this.selectedFeature.idFeature, payload).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Característica actualizada correctamente');
        this.loadFeatures();
        this.cancelEditFeature();
      },
      error: () => {
        this.toastService.mostrarMensaje('❌ Error al actualizar la característica.');
      }
    });
  }

  /* ==================== FORMULARIO ==================== */
  abrirFormularioAgregarFeature(feature: any = null): void {
    this.selectedFeature = feature;
    this.formFeature = feature
      ? { ...feature }
      : { featureName: '' };

    this.mostrarFormularioAgregarFeature = true;
  }

  cerrarFormularioFeature(): void {
    this.mostrarFormularioAgregarFeature = false;
    this.closed.emit();
    this.loadFeatures();
  }

  cancelEditFeature(): void {
    this.selectedFeature = null;
    this.formFeature = { featureName: '' };
    this.mostrarFormularioAgregarFeature = false;

    if (this.soloFormulario) {
      this.closed.emit();
    }

    this.loadFeatures();
  }

  /* ==================== UTILIDADES ==================== */
  editFeature(feature: any): void {
    if (!feature || !feature.idFeature) return;
    this.abrirFormularioAgregarFeature(feature);
  }

  deleteFeature(idFeature: number): void {
    this.apiService.deleteFeature(idFeature).subscribe(() => {
      this.toastService.mostrarMensaje('✅ Característica eliminada correctamente');
      this.loadFeatures();
      this.featureDeleted.emit(idFeature);
    });
  }

  getGridColumns(): number {
    if (this.features.length <= 3) return 1;
    return Math.ceil(Math.sqrt(this.features.length));
  }

  getModalWidth(): string {
    const extra = Math.floor(this.features.length / 4) * 200;
    return (400 + extra) + 'px';
  }
}
