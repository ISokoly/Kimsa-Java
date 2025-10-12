import { Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';

import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { OverlayHandle, OverlayPortalService } from '../../../../core/services/overlay-portal.service';
import { MatTableModule } from "@angular/material/table";

interface Client {
  idClient?: number;
  name: string;
  dni: string;
  birthdate: string; // YYYY-MM-DD
}

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [
    FormsModule, ReactiveFormsModule, CommonModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatSelectModule, MatOptionModule,
    MatTableModule
  ],
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.scss']
})
export class ClientesComponent implements OnInit {
  clients: Client[] = [];
  selectedClient: Client = { name: '', dni: '', birthdate: '' };
  nuevoClient: Client = { name: '', dni: '', birthdate: '' };

  terminoBusqueda = '';
  filtroPor: 'name' | 'dni' = 'name';

  displayedColumns: string[] = ['name', 'dni', 'birthdate', 'acciones'];

  pageSize = 10;
  pageIndex = 0;

  @ViewChild('formEditarClienteTpl') formEditarClienteTpl!: TemplateRef<any>;
  @ViewChild('formNuevoClienteTpl') formNuevoClienteTpl!: TemplateRef<any>;

  private overlay = inject(OverlayPortalService);
  private editFormRef?: OverlayHandle;
  private newFormRef?: OverlayHandle;

  constructor(private api: ApiService, private toastService: ToastService) { }

  ngOnInit(): void {
    this.getClients();
  }

  getClients(): void {
    this.api.getClientes().subscribe({
      next: (data) => {
        this.clients = data || [];
        this.pageIndex = 0;
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al obtener clientes')
    });
  }

  // ------- Overlays -------
  seleccionarClient(client: Client): void {
    this.selectedClient = { ...client };
    this.editFormRef?.close();
    this.editFormRef = this.overlay.open(this.formEditarClienteTpl);
  }

  cerrarFormularioCliente(): void {
    this.editFormRef?.close();
    this.editFormRef = undefined;
    this.selectedClient = { name: '', dni: '', birthdate: '' };
  }

  abrirFormularioNuevoCliente(): void {
    this.nuevoClient = { name: '', dni: '', birthdate: '' };
    this.newFormRef?.close();
    this.newFormRef = this.overlay.open(this.formNuevoClienteTpl);
  }

  cerrarFormularioNuevoCliente(): void {
    this.newFormRef?.close();
    this.newFormRef = undefined;
    this.nuevoClient = { name: '', dni: '', birthdate: '' };
  }

  // ------- CRUD -------
  actualizarClient(): void {
    const c = this.selectedClient;

    if (!c.name || !c.dni) {
      this.toastService.mostrarMensaje('❌ Nombre y DNI son obligatorios');
      return;
    }
    if (!/^\d{8}$/.test(c.dni)) {
      this.toastService.mostrarMensaje('❌ El DNI debe tener exactamente 8 dígitos');
      return;
    }
    const duplicado = this.clients.find(x => x.dni === c.dni && x.idClient !== c.idClient);
    if (duplicado) {
      this.toastService.mostrarMensaje('❌ Ya existe otro cliente con ese DNI');
      return;
    }
    if (!c.idClient) return;

    if (c.birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(c.birthdate)) {
      this.toastService.mostrarMensaje('❌ Fecha inválida. Use YYYY-MM-DD');
      return;
    }

    this.api.updateCliente(c.idClient, c).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Cliente actualizado correctamente');
        this.getClients();
        this.cerrarFormularioCliente();
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al actualizar cliente')
    });
  }

  crearClient(): void {
    const c = this.nuevoClient;
    if (!c.name || !c.dni) {
      this.toastService.mostrarMensaje('❌ Nombre y DNI son obligatorios');
      return;
    }
    if (!/^\d{8}$/.test(c.dni)) {
      this.toastService.mostrarMensaje('❌ El DNI debe tener exactamente 8 dígitos');
      return;
    }
    if (this.clients.find(x => x.dni === c.dni)) {
      this.toastService.mostrarMensaje('❌ Ya existe un cliente con ese DNI');
      return;
    }
    if (c.birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(c.birthdate)) {
      this.toastService.mostrarMensaje('❌ Fecha inválida. Use YYYY-MM-DD');
      return;
    }

    this.api.createClientes(c).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Cliente creado correctamente');
        this.getClients();
        this.cerrarFormularioNuevoCliente();
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al crear cliente')
    });
  }

  // ------- Filtros -------
  get clientsFiltrados(): Client[] {
    const filtro = this.terminoBusqueda.trim().toLowerCase();

    return (this.clients || [])
      .filter(c => c.idClient !== 1)
      .filter(c => {
        if (!filtro) return true;
        const campo = this.filtroPor === 'dni' ? c.dni : c.name;
        return (campo || '').toLowerCase().includes(filtro);
      });
  }

  onSearchChange(): void {
    this.pageIndex = 0; 
  }

  // ------- Paginación (cliente) -------
  get totalPages(): number {
    const total = this.clientsFiltrados.length;
    return Math.max(1, Math.ceil(total / this.pageSize));
  }

  get pagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  get pagedClients(): Client[] {
    const start = this.pageIndex * this.pageSize;
    return this.clientsFiltrados.slice(start, start + this.pageSize);
  }

  goToPage(i: number): void {
    if (i < 0 || i >= this.totalPages) return;
    this.pageIndex = i;
  }
  nextPage(): void { this.goToPage(this.pageIndex + 1); }
  prevPage(): void { this.goToPage(this.pageIndex - 1); }

  // ------- Util -------
  soloNumeros(event: KeyboardEvent): void {
    const code = event.which ? event.which : event.keyCode;
    if (code < 48 || code > 57) event.preventDefault();
  }
}