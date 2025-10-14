import { Component, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSelectModule } from "@angular/material/select";
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { MarcasComponent } from "./marcas/marcas.component";
import { CaracteristicasProductoComponent } from "./caracteristicas-producto/caracteristicas-producto.component";
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../view/confirm-dialog/confirm-dialog.component';
import { OverlayHandle, OverlayPortalService } from '../../core/services/overlay-portal.service';

interface Brand { idBrand: number; name: string; category?: number; }
interface Product {
  idProduct: number; name: string; price: number; idCategory: number;
  idBrand?: number | null; brand?: { idBrand: number; name: string } | null;
  idImage?: number | null; disabled: boolean;
}
interface Category { idCategory: number; name: string; }
interface ImageResp { idImage?: number; id?: number; url: string; }

@Component({
  selector: 'app-producto',
  standalone: true,
  imports: [
    FormsModule, RouterModule,
    MatInputModule, MatGridListModule, MatButtonModule, MatSelectModule,
    MatAutocompleteModule, MatChipsModule,
    MarcasComponent, CaracteristicasProductoComponent
  ],
  templateUrl: './producto.component.html',
  styleUrls: ['./producto.component.scss']
})
export class ProductoComponent implements OnInit {
  productos: Product[] = [];
  marcas: Brand[] = [];
  marcaMap: Record<number, string> = {};
  imagenesCache: Record<number, string> = {};

  formData = {
    name: '', price: 0, category: null as number | null,
    brand: null as number | null, disabled: false, idImage: null as number | null
  };

  selectedProducto: Product | null = null;
  imagePreview: string | null = null;
  selectedFile: File | null = null;
  nombreArchivo: string | null = null;

  mostrarFormulario = false;
  mostrarFormularioMarca = false;
  mostrarFormularioCrearMarca = false;
  mostrarCaracteristicasProducto = false;
  mostrarMasOpciones = false;

  tipoFiltro: '' | 'nombre' | 'marca' | 'caracteristica' = '';
  filtro = '';
  estadoFiltro: 'habilitados' | 'deshabilitados' | 'todos' = 'habilitados';
  filtroSugs: string[] = [];
  isLoading = false;

  featureQuery = '';
  featureSuggestions: string[] = [];
  selectedFeatureTags: string[] = []; // chips
  displayEmpty = (_: any): string => '';
  productFeatureTags: Record<number, string[]> = {};

  get mainQuery(): string {
    return this.tipoFiltro === 'caracteristica' ? this.featureQuery : this.filtro;
  }
  set mainQuery(v: string) {
    if (this.tipoFiltro === 'caracteristica') this.featureQuery = v ?? '';
    else this.filtro = v ?? '';
  }
  get mainSuggestions(): string[] {
    return this.tipoFiltro === 'caracteristica' ? this.featureSuggestions : this.filtroSugs;
  }

  categoriaId: number | null = null;
  categoriaNombre = '';
  features: any[] = [];
  productFeatures: any[] = [];

  @ViewChild('formProductoTpl') formProductoTpl!: TemplateRef<any>;
  @ViewChild('formOrganizarMarcasTpl') formOrganizarMarcasTpl!: TemplateRef<any>;
  @ViewChild('formCrearMarcaTpl') formCrearMarcaTpl!: TemplateRef<any>;
  @ViewChild('formProdCaractTpl') formProdCaractTpl!: TemplateRef<any>;

  private overlay = inject(OverlayPortalService);

  private productFormRef?: OverlayHandle;
  private organizarMarcasRef?: OverlayHandle;
  private crearMarcaRef?: OverlayHandle;
  private prodCaractRef?: OverlayHandle;

