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
  /* ==================== PROPIEDADES ==================== */
  descuentos: Discount[] = [];
  productos: any[] = [];
  productosFiltrados: any[] = [];
  productoSeleccionado: any = null;

  descuento: Discount = { idDiscount: null, idProduct: null, percentage: null, disabled: false, typeDay: '', nombreProducto: '' };

  diasSemana = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
  editando = false;

  displayedColumns: string[] = ['numero', 'producto', 'porcentaje', 'dia', 'estado', 'opciones'];

  @ViewChild('formDescuentoTpl') formDescuentoTpl!: TemplateRef<any>;
  private overlay = inject(OverlayPortalService);
  private formRef?: OverlayHandle;

  constructor(private api: ApiService, private toastService: ToastService, private pageLoading: PageLoadingService) { }

  ngOnInit() {
    this.pageLoading.start();
    this.cargarProductos(() => this.obtenerDescuentos());
  }

  /* ==================== CARGA DE DATOS ==================== */
  obtenerDescuentos() {
    this.api.getDescuentos().subscribe(res => {
      this.descuentos = res;
      this.pageLoading.stop();
    });
  }

  cargarProductos(done?: () => void) {
    this.api.getProductos().subscribe(res => {
      this.productos = res || [];
      this.productosFiltrados = this.productos.filter(p => !p.disabled);
      done?.();
      this.pageLoading.stop();
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
      .filter(p => p.name?.toLowerCase().includes(termino));
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
    const data = {
      idProduct: this.descuento.idProduct,
      percentage: this.descuento.percentage,
      disabled: this.descuento.disabled,
      typeDay: this.descuento.typeDay
    };
    const after = () => {
      this.obtenerDescuentos();
      this.cancelarEdicion();
    };
    if (this.editando && this.descuento.idDiscount !== null) {
      this.api.updateDescuento(this.descuento.idDiscount, data).subscribe(after);
    } else {
      this.api.createDescuento(data).subscribe(after);
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
    this.api.updateDescuento(idDiscount, data).subscribe(() => this.obtenerDescuentos());
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
    this.api.updateDescuento(idDiscount, data).subscribe(() => this.obtenerDescuentos());
  }

  obtenerNombreProducto(idProduct: number): string {
    const producto = this.productos.find(p => p.idProduct === idProduct);
    return producto ? producto.name : '';
  }
}