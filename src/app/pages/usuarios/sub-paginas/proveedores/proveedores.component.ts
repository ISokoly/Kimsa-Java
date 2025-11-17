import { Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { OverlayHandle, OverlayPortalService } from '../../../../core/services/overlay-portal.service';
import { PageLoadingService } from '../../../../core/services/page-loading.service';
import { MatIconModule } from "@angular/material/icon";
import { Router } from '@angular/router';

interface Supplier {
  idSupplier?: number;
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  active: boolean;
}

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatOptionModule,
    MatTableModule,
    MatCheckboxModule,
    MatAutocompleteModule,
    MatIconModule
],
  templateUrl: './proveedores.component.html',
  styleUrls: ['./proveedores.component.scss'],
})
export class ProveedoresComponent implements OnInit {
  contentReady = false;

  suppliers: Supplier[] = [];
  selectedSupplier: Supplier = { name: '', phone: '', address: '', email: '', active: true };
  nuevoSupplier: Supplier = { name: '', phone: '', address: '', email: '', active: true };

  terminoBusqueda = '';
  filtroPor: 'name' | 'phone' | 'email' = 'name';

  displayedColumns: string[] = ['name', 'phone', 'email', 'active', 'acciones'];

  pageSize = 10;
  pageIndex = 0;

  // 👉 Sugerencias para el input-select
  sugerencias: string[] = [];

  @ViewChild('formEditarProveedorTpl') formEditarProveedorTpl!: TemplateRef<any>;
  @ViewChild('formNuevoProveedorTpl') formNuevoProveedorTpl!: TemplateRef<any>;

  private overlay = inject(OverlayPortalService);
  private editFormRef?: OverlayHandle;
  private newFormRef?: OverlayHandle;

  constructor(
    private api: ApiService,
    private toastService: ToastService,
    private pageLoading: PageLoadingService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.contentReady = false;
    this.pageLoading.start();
    this.getSuppliers();
  }

  getSuppliers(): void {
    this.api.getSuppliers().subscribe({
      next: (data) => {
        this.suppliers = (data || []) as Supplier[];
        this.pageIndex = 0;
        this.contentReady = true;
        this.pageLoading.stop();
        this.rebuildSuggestions(); // por si hay texto en el filtro
      },
      error: () => {
        this.toastService.mostrarMensaje('❌ Error al obtener proveedores');
        this.suppliers = [];
        this.pageIndex = 0;
        this.contentReady = true;
        this.pageLoading.stop();
        this.rebuildSuggestions();
      },
    });
  }

  // ------- Overlays -------
  seleccionarSupplier(s: Supplier): void {
    this.selectedSupplier = {
      idSupplier: s.idSupplier,
      name: s.name,
      phone: s.phone || '',
      address: s.address || '',
      email: s.email || '',
      active: s.active,
    };
    this.editFormRef?.close();
    this.editFormRef = this.overlay.open(this.formEditarProveedorTpl);
  }

  cerrarFormularioProveedor(): void {
    this.editFormRef?.close();
    this.editFormRef = undefined;
    this.selectedSupplier = { name: '', phone: '', address: '', email: '', active: true };
  }

  abrirFormularioNuevoProveedor(): void {
    this.nuevoSupplier = { name: '', phone: '', address: '', email: '', active: true };
    this.newFormRef?.close();
    this.newFormRef = this.overlay.open(this.formNuevoProveedorTpl);
  }

  cerrarFormularioNuevoProveedor(): void {
    this.newFormRef?.close();
    this.newFormRef = undefined;
    this.nuevoSupplier = { name: '', phone: '', address: '', email: '', active: true };
  }

  // ------- Validaciones simples -------
  private validarSupplierBase(s: Supplier, esNuevo: boolean): boolean {
    if (!s.name || !s.name.trim()) {
      this.toastService.mostrarMensaje('❌ El nombre del proveedor es obligatorio');
      return false;
    }

    if (s.email && s.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(s.email.trim())) {
        this.toastService.mostrarMensaje('❌ Correo electrónico inválido');
        return false;
      }
    }

    if (s.phone && s.phone.trim()) {
      if (!/^[0-9+\-\s]{6,20}$/.test(s.phone.trim())) {
        this.toastService.mostrarMensaje('❌ Teléfono inválido (6-20 caracteres, solo números, +, - y espacios)');
        return false;
      }
    }