  constructor(private api: ApiService, private toast: ToastService, private route: ActivatedRoute, private dialog: MatDialog) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(async params => {
      const nombreCategoria = params.get('nombreCategoria');
      if (!nombreCategoria) return;
      this.categoriaNombre = decodeURIComponent(nombreCategoria);
      await this.loadCategoriaYProductos(this.categoriaNombre);
    });
  }

  get estaEditando(): boolean { return !!this.selectedProducto; }

  private mapProductos(raw: any[], idCategory: number): Product[] {
    return (raw || [])
      .filter((p: any) => (p.idCategory ?? p.category?.idCategory) === idCategory)
      .map((p: any) => {
        const idBrand = p.idBrand ?? p.brand?.idBrand ?? null;
        return {
          idProduct: Number(p.idProduct ?? p.id),
          name: String(p.name ?? ''),
          price: Number(p.price ?? 0),
          idCategory: Number(p.idCategory ?? p.category?.idCategory ?? idCategory),
          idBrand,
          brand: idBrand ? { idBrand, name: this.marcaMap[idBrand] } : null,
          idImage: p.idImage ?? null,
          disabled: !!p.disabled
        } as Product;
      });
  }

  private async ensureImagen(file: File | null, nombre: string, categoriaId: number, currentIdImage: number | null): Promise<number | null> {
    if (!file) return currentIdImage;
    if (currentIdImage) {
      const res = await firstValueFrom(this.api.updateImagen(currentIdImage, file, nombre, 'producto', String(categoriaId))) as ImageResp;
      const imgId = res.idImage ?? res.id ?? currentIdImage;
      this.imagenesCache[imgId] = `${res.url}?t=${Date.now()}`;
      return imgId;
    } else {
      const res = await firstValueFrom(this.api.uploadImage(file, nombre, 'producto', String(categoriaId))) as ImageResp;
      const imgId = res.idImage ?? res.id ?? null;
      if (imgId) this.imagenesCache[imgId] = `${res.url}?t=${Date.now()}`;
      return imgId;
    }
  }

  private buildPayload(idImage: number | null) {
    return {
      name: this.formData.name,
      price: this.formData.price,
      category: this.categoriaId ? { idCategory: this.categoriaId } : null,
      brand: this.formData.brand ? { idBrand: this.formData.brand } : null,
      idImage,
      disabled: false
    };
  }

  private requireCamposBasicos(): boolean {
    const ok = !!this.formData.name?.trim() && this.formData.price > 0 && !!this.categoriaId;
    if (!ok) this.toast.mostrarMensaje('❌ Complete los campos requeridos');
    return ok;
  }

  async loadCategoriaYProductos(nombre: string): Promise<void> {
    try {
      const categoria = await firstValueFrom(this.api.getCategoriaByNombre(nombre)) as Category;
      this.categoriaId = categoria.idCategory;
      await this.loadMarcasPorCategoria(this.categoriaId);
      await this.loadProductosPorCategoria(this.categoriaId);
    } catch {
      this.toast.mostrarMensaje('❌ No se encontró la categoría');
    }
  }

  async loadProductosPorCategoria(idCategory: number): Promise<void> {
    const data = await firstValueFrom(this.api.getProductos());
    this.productos = this.mapProductos(data, idCategory);
    await Promise.all(this.productos.filter(p => !!p.idImage).map(p => this.loadImagen(p.idImage!)));

    // construir mapa de tags de características
    await this.buildFeatureTagsForProducts();
  }

  async loadMarcasPorCategoria(idCategory: number): Promise<void> {
    const all = await firstValueFrom(this.api.getMarcas()) as Brand[];
    this.marcas = (all || []).filter(m => Number(m.category ?? (m as any).idCategory) === idCategory);
    this.marcaMap = Object.fromEntries(this.marcas.map(m => [m.idBrand, m.name]));
  }

  loadFeatures(): void {
    this.api.getFeatures().subscribe({
      next: (data) => this.features = data || [],
      error: () => this.features = []
    });
  }

  private productosPorEstado(): Product[] {
    if (this.estadoFiltro === 'habilitados') return this.productos.filter(p => !p.disabled);
    if (this.estadoFiltro === 'deshabilitados') return this.productos.filter(p => p.disabled);
    return this.productos;
  }

  // ======= Filtro principal (nombre/marca + características) =======
  filtrarProductos(): Product[] {
    let base = this.productosPorEstado();

    const q = this.filtro.trim().toLowerCase();
    if (q && this.tipoFiltro && this.tipoFiltro !== 'caracteristica') {
      base = base.filter(p => {
        const nombre = p.name?.toLowerCase() || '';
        const marca = p.brand?.name?.toLowerCase() || '';
        return this.tipoFiltro === 'nombre' ? nombre.includes(q) : marca.includes(q);
      });
    }

    if (this.tipoFiltro === 'caracteristica' && this.selectedFeatureTags.length > 0) {
      const selected = this.selectedFeatureTags.map(t => t.toLowerCase().trim());
      base = base.filter(p => {
        const tags = (this.productFeatureTags[p.idProduct] || []).map(t => t.toLowerCase());
        if (tags.length === 0) return false;
        return selected.every(sel => tags.includes(sel));
      });
    }

    return base;
  }

  onEstadoFiltroChange(): void { this.onFiltroTyping(this.filtro); }

  onMainTyping(val: any): void {
    if (this.tipoFiltro === 'caracteristica') {
      this.onFeatureInput(val);
    } else {
      this.onFiltroTyping(val);
    }
  }

  // ======= Sugerencias por nombre/marca =======
  onFiltroTyping(val: any): void {
    const q = (val ?? '').toString().trim().toLowerCase();
    this.filtro = val ?? '';
    if (!this.tipoFiltro || !q) { this.filtroSugs = []; return; }
    if (this.tipoFiltro === 'nombre') {
      const pool = this.productosPorEstado().map(p => p.name).filter(Boolean) as string[];
      this.filtroSugs = Array.from(new Set(pool.filter(n => n.toLowerCase().includes(q)))).slice(0, 12);
    } else {
      const pool = this.marcas.map(m => m.name).filter(Boolean) as string[];
      this.filtroSugs = Array.from(new Set(pool.filter(n => n.toLowerCase().includes(q)))).slice(0, 12);
    }
  }

  // ======= Selección en autocomplete según tipo =======
  onMainAutoSelected(value: string): void {
    if (this.tipoFiltro === 'caracteristica') {
      this.onFeatureSuggestionSelected(value);
    } else {
      this.onFiltroSugSelected(value);
    }
  }

  onFiltroSugSelected(nombre: string): void { this.filtro = nombre; this.filtroSugs = []; }
  onTipoFiltroChange(): void {
    // limpia búsquedas al cambiar el tipo
    this.filtro = '';
    this.filtroSugs = [];

    if (this.tipoFiltro === 'caracteristica') {
      this.featureQuery = '';
      this.recomputeFeatureSuggestions();
    } else {
      this.selectedFeatureTags = [];
      this.featureQuery = '';
      this.featureSuggestions = [];
    }
  }

  // ======= Características: input/sugerencias/chips =======
  onFeatureInput(val: any): void {
    this.featureQuery = (val ?? '').toString();
    this.recomputeFeatureSuggestions();
  }

  onFeatureSuggestionSelected(tag: string): void {
    const t = (tag || '').trim();
    if (!t) return;
    const exists = this.selectedFeatureTags.some(x => x.toLowerCase() === t.toLowerCase());
    if (!exists) this.selectedFeatureTags.push(t);
    this.featureQuery = '';
    this.recomputeFeatureSuggestions();
  }

  removeSelectedFeatureTag(tag: string): void {
    this.selectedFeatureTags = this.selectedFeatureTags.filter(x => x.toLowerCase() !== tag.toLowerCase());
    this.recomputeFeatureSuggestions();
  }

  clearFeatureFilters(): void {
    this.featureQuery = '';
    this.selectedFeatureTags = [];
    this.recomputeFeatureSuggestions();
  }

  private recomputeFeatureSuggestions(): void {
    const q = this.featureQuery.trim().toLowerCase();
    const taken = new Set(this.selectedFeatureTags.map(t => t.toLowerCase()));

    const poolAll: string[] = [];
    for (const p of this.productosPorEstado()) {
      const tags = this.productFeatureTags[p.idProduct] || [];
      poolAll.push(...tags);
    }

    const uniq = Array.from(new Set(poolAll));
    this.featureSuggestions = uniq
      .filter(t => !!t)
      .filter(t => !taken.has(t.toLowerCase()))
      .filter(t => !q || t.toLowerCase().includes(q))
      .slice(0, 15);
  }

  private async buildFeatureTagsForProducts(): Promise<void> {
    this.productFeatureTags = {};
    await Promise.all(
      this.productos.map(async (p) => {
        try {
          const list = await firstValueFrom(this.api.getProductFeaturesByProduct(p.idProduct)) as any[];
          const tags = (list || []).map((pf) => this.makeTag(pf)).filter(Boolean);
          this.productFeatureTags[p.idProduct] = Array.from(new Set(tags));
        } catch {
          this.productFeatureTags[p.idProduct] = [];
        }
      })
    );
    this.recomputeFeatureSuggestions();
  }

  private makeTag(pf: any): string {
    const base = String(pf?.feature?.featureName ?? pf?.featureName ?? '').trim();
    const val = String(pf?.featureValue ?? '').trim();
    if (!base) return '';
    return val ? `${base}: ${val}` : base;
  }

  async loadImagen(idImage: number): Promise<void> {
    try {
      const res = await firstValueFrom(this.api.getImagenById(idImage)) as ImageResp;
      const imgId = res.idImage ?? res.id ?? idImage;
      this.imagenesCache[imgId] = `${res.url}?t=${Date.now()}`;
    } catch {
      this.imagenesCache[idImage] = '/img/no-image.png';
    }
  }

  getUrlImagen(idImage?: number | null): string {
    return idImage ? (this.imagenesCache[idImage] || '/img/no-image.png') : '/img/no-image.png';
  }

  onFileSelected(event: any): void {
    const file: File | undefined = event?.target?.files?.[0];
    const MAX_BYTES = 1 * 1024 * 1024;
    if (!file) return this.resetImageSelection();
    if (file.size > MAX_BYTES) {
      this.toast.mostrarMensaje('❌ La imagen no puede ser mayor a 1 MB.');
      return this.resetImageSelection();
    }
    this.selectedFile = file;
    this.nombreArchivo = file.name;
    const r = new FileReader();
    r.onload = (e: any) => this.imagePreview = e.target.result;
    r.readAsDataURL(file);
  }

  resetImageSelection(): void {
    this.selectedFile = null;
    this.imagePreview = null;
    this.nombreArchivo = null;
  }

  onImageError(ev: Event): void { (ev.target as HTMLImageElement).src = '/img/no-image.png'; }

  async crearProducto(): Promise<void> {
    if (!this.requireCamposBasicos() || !this.categoriaId) return;
    this.isLoading = true;
    try {
      const idImage = await this.ensureImagen(this.selectedFile, this.formData.name.trim(), this.categoriaId, null);
      await firstValueFrom(this.api.createProducto(this.buildPayload(idImage)));
      this.toast.mostrarMensaje('✅ Producto creado correctamente');
      this.cerrarFormulario();
      await this.loadProductosPorCategoria(this.categoriaId);
    } catch {
      this.toast.mostrarMensaje('❌ Error al crear producto');
    } finally { this.isLoading = false; }
  }

  async actualizarProducto(): Promise<void> {
    if (!this.requireCamposBasicos() || !this.categoriaId || !this.selectedProducto) return;
    this.isLoading = true;
    try {
      const currentIdImg = this.selectedProducto.idImage ?? null;
      const idImage = await this.ensureImagen(this.selectedFile, this.formData.name.trim(), this.categoriaId, currentIdImg);
      await firstValueFrom(this.api.updateProducto(this.selectedProducto.idProduct, this.buildPayload(idImage)));
      this.toast.mostrarMensaje('✅ Producto actualizado correctamente');
      this.cerrarFormulario();
      await this.loadProductosPorCategoria(this.categoriaId);
    } catch {
      this.toast.mostrarMensaje('❌ Error al actualizar producto');
    } finally { this.isLoading = false; }
  }

  guardarProducto(): void { this.estaEditando ? this.actualizarProducto() : this.crearProducto(); }

  // ======= OVERLAY DEL FORM DE PRODUCTO =======
  abrirFormulario(producto: Product | null = null): void {
    this.selectedProducto = producto;
    this.formData = {
      name: producto?.name ?? '',
      price: producto?.price ?? 0,
      category: this.categoriaId,
      brand: producto?.brand?.idBrand ?? producto?.idBrand ?? null,
      idImage: producto?.idImage ?? null,
      disabled: false
    };

    if (this.categoriaId && (!this.marcas || this.marcas.length === 0)) {
      this.loadMarcasPorCategoria(this.categoriaId);
    }
    this.resetImageSelection();
    this.mostrarFormulario = true;
    this.mostrarMasOpciones = this.formData.brand != null;
    this.productFormRef = this.overlay.open(this.formProductoTpl);
  }

  cerrarFormulario(): void {
    this.resetForm();
    this.mostrarFormulario = false;
    this.mostrarMasOpciones = false;
    if (this.productFormRef) {
      this.productFormRef?.close()
      this.productFormRef = undefined;
    }
  }

  resetForm(): void {
    this.formData = { name: '', price: 0, category: null, brand: null, disabled: false, idImage: null };
    this.selectedProducto = null;
    this.resetImageSelection();
  }

  editProducto(producto: Product): void { this.abrirFormulario(producto); }

  abrirFormularioMarca(): void {
    this.mostrarFormularioMarca = true;
    if (this.categoriaId) this.loadMarcasPorCategoria(this.categoriaId);
    this.organizarMarcasRef = this.overlay.open(this.formOrganizarMarcasTpl);
  }
  abrirFormularioCrearMarca(): void { this.mostrarFormularioCrearMarca = true; this.crearMarcaRef = this.overlay.open(this.formCrearMarcaTpl) }
  abrirFormularioMarcaDesdeSelect(): void { this.mostrarFormularioMarca = true; this.crearMarcaRef = this.overlay.open(this.formCrearMarcaTpl) }
  cerrarFormularioCrearMarca(): void { this.mostrarFormularioCrearMarca = false; this.crearMarcaRef?.close(); this.crearMarcaRef = undefined; }
  cerrarFormularioMarca(): void { this.mostrarFormularioMarca = false; this.organizarMarcasRef?.close(); this.organizarMarcasRef = undefined; }

  abrirFormularioCrearCaracteristicaProducto(): void {
    if (!this.selectedProducto) return;
    this.mostrarCaracteristicasProducto = true;
    this.loadFeatures();
    this.prodCaractRef = this.overlay.open(this.formProdCaractTpl);
  }
  cerrarFormularioCaracteristicaProducto(): void {
    this.mostrarCaracteristicasProducto = false;
    this.prodCaractRef?.close(); this.prodCaractRef = undefined;
    // refrescar tags de características tras gestionar
    this.buildFeatureTagsForProducts();
  }

  deshabilitar(p: Product): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px', maxWidth: '95vw', panelClass: 'custom-confirm-dialog', disableClose: true,
      data: { title: 'Deshabilitar producto', message: `¿Seguro que deseas deshabilitar el producto "${p.name}"?` }
    });
    dialogRef.afterClosed().subscribe(ok => {
      if (!ok) return;
      const payload = {
        name: p.name, price: p.price,
        category: { idCategory: p.idCategory ?? this.categoriaId },
        brand: p.idBrand ? { idBrand: p.idBrand } : null,
        idImage: p.idImage ?? null,
        disabled: true
      };
      this.api.updateProducto(p.idProduct, payload).subscribe({
        next: async () => {
          this.toast.mostrarMensaje('✅ Producto deshabilitado correctamente');
          if (this.categoriaId) await this.loadProductosPorCategoria(this.categoriaId);
        },
        error: () => this.toast.mostrarMensaje('❌ Error al deshabilitar producto')
      });
    });
  }

  habilitar(p: Product): void {
    if (!this.categoriaId) return;

    const payload = {
      name: p.name,
      price: p.price,
      category: { idCategory: p.idCategory ?? this.categoriaId },
      brand: (p.idBrand ?? p.brand?.idBrand) ? { idBrand: (p.idBrand ?? p.brand!.idBrand) } : null,
      idImage: p.idImage ?? null,
      disabled: false
    };

    this.api.updateProducto(p.idProduct, payload).subscribe({
      next: async () => {
        this.toast.mostrarMensaje('✅ Producto habilitado correctamente');
        await this.loadProductosPorCategoria(this.categoriaId!);
      },
      error: () => this.toast.mostrarMensaje('❌ Error al habilitar producto')
    });
  }

  onMarcaDeleted(idBrand: number): void {
    if (this.categoriaId) {
      this.loadMarcasPorCategoria(this.categoriaId);
      this.loadProductosPorCategoria(this.categoriaId);
    }
    if (this.formData.brand === idBrand) {
      this.formData.brand = null;
      this.mostrarMasOpciones = false;
    }
  }

  getDisplayWith(): ((value: any) => string) | null {
    return this.tipoFiltro === 'caracteristica' ? this.displayEmpty : null;
  }
}