import { Component, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';

interface Client {
  idClient?: number;
  name: string;
  dni: string;
  birthdate: string;
}

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatSelectModule,
    MatOptionModule,
    CommonModule
  ],
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.scss']
})
export class ClientesComponent implements OnInit {

  /* ==================== PROPIEDADES ==================== */
  clients: Client[] = [];
  selectedClient: Client = { name: '', dni: '', birthdate: '' };
  nuevoClient: Client = { name: '', dni: '', birthdate: '' };

  mostrarFormularioCliente = false;
  mostrarFormularioNuevoCliente = false;

  terminoBusqueda: string = '';
  filtroPor: 'name' | 'dni' = 'name';

  constructor(private api: ApiService, private toastService: ToastService) { }

  ngOnInit(): void {
    this.getClients();
  }

  /* ==================== CARGA DE DATOS ==================== */
  getClients(): void {
    this.api.getClientes().subscribe({
      next: (data) => (this.clients = data),
      error: () => this.toastService.mostrarMensaje('❌ Error al obtener clientes')
    });
  }

  /* ==================== FORMULARIOS ==================== */
  seleccionarClient(client: Client): void {
    this.selectedClient = {
      ...client,
      birthdate: this.convertirFecha(client.birthdate)
    };
    this.mostrarFormularioCliente = true;
  }

  cerrarFormularioCliente(): void {
    this.mostrarFormularioCliente = false;
    this.selectedClient = { name: '', dni: '', birthdate: '' };
  }

  abrirFormularioNuevoCliente(): void {
    this.mostrarFormularioNuevoCliente = true;
    this.nuevoClient = { name: '', dni: '', birthdate: '' };
  }

  cerrarFormularioNuevoCliente(): void {
    this.mostrarFormularioNuevoCliente = false;
    this.nuevoClient = { name: '', dni: '', birthdate: '' };
  }

  /* ==================== CREAR / ACTUALIZAR ==================== */
  actualizarClient(): void {
    const c = this.selectedClient;

    if (!c.name || !c.dni) {
      this.toastService.mostrarMensaje('❌ Nombre y DNI son obligatorios');
      return;
    }

    const dniValido = /^\d{8}$/.test(c.dni);
    if (!dniValido) {
      this.toastService.mostrarMensaje('❌ El DNI debe tener exactamente 8 dígitos');
      return;
    }

    const dniExistente = this.clients.find(
      x => x.dni === c.dni && x.idClient !== c.idClient
    );
    if (dniExistente) {
      this.toastService.mostrarMensaje('❌ Ya existe otro cliente con ese DNI');
      return;
    }

    if (!c.idClient) return;

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

    const dniValido = /^\d{8}$/.test(c.dni);
    if (!dniValido) {
      this.toastService.mostrarMensaje('❌ El DNI debe tener exactamente 8 dígitos');
      return;
    }

    if (this.clients.find(x => x.dni === c.dni)) {
      this.toastService.mostrarMensaje('❌ Ya existe un cliente con ese DNI');
      return;
    }

    this.api.createClientes(c).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Cliente creado correctamente');
        this.getClients();
        this.nuevoClient = { name: '', dni: '', birthdate: '' };
        this.mostrarFormularioNuevoCliente = false;
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al crear cliente')
    });
  }

  /* ==================== ELIMINAR ==================== */
  eliminarClient(client: Client): void {
    if (!client.idClient) return;
    if (!confirm(`¿Seguro que deseas eliminar al cliente "${client.name}"?`)) return;

    this.api.deleteCliente(client.idClient).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Cliente eliminado correctamente');
        this.getClients();
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al eliminar cliente')
    });
  }

  /* ==================== GETTERS ==================== */
  get clientsFiltrados() {
    const filtro = this.terminoBusqueda.trim().toLowerCase();

    return this.clients
      .filter(c => c.idClient !== 1)
      .filter(c => {
        if (!filtro) return true;

        const campo = this.filtroPor === 'dni' ? c.dni : c.name;
        return campo.toLowerCase().includes(filtro);
      });
  }

  /* ==================== UTILIDADES ==================== */
  convertirFecha(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toISOString().split('T')[0];
  }

  soloNumeros(event: KeyboardEvent): void {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }
}