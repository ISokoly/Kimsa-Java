import { ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';

import { catchError, firstValueFrom, of } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { OverlayHandle, OverlayPortalService } from '../../../core/services/overlay-portal.service';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageLoadingService } from '../../../core/services/page-loading.service';

@Component({
  selector: 'app-insumos',
  standalone: true,
  imports: [
    FormsModule, RouterModule,
    MatInputModule, MatGridListModule, MatButtonModule, MatSelectModule,
    MatOptionModule, MatTableModule, MatIconModule, DecimalPipe
  ],
  templateUrl: './insumos.component.html',
  styleUrls: ['./insumos.component.scss']
})
export class InsumosComponent implements OnInit {
  insumos: any[] = [];
  selectedSupply: any = null;

  contentReady = false;
  isLoading = false;

  formData: any = { idSupply: null, name: '', unitPrice: 0, unit: '', active: true };

  displayedInfoColumns: string[] = ['prop', 'value'];
  get SupplyInfoRows() {
    const s = this.selectedSupply;
    if (!s) return [];
    return [
      { prop: 'Nombre', value: s.name },
      { prop: 'Precio unit.', value: (s.unitPrice ?? 0).toFixed(2) },
      { prop: 'Stock', value: (s.currentStock ?? 0).toFixed(2) },
      { prop: 'Unidad', value: s.unit },
      { prop: 'Estado', value: s.active ? 'Activo' : 'Inactivo' }
    ];
  }

  private overlay = inject(OverlayPortalService);
  private cd = inject(ChangeDetectorRef);
  private detailRef?: OverlayHandle;
  private formRef?: OverlayHandle;

  @ViewChild('supplyFormTpl') supplyFormTpl!: TemplateRef<any>;
  @ViewChild('supplyDetailTpl') supplyDetailTpl!: TemplateRef<any>;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private toast: ToastService,
    private pageLoading: PageLoadingService
  ) { }

  async ngOnInit(): Promise<void> {
    this.pageLoading.start();
    try {
      await this.loadInsumos();
      this.contentReady = true;
    } finally {
      this.pageLoading.stop();
    }
  }

  /* == Data == */
  private async loadInsumos(): Promise<void> {
    const data = await firstValueFrom(
      this.apiService.getSupplies().pipe(
        catchError(() => of([]))
      )
    );

    this.insumos = (data || []).slice().sort((a: any, b: any) => {
      const ida = Number(a.idSupply ?? 0);
      const idb = Number(b.idSupply ?? 0);
      return ida - idb; // orden ascendente por id
    });

    if (this.detailRef && this.selectedSupply) this.rebindSelectedSupply();
  }


  /* == Helpers Overlay == */
  openSupplyDetail(s: any): void {
    this.selectedSupply = { ...s };
    this.detailRef?.close();
    this.detailRef = this.overlay.open(this.supplyDetailTpl);
    this.cd.detectChanges();
  }
  closeSupplyDetail(): void {
    this.detailRef?.close();
    this.detailRef = undefined;
  }

  abrirFormulario(s: any = null): void {
    this.selectedSupply = s;
    this.formData = {
      idSupply: s?.idSupply ?? null,
      name: s?.name ?? '',
      unitPrice: s?.unitPrice ?? 0,
      unit: s?.unit ?? 'Units',
      active: s?.active ?? true
    };
    this.formRef = this.overlay.open(this.supplyFormTpl);
  }

  cerrarFormulario(): void {
    this.formRef?.close();
    this.formRef = undefined;
    this.resetForm();
  }

  resetForm(): void {
    this.formData = { idSupply: null, name: '', unitPrice: 0, unit: 'Units', active: true };
  }

  async crearSupply(): Promise<void> {
    const name = (this.formData.name || '').trim();
    if (!name) return this.toast.mostrarMensaje('❌ El nombre no puede estar vacío.');
    this.isLoading = true;
    try {
      await firstValueFrom(this.apiService.createSupply({
        name,
        unitPrice: Number(this.formData.unitPrice) || 0,
        unit: this.formData.unit || 'Units'
      }));
      this.toast.mostrarMensaje('✅ Insumo creado correctamente');
      this.cerrarFormulario();
      await this.loadInsumos();
    } catch {
      this.toast.mostrarMensaje('❌ Error al crear el insumo');
    } finally {
      this.isLoading = false;
    }
  }

  async actualizarSupply(): Promise<void> {
    if (!this.selectedSupply) return;
    const name = (this.formData.name || '').trim();
    if (!name) return this.toast.mostrarMensaje('❌ El nombre no puede estar vacío.');
    this.isLoading = true;
    try {
      await firstValueFrom(this.apiService.updateSupply(this.selectedSupply.idSupply, {
        name,
        unitPrice: Number(this.formData.unitPrice) || 0,
        unit: this.formData.unit || 'Units',
        active: !!this.formData.active
      }));
      this.toast.mostrarMensaje('✅ Insumo actualizado correctamente');
      this.cerrarFormulario();
      await this.loadInsumos();
    } catch {
      this.toast.mostrarMensaje('❌ Error al actualizar el insumo');
    } finally {
      this.isLoading = false;
    }
  }

  private rebindSelectedSupply(): void {
    const id = this.selectedSupply?.idSupply;
    if (!id) return;
    const fresh = this.insumos.find(s => s.idSupply === id);
    if (fresh) this.selectedSupply = { ...fresh };
    this.cd.detectChanges();
  }

  volverInventario(): void {
    this.router.navigate([`/view/inventario`]);
  }
}