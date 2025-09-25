import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';

import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-mesas',
  standalone: true,
  imports: [
    FormsModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatCardModule
  ],
  templateUrl: './mesas.component.html',
  styleUrls: ['./mesas.component.scss']
})
export class MesasComponent implements OnInit {
  /* ==================== PROPIEDADES ==================== */
  cantidadMesas = 0;
  cantidadActual = 0;
  mesas: any[] = [];
  mesasActivas: number = 0;

  constructor(private api: ApiService, private toastService: ToastService) { }

  ngOnInit() {
    this.refrescarMesas();
  }

  /* ==================== CARGA DE DATOS ==================== */
  refrescarMesas() {
    this.api.getMesas().subscribe({
      next: (data) => {
        this.mesas = data.filter(m => m.number !== 'delivery');
        this.cantidadActual = this.mesas.length;

        if (this.cantidadMesas === 0) {
          this.cantidadMesas = this.cantidadActual;
        }
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al cargar mesas')
    });

    this.api.getMesasActivas().subscribe({
      next: (actives) => {
        const sinDelivery = actives.filter(m => m.number !== 'delivery');
        this.mesasActivas = sinDelivery.length;

        if (this.cantidadMesas < this.mesasActivas) {
          this.cantidadMesas = this.mesasActivas;
        }
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al obtener mesas activas')
    });
  }

  /* ==================== CREAR / ACTUALIZAR ==================== */
  actualizarCantidad() {
    if (this.cantidadMesas < this.cantidadActual) {
      this.toastService.mostrarMensaje(
        `⚠️ No puedes reducir a menos de ${this.cantidadActual} mesas`
      );
      this.cantidadMesas = this.cantidadActual;
      return;
    }

    this.api.actualizarCantidadMesas(this.cantidadMesas).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Cantidad actualizada correctamente');
        this.refrescarMesas();
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al actualizar la cantidad')
    });
  }

  guardarCambios() {
    const cambios = this.mesas.map(mesa => ({
      idTable: mesa.idTable,
      disabled: !!mesa.disabled
    }));

    console.log('Guardando cambios:', cambios);

    this.api.actualizarEstadosMesas(cambios).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Cambios guardados correctamente');
        this.refrescarMesas();
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al guardar los cambios')
    });
  }
}