    const nameTrim = s.name.trim().toLowerCase();
    const duplicado = this.suppliers.find(
      (x) => x.name.trim().toLowerCase() === nameTrim && (!esNuevo ? x.idSupplier !== s.idSupplier : true)
    );
    if (duplicado) {
      this.toastService.mostrarMensaje('❌ Ya existe un proveedor con ese nombre');
      return false;
    }

    return true;
  }

  // ------- CRUD -------
  actualizarSupplier(): void {
    const s = this.selectedSupplier;

    if (!s.idSupplier) return;
    if (!this.validarSupplierBase(s, false)) return;

    this.api.updateSupplier(s.idSupplier, {
      name: s.name.trim(),
      phone: s.phone?.trim() || undefined,
      address: s.address?.trim() || undefined,
      email: s.email?.trim() || undefined,
      active: !!s.active,
    }).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Proveedor actualizado correctamente');
        this.getSuppliers();
        this.cerrarFormularioProveedor();
      },
      error: () =>
        this.toastService.mostrarMensaje('❌ Error al actualizar proveedor'),
    });
  }

  crearSupplier(): void {
    const s = this.nuevoSupplier;

    if (!this.validarSupplierBase(s, true)) return;

    this.api.createSupplier({
      name: s.name.trim(),
      phone: s.phone?.trim() || undefined,
      address: s.address?.trim() || undefined,
      email: s.email?.trim() || undefined,
      active: !!s.active,
    }).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Proveedor creado correctamente');
        this.getSuppliers();
        this.cerrarFormularioNuevoProveedor();
      },
      error: () =>
        this.toastService.mostrarMensaje('❌ Error al crear proveedor'),
    });
  }

  // ------- Filtros -------
  get suppliersFiltrados(): Supplier[] {
    const filtro = this.terminoBusqueda.trim().toLowerCase();

    return (this.suppliers || []).filter((s) => {
      if (!filtro) return true;

      let campo = '';
      if (this.filtroPor === 'phone') campo = s.phone || '';
      else if (this.filtroPor === 'email') campo = s.email || '';
      else campo = s.name || '';

      return campo.toLowerCase().includes(filtro);
    });
  }

  // 👉 Se llama cuando el usuario escribe en el input
  onSearchChange(val?: string): void {
    if (typeof val === 'string') {
      this.terminoBusqueda = val;
    }
    this.pageIndex = 0;
    this.rebuildSuggestions();
  }

  // 👉 Construye las sugerencias del input-select según filtroPor + texto
  private rebuildSuggestions(): void {
    const q = this.terminoBusqueda.trim().toLowerCase();
    if (!q) {
      this.sugerencias = [];
      return;
    }

    const baseValues = (this.suppliers || []).map((s) => {
      if (this.filtroPor === 'phone') return s.phone || '';
      if (this.filtroPor === 'email') return s.email || '';
      return s.name || '';
    });

    const uniques: string[] = [];
    const seen = new Set<string>();

    for (const v of baseValues) {
      const val = (v || '').trim();
      if (!val) continue;
      if (!val.toLowerCase().includes(q)) continue;
      if (seen.has(val)) continue;
      seen.add(val);
      uniques.push(val);
      if (uniques.length >= 20) break;
    }

    this.sugerencias = uniques;
  }

  // 👉 Cuando se selecciona una sugerencia del autocomplete
  onSuggestionSelected(value: string): void {
    this.terminoBusqueda = value || '';
    this.pageIndex = 0;
    this.rebuildSuggestions();
  }

  // ------- Paginación -------
  get totalPages(): number {
    const total = this.suppliersFiltrados.length;
    return Math.max(1, Math.ceil(total / this.pageSize));
  }

  get pagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  get pagedSuppliers(): Supplier[] {
    const start = this.pageIndex * this.pageSize;
    return this.suppliersFiltrados.slice(start, start + this.pageSize);
  }

  goToPage(i: number): void {
    if (i < 0 || i >= this.totalPages) return;
    this.pageIndex = i;
  }
  nextPage(): void {
    this.goToPage(this.pageIndex + 1);
  }
  prevPage(): void {
    this.goToPage(this.pageIndex - 1);
  }

  volverUsuario(): void {
    this.router.navigate([`/view/usuarios`]);
  }

  // ------- Util -------
  soloNumeros(event: KeyboardEvent): void {
    const code = event.which ? event.which : event.keyCode;
    if (code < 48 || code > 57) event.preventDefault();
  }
}
