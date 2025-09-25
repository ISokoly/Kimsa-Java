import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from "@angular/material/list";
import { CommonModule } from '@angular/common';
import { HoverScrollDirective } from "../../categorias/hover-scroll.directive";

@Component({
  selector: 'app-marcas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    HoverScrollDirective
  ],
  templateUrl: './marcas.component.html',
  styleUrls: ['./marcas.component.scss']
})
export class MarcasComponent implements OnInit {
  /* ==================== PROPIEDADES ==================== */

  @Output() closed = new EventEmitter<void>();
  @Input() currentCategoryId: number | null = null;
  @Input() soloFormulario: boolean = false;
  @Output() marcaDeleted = new EventEmitter<number>();

  marcas: any[] = [];
  formMarca = { name: '', category: 0 as number | null };
  selectedMarca: any = null;

  mostrarFormularioAgregarMarca = false;

  constructor(
    private apiService: ApiService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    this.loadMarcas();
    if (this.currentCategoryId) {
      this.formMarca.category = this.currentCategoryId;
    }
  }

  /* ==================== CARGA DE DATOS ==================== */
  loadMarcas(): void {
    this.apiService.getMarcas().subscribe((data: any[]) => {
      if (this.currentCategoryId !== null && this.currentCategoryId !== undefined) {
        this.marcas = data.filter(m => m.category === this.currentCategoryId);
      } else {
        this.marcas = data;
      }
    });
  }

  /* ==================== CREAR / ACTUALIZAR ==================== */
  createMarca(): void {
    if (!this.formMarca.name.trim()) {
      this.toastService.mostrarMensaje('❌ El nombre de la marca es obligatorio.');
      return;
    }

    this.formMarca.category = this.currentCategoryId;

    this.apiService.createMarca(this.formMarca).subscribe(() => {
      this.toastService.mostrarMensaje('✅ Marca creada correctamente');
      this.loadMarcas();
      this.cancelEditMarca();
    });
  }

  updateMarca(): void {
    if (!this.formMarca.name.trim()) {
      this.toastService.mostrarMensaje('❌ El nombre de la marca es obligatorio.');
      return;
    }

    if (!this.selectedMarca) return;

    this.formMarca.category = this.currentCategoryId;

    this.apiService.updateMarca(this.selectedMarca.idBrand, this.formMarca).subscribe(() => {
      this.toastService.mostrarMensaje('✅ Marca actualizada correctamente');
      this.loadMarcas();
      this.cancelEditMarca();
    });
  }

  /* ==================== FORMULARIO ==================== */
  abrirFormularioAgregarMarca(marca: any = null): void {
    this.selectedMarca = marca;
    this.formMarca = marca
      ? { ...marca }
      : { name: '', category: this.currentCategoryId };
    this.mostrarFormularioAgregarMarca = true;
  }

  /* ==================== FORMULARIO ==================== */
  cerrarFormularioMarca(): void {
    this.mostrarFormularioAgregarMarca = false;
    this.closed.emit();
    this.loadMarcas();
  }

  cancelEditMarca(): void {
    this.selectedMarca = null;
    this.formMarca = { name: '', category: this.currentCategoryId };
    this.mostrarFormularioAgregarMarca = false;

    if (this.soloFormulario) {
      this.closed.emit();
    }

    this.loadMarcas();
  }

  /* ==================== UTILIDADES ==================== */
  editMarca(marca: any): void {
    if (!marca || !marca.idBrand) return;
    this.abrirFormularioAgregarMarca(marca);
  }

  deleteMarca(idBrand: number): void {
    this.apiService.deleteMarca(idBrand).subscribe(() => {
      this.toastService.mostrarMensaje('✅ Marca eliminada correctamente');
      this.loadMarcas();
      this.marcaDeleted.emit(idBrand);
    });
  }

  getGridColumns(): number {
    if (this.marcas.length <= 3) return 1;
    return Math.ceil(Math.sqrt(this.marcas.length));
  }

  getModalWidth(): string {
    const extra = Math.floor(this.marcas.length / 4) * 200;
    return (400 + extra) + 'px';
  }
}