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
import { HoverScrollDirective } from "../../../core/services/hover-scroll.directive";

type BrandLite = { idBrand?: number; name: string; category: number | null };

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

  marcas: BrandLite[] = [];
  formMarca: BrandLite = { name: '', category: null };
  selectedMarca: BrandLite | null = null;

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
      const todas: BrandLite[] = (data || []).map(m => ({
        idBrand: Number(m?.idBrand ?? m?.id ?? 0),
        name: String(m?.name ?? ''),
        category: Number(m?.category ?? m?.idCategory ?? 0)
      }));
      this.marcas = (this.currentCategoryId != null)
        ? todas.filter(m => m.category === this.currentCategoryId)
        : todas;
    });
  }

  /* ==================== CREAR / ACTUALIZAR ==================== */
  createMarca(): void {
    if (!this.formMarca.name.trim() || this.formMarca.category == null) {
      this.toastService.mostrarMensaje('❌ Nombre y categoría son obligatorios.');
      return;
    }
    const payload = { name: this.formMarca.name.trim(), category: this.currentCategoryId };
    this.apiService.createMarca(payload).subscribe(() => {
      this.toastService.mostrarMensaje('✅ Marca creada correctamente');
      this.loadMarcas();
      this.cancelEditMarca();
    });
  }

  updateMarca(): void {
    if (!this.selectedMarca?.idBrand) return;
    if (!this.formMarca.name.trim() || this.formMarca.category == null) {
      this.toastService.mostrarMensaje('❌ Nombre y categoría son obligatorios.');
      return;
    }
    const payload = { name: this.formMarca.name.trim(), category: this.currentCategoryId };
    this.apiService.updateMarca(this.selectedMarca.idBrand, payload).subscribe(() => {
      this.toastService.mostrarMensaje('✅ Marca actualizada correctamente');
      this.loadMarcas();
      this.cancelEditMarca();
    });
  }


  /* ==================== FORMULARIO ==================== */
  abrirFormularioAgregarMarca(marca: BrandLite | null = null): void {
    this.selectedMarca = marca ?? null;
    this.formMarca = marca
      ? { name: marca.name, category: this.currentCategoryId ?? marca.category ?? null }
      : { name: '', category: this.currentCategoryId ?? null };
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
    this.formMarca = { name: '', category: this.currentCategoryId ?? null };
    this.mostrarFormularioAgregarMarca = false;
    if (this.soloFormulario) this.closed.emit();
    this.loadMarcas();
  }

  /* ==================== UTILIDADES ==================== */
  editMarca(marca: any): void {
    if (!marca || !marca.idBrand) return;
    this.abrirFormularioAgregarMarca(marca);
  }

  deleteMarca(idBrand: number | undefined): void {
    if (idBrand == null) {
      this.toastService.mostrarMensaje('❌ Marca inválida (sin id).');
      return;
    }
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