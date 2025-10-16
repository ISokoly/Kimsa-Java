import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';

type Feature = { idFeature: number; featureName: string };

@Component({
  selector: 'app-caracteristicas',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  templateUrl: './caracteristicas.component.html',
  styleUrls: ['./caracteristicas.component.scss']
})
export class CaracteristicasComponent implements OnInit {

  @Input() soloFormulario = false;
  @Input() featureIdToEdit: number | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() featureDeleted = new EventEmitter<number>();

  features: Feature[] = [];
  searchTerm = '';

  editingId: number | null = null;
  nameInput = '';

  showEditor = false;

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit(): void {
    this.load();
  }

  /* ================= CARGA ================= */
  load(): void {
    this.api.getFeatures().subscribe({
      next: (data: any[]) => {
        this.features = (data || []).map(f => ({
          idFeature: f.idFeature,
          featureName: String(f.featureName || '')
        }));
        if (this.featureIdToEdit != null) {
          const f = this.features.find(x => x.idFeature === this.featureIdToEdit);
          if (f) this.startEdit(f);
        }
      },
      error: () => {
        this.features = [];
        this.toast.mostrarMensaje('❌ Error al cargar características');
      }
    });
  }

  /* =============== LISTA FILTRADA =============== */
  get filtered(): Feature[] {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return this.features;
    return this.features.filter(f => f.featureName?.toLowerCase().includes(q));
  }

  /* ================== EDITOR ================== */
  startCreate(): void {
    this.editingId = null;
    this.nameInput = '';
    this.showEditor = true;
  }

  startEdit(f: Feature): void {
    this.editingId = f.idFeature;
    this.nameInput = f.featureName;
    this.showEditor = true;
  }

  cancel(): void {
    this.editingId = null;
    this.nameInput = '';
    if (this.soloFormulario) {
      this.closed.emit();
    } else {
      this.showEditor = false;
    }
  }

  save(): void {
    const name = (this.nameInput || '').trim();
    if (!name) { this.toast.mostrarMensaje('⚠️ Escribe un nombre.'); return; }

    const exists = this.features.some(
      f => f.featureName.toLowerCase() === name.toLowerCase() && f.idFeature !== this.editingId
    );
    if (exists) { this.toast.mostrarMensaje('⚠️ Ya existe una característica con ese nombre.'); return; }

    if (this.editingId !== null) {
      this.api.updateFeature(this.editingId, { featureName: name }).subscribe({
        next: () => {
          this.toast.mostrarMensaje('✅ Característica actualizada');
          this.load();
          this.soloFormulario ? this.closed.emit() : this.showEditor = false;
        },
        error: () => this.toast.mostrarMensaje('❌ No se pudo actualizar')
      });
    } else {
      this.api.createFeature({ featureName: name }).subscribe({
        next: () => {
          this.toast.mostrarMensaje('✅ Característica creada');
          this.load();
          this.soloFormulario ? this.closed.emit() : this.showEditor = false;
        },
        error: () => this.toast.mostrarMensaje('❌ No se pudo crear')
      });
    }
  }

  remove(id: number): void {
    this.api.deleteFeature(id).subscribe({
      next: () => {
        this.toast.mostrarMensaje('✅ Característica eliminada');
        this.features = this.features.filter(f => f.idFeature !== id);
        this.featureDeleted.emit(id);
      },
      error: () => this.toast.mostrarMensaje('❌ No se pudo eliminar')
    });
  }

  close(): void {
    this.closed.emit();
  }
}
