import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';

import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PageLoadingService } from '../../../../core/services/page-loading.service';

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
  contentReady = false;

  cantidadMesas = 0;
  cantidadActual = 0;
  mesas: Mesa[] = [];
  mesasActivas = 0;

  isSavingEstados = false;
  isUpdatingCantidad = false;

  private snapshotDisabled = new Map<number, boolean>();

  constructor(
    private api: ApiService,
    private toastService: ToastService,
    private pageLoading: PageLoadingService
  ) { }

  async ngOnInit(): Promise<void> {
    await this.initLoad();
  }

  private async initLoad(): Promise<void> {
    this.contentReady = false;
    this.pageLoading.start();
    try {
      await this.refrescarMesas();
    } finally {
      this.contentReady = true;
      this.pageLoading.stop();
    }
  }

  // ======= Carga de datos =======
  private async refrescarMesas(): Promise<void> {
    try {
      const [mesasResp, activasResp] = await Promise.all([
        firstValueFrom(this.api.getMesas()),
        firstValueFrom(this.api.getMesasActivas())
      ]);

      const sinDelivery: Mesa[] = (mesasResp || []).filter((m: Mesa) => m.number !== 'delivery');
      this.mesas = sinDelivery.sort((a, b) => Number(a.number) - Number(b.number));
      this.cantidadActual = this.mesas.length;

      if (this.cantidadMesas === 0) this.cantidadMesas = this.cantidadActual;

      this.snapshotDisabled.clear();
      for (const m of this.mesas) this.snapshotDisabled.set(m.idTable, !!m.disabled);

      const activesSinDelivery: Mesa[] = (activasResp || []).filter((m: Mesa) => m.number !== 'delivery');
      this.mesasActivas = activesSinDelivery.length;

      if (this.cantidadMesas < this.mesasActivas) {
        this.cantidadMesas = this.mesasActivas;
      }
    } catch {
      this.toastService.mostrarMensaje('❌ Error al cargar mesas');
    }
  }

  // ======= Utilidades UI =======
  clampCantidad(): void {
    if (this.cantidadMesas < this.mesasActivas) this.cantidadMesas = this.mesasActivas;
    if (!Number.isFinite(this.cantidadMesas) || this.cantidadMesas < 0) {
      this.cantidadMesas = this.cantidadActual;
    }
  }

  get mesasDirty(): boolean {
    for (const m of this.mesas) {
      if (this.snapshotDisabled.get(m.idTable) !== !!m.disabled) return true;
    }
    return false;
  }

  trackMesa = (_: number, m: Mesa) => m.idTable;

  // ======= Crear / Actualizar =======
  actualizarCantidad(): void {
    this.clampCantidad();
    if (this.cantidadMesas === this.cantidadActual) return;

    this.isUpdatingCantidad = true;
    this.api.actualizarCantidadMesas(this.cantidadMesas).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Cantidad actualizada correctamente');
        this.refrescarMesas().finally(() => (this.isUpdatingCantidad = false));
      },
      error: () => {
        this.toastService.mostrarMensaje('❌ Error al actualizar la cantidad');
        this.isUpdatingCantidad = false;
      }
    });
  }

  guardarCambios(): void {
    if (!this.mesasDirty) return;

    const cambios = this.mesas
      .filter(m => this.snapshotDisabled.get(m.idTable) !== !!m.disabled)
      .map(m => ({ idTable: m.idTable, disabled: !!m.disabled }));

    if (cambios.length === 0) return;

    this.isSavingEstados = true;
    this.api.actualizarEstadosMesas(cambios).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Cambios guardados correctamente');
        this.refrescarMesas().finally(() => (this.isSavingEstados = false));
      },
      error: () => {
        this.toastService.mostrarMensaje('❌ Error al guardar los cambios');
        this.isSavingEstados = false;
      }
    });
  }
}