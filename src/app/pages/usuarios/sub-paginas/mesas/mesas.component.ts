import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';

import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';

type Mesa = {
  idTable: number;
  number: number | string;
  disabled: boolean;
  active?: boolean;
};

@Component({
  selector: 'app-mesas',
  standalone: true,
  imports: [FormsModule, MatInputModule, MatButtonModule, MatCheckboxModule, MatCardModule],
  templateUrl: './mesas.component.html',
  styleUrls: ['./mesas.component.scss']
})
export class MesasComponent implements OnInit {
  // ======= Estado =======
  cantidadMesas = 0;          // valor editable
  cantidadActual = 0;         // valor real en backend
  mesas: Mesa[] = [];
  mesasActivas = 0;

  // Flags UI
  isSavingEstados = false;
  isUpdatingCantidad = false;

  // Snapshot para detectar cambios en "disabled"
  private snapshotDisabled = new Map<number, boolean>();

  constructor(private api: ApiService, private toastService: ToastService) {}

  ngOnInit() {
    this.refrescarMesas();
  }

  // ======= Carga de datos =======
  refrescarMesas() {
    // Mesas totales (sin 'delivery')
    this.api.getMesas().subscribe({
      next: (data: Mesa[]) => {
        const sinDelivery = (data || []).filter(m => m.number !== 'delivery');
        // Ordenar por número si es numérico
        this.mesas = sinDelivery.sort((a, b) => Number(a.number) - Number(b.number));
        this.cantidadActual = this.mesas.length;

        // Inicializa cantidad editable si aún es 0
        if (this.cantidadMesas === 0) this.cantidadMesas = this.cantidadActual;

        // Toma snapshot de estados "disabled"
        this.snapshotDisabled.clear();
        for (const m of this.mesas) this.snapshotDisabled.set(m.idTable, !!m.disabled);
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al cargar mesas')
    });

    // Mesas activas (ocupadas)
    this.api.getMesasActivas().subscribe({
      next: actives => {
        const sinDelivery = (actives || []).filter((m: Mesa) => m.number !== 'delivery');
        this.mesasActivas = sinDelivery.length;

        // Asegura que la cantidad editable nunca sea < activas
        if (this.cantidadMesas < this.mesasActivas) {
          this.cantidadMesas = this.mesasActivas;
        }
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al obtener mesas activas')
    });
  }

  // ======= Utilidades UI =======
  clampCantidad() {
    // No permitir bajar por debajo de activas
    if (this.cantidadMesas < this.mesasActivas) this.cantidadMesas = this.mesasActivas;
    // No permitir valores negativos/NaN
    if (!Number.isFinite(this.cantidadMesas) || this.cantidadMesas < 0) this.cantidadMesas = this.cantidadActual;
  }

  get mesasDirty(): boolean {
    // ¿Hay alguna mesa cuyo "disabled" difiera del snapshot?
    for (const m of this.mesas) {
      if (this.snapshotDisabled.get(m.idTable) !== !!m.disabled) return true;
    }
    return false;
  }

  onMesaToggle(_mesa: Mesa) {
    // No hacemos nada pesado aquí; el getter mesasDirty reevaluará
  }

  trackMesa = (_: number, m: Mesa) => m.idTable;

  // ======= Crear / Actualizar =======
  actualizarCantidad() {
    this.clampCantidad();

    if (this.cantidadMesas === this.cantidadActual) return;

    this.isUpdatingCantidad = true;
    this.api.actualizarCantidadMesas(this.cantidadMesas).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Cantidad actualizada correctamente');
        this.refrescarMesas();
        this.isUpdatingCantidad = false;
      },
      error: () => {
        this.toastService.mostrarMensaje('❌ Error al actualizar la cantidad');
        this.isUpdatingCantidad = false;
      }
    });
  }

  guardarCambios() {
    if (!this.mesasDirty) return;

    const cambios = this.mesas
      .filter(m => this.snapshotDisabled.get(m.idTable) !== !!m.disabled)
      .map(m => ({ idTable: m.idTable, disabled: !!m.disabled }));

    if (cambios.length === 0) return;

    this.isSavingEstados = true;
    this.api.actualizarEstadosMesas(cambios).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Cambios guardados correctamente');
        // Refresca y re-toma snapshot
        this.refrescarMesas();
        this.isSavingEstados = false;
      },
      error: () => {
        this.toastService.mostrarMensaje('❌ Error al guardar los cambios');
        this.isSavingEstados = false;
      }
    });
  }
}