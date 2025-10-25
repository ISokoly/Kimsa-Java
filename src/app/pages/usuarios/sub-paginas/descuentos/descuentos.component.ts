import { Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';

import { forkJoin } from 'rxjs';

import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { OverlayHandle, OverlayPortalService } from '../../../../core/services/overlay-portal.service';
import { PageLoadingService } from '../../../../core/services/page-loading.service';

/* ==================== INTERFACES ==================== */
export interface Discount {
  idDiscount: number | null;
  idProduct: number | null;
  percentage: number | null;
  disabled: boolean;
  typeDay: string;
  nombreProducto?: string;
}

@Component({
  selector: 'app-descuentos',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatSelectModule,
    MatOptionModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule
  ],
  templateUrl: './descuentos.component.html',
  styleUrls: ['./descuentos.component.scss'],
})
export class DescuentosComponent implements OnInit {

  contentReady = false;

  descuentos: Discount[] = [];
  productos: any[] = [];
  productosFiltrados: any[] = [];
  productoSeleccionado: any = null;

  descuento: Discount = {
    idDiscount: null, idProduct: null, percentage: null, disabled: false, typeDay: '', nombreProducto: ''
  };

  diasSemana = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
  editando = false;

  displayedColumns: string[] = ['numero', 'producto', 'porcentaje', 'dia', 'estado', 'opciones'];

  @ViewChild('formDescuentoTpl') formDescuentoTpl!: TemplateRef<any>;
  private overlay = inject(OverlayPortalService);
  private formRef?: OverlayHandle;

  constructor(
    private api: ApiService,
    private toastService: ToastService,
    private pageLoading: PageLoadingService
  ) { }

  /* ==================== CICLO DE VIDA ==================== */
  ngOnInit() {
    this.initLoad();
  }

  private initLoad(): void {
    this.contentReady = false;
    this.pageLoading.start();

    forkJoin({
      productos: this.api.getProductos(),
      descuentos: this.api.getDescuentos()
    }).subscribe({
      next: ({ productos, descuentos }) => {
        const arrProd = Array.isArray(productos) ? productos : (productos ? [productos] : []);
        this.productos = arrProd;
        this.productosFiltrados = arrProd.filter(p => !p?.disabled);

        // Enriquecer descuentos con el nombre del producto
        const mapIdToName: Record<number, string> = Object.fromEntries(
          (arrProd || []).map(p => [Number(p.idProduct), String(p.name ?? '')])
        );

        this.descuentos = (descuentos || []).map((d: any) => ({
          idDiscount: Number(d.idDiscount ?? d.id ?? null),
          idProduct: Number(d.idProduct ?? null),
          percentage: d.percentage != null ? Number(d.percentage) : null,
          disabled: !!d.disabled,
          typeDay: String(d.typeDay ?? ''),
          nombreProducto: mapIdToName[Number(d.idProduct ?? -1)] ?? ''
        }));

        this.contentReady = true;
        this.pageLoading.stop();
      },
      error: () => {
        this.productos = [];
        this.productosFiltrados = [];
        this.descuentos = [];
        this.contentReady = true;
        this.pageLoading.stop();
        this.toastService.mostrarMensaje('❌ Error al cargar descuentos');
      }
    });
  }

  /* ==================== REFRESCOS PARCIALES ==================== */
  private refrescarDescuentos(): void {
    this.api.getDescuentos().subscribe({
      next: (res) => {
        const mapIdToName: Record<number, string> = Object.fromEntries(
          (this.productos || []).map(p => [Number(p.idProduct), String(p.name ?? '')])
        );
        this.descuentos = (res || []).map((d: any) => ({
          idDiscount: Number(d.idDiscount ?? d.id ?? null),
          idProduct: Number(d.idProduct ?? null),
          percentage: d.percentage != null ? Number(d.percentage) : null,
          disabled: !!d.disabled,
          typeDay: String(d.typeDay ?? ''),
          nombreProducto: mapIdToName[Number(d.idProduct ?? -1)] ?? ''
        }));
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al refrescar descuentos')
    });
  }

  /* ==================== FORMULARIO (Overlay) ==================== */
  mostrarFormularioNuevo() {
    this.editando = false;
    this.resetDescuento();
    this.abrirOverlayForm();
  }

  editarDescuento(descuento: Discount) {
    this.editando = true;
    this.descuento = { ...descuento };
    const producto = this.productos.find(p => p.idProduct === descuento.idProduct);
    this.productoSeleccionado = producto || null;
    this.productosFiltrados = this.productos.filter(p => !p.disabled);
    this.abrirOverlayForm();
  }

  private abrirOverlayForm() {
    this.formRef?.close();
    this.formRef = this.overlay.open(this.formDescuentoTpl);
  }

  cancelarEdicion() {
    this.formRef?.close();
    this.formRef = undefined;
    this.resetDescuento();
  }

  resetDescuento() {
    this.descuento = { idDiscount: null, idProduct: null, percentage: null, disabled: false, typeDay: '', nombreProducto: '' };
    this.productoSeleccionado = null;
  }

  /* ==================== AUTOCOMPLETE ==================== */
  filtrarProductos() {
    const termino = (this.productoSeleccionado && typeof this.productoSeleccionado === 'string')
      ? this.productoSeleccionado.toLowerCase()
      : (this.productoSeleccionado?.name || '').toLowerCase();

    this.productosFiltrados = (this.productos || [])
      .filter(p => !p.disabled)
      .filter(p => (p.name ?? '').toLowerCase().includes(termino));
  }

  seleccionarProducto(producto: any) {
    this.descuento.idProduct = producto?.idProduct ?? null;
    this.productoSeleccionado = producto ?? null;
  }

  mostrarNombreProducto = (producto: any) => (producto && producto.name) ? producto.name : '';

  /* ==================== CREAR / ACTUALIZAR ==================== */
  guardarDescuento() {
    if (!this.descuento.idProduct || this.descuento.percentage == null || !this.descuento.typeDay) {
      this.toastService.mostrarMensaje('⚠️ Complete todos los campos.');
      return;
    }
    const pct = Number(this.descuento.percentage);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      this.toastService.mostrarMensaje('⚠️ El porcentaje debe estar entre 0 y 100.');
      return;
    }

    const data = {
      idProduct: this.descuento.idProduct,
      percentage: pct,
      disabled: this.descuento.disabled,
      typeDay: this.descuento.typeDay
    };

    const after = () => {
      this.refrescarDescuentos();
      this.cancelarEdicion();
      this.toastService.mostrarMensaje(this.editando ? '✅ Descuento actualizado' : '✅ Descuento creado');
    };

    if (this.editando && this.descuento.idDiscount !== null) {
      this.api.updateDescuento(this.descuento.idDiscount, data).subscribe({
        next: after,
        error: () => this.toastService.mostrarMensaje('❌ Error al actualizar descuento')
      });
    } else {
      this.api.createDescuento(data).subscribe({
        next: after,
        error: () => this.toastService.mostrarMensaje('❌ Error al crear descuento')
      });
    }
  }

  /* ==================== UTILIDADES ==================== */
  deshabilitarDescuento(idDiscount: number) {
    const desc = this.descuentos.find(d => d.idDiscount === idDiscount);
    if (!desc) return;
    const data = {
      idProduct: desc.idProduct,
      percentage: desc.percentage,
      disabled: true,
      typeDay: desc.typeDay
    };
    this.api.updateDescuento(idDiscount, data).subscribe({
      next: () => this.refrescarDescuentos(),
      error: () => this.toastService.mostrarMensaje('❌ Error al deshabilitar descuento')
    });
  }

  habilitarDescuento(idDiscount: number) {
    const desc = this.descuentos.find(d => d.idDiscount === idDiscount);
    if (!desc) return;
    const data = {
      idProduct: desc.idProduct,
      percentage: desc.percentage,
      disabled: false,
      typeDay: desc.typeDay
    };
    this.api.updateDescuento(idDiscount, data).subscribe({
      next: () => this.refrescarDescuentos(),
      error: () => this.toastService.mostrarMensaje('❌ Error al habilitar descuento')
    });
  }

  obtenerNombreProducto(idProduct: number): string {
    const producto = this.productos.find(p => p.idProduct === idProduct);
    return producto ? producto.name : '';
  }
}
