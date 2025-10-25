import { ChangeDetectorRef, Component, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { CaracteristicasProductoComponent } from './forms/caracteristicas-producto/caracteristicas-producto.component';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../view/confirm-dialog/confirm-dialog.component';
import { OverlayHandle, OverlayPortalService } from '../../core/services/overlay-portal.service';

import { lower, mapProductos, norm, productosPorEstado, take, uniq } from './producto.utils';
import { Brand, Category, ImageResp, Product } from './producto.models';
import { FeatureFilterService } from '../../core/services/feature-filter.service';
import { MarcasComponent } from './forms/marcas/marcas.component';
import { MatHeaderCellDef, MatTableModule } from "@angular/material/table";
import { MatIconModule } from '@angular/material/icon';
import { refreshSelectedProductSimple } from './product-refresh.util';
import { PageLoadingService } from '../../core/services/page-loading.service';

@Component({
  selector: 'app-producto',
  standalone: true,
  imports: [
    FormsModule, RouterModule,
    MatInputModule, MatGridListModule, MatButtonModule, MatSelectModule,
    MatAutocompleteModule, MatChipsModule,
    MarcasComponent, CaracteristicasProductoComponent,
    MatHeaderCellDef,
    MatTableModule, MatIconModule
  ],
  templateUrl: './producto.component.html',
  styleUrls: ['./producto.component.scss']
})
export class ProductoComponent implements OnInit {
  contentReady = false;

  productos: Product[] = [];
  marcas: Brand[] = [];
  marcaMap: Record<number, string> = {};
  imagenesCache: Record<number, string> = {};

  formData = {
    name: '', price: 0, category: null as number | null, brand: null as number | null, disabled: false, idImage: null as number | null
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

  private namePool: string[] = [];
  private brandPool: string[] = [];

  displayedInfoColumns: string[] = ['prop', 'value'];
  displayedFeatureColumns: string[] = ['base', 'value'];
  productFeatureRows: Array<{ base: string; value: string }> = [];

  get productInfoRows() {
    const p = this.selectedProducto;
    if (!p) return [];
    return [
      { prop: 'Nombre', value: p.name },
      { prop: 'Precio', value: `S/. ${p.price}` },
      { prop: 'Marca', value: p.brand?.name || '—' },
      { prop: 'Estado', value: p.disabled ? 'Deshabilitado' : 'Habilitado' },
    ];
  }

  get featureQuery() { return this.featuresSvc.featureQuery; }
  set featureQuery(v: string) { this.featuresSvc.featureQuery = v; }
  get featureSuggestions() { return this.featuresSvc.featureSuggestions; }
  get selectedFeatureTags() { return this.featuresSvc.selectedFeatureTags; }

  displayEmpty = (_: any): string => '';
  getDisplayWith(): ((value: any) => string) | null {
    return this.tipoFiltro === 'caracteristica' ? this.displayEmpty : null;
  }

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
  imgLoaded: Record<number, boolean> = {};

  @ViewChild('formProductoTpl') formProductoTpl!: TemplateRef<any>;
  @ViewChild('formOrganizarMarcasTpl') formOrganizarMarcasTpl!: TemplateRef<any>;
  @ViewChild('formCrearMarcaTpl') formCrearMarcaTpl!: TemplateRef<any>;
  @ViewChild('formProdCaractTpl') formProdCaractTpl!: TemplateRef<any>;
  @ViewChild('productDetailTpl') productDetailTpl!: TemplateRef<any>;

  private productDetailRef?: OverlayHandle;
  private overlay = inject(OverlayPortalService);

  private productFormRef?: OverlayHandle;
  private organizarMarcasRef?: OverlayHandle;
  private crearMarcaRef?: OverlayHandle;
  private prodCaractRef?: OverlayHandle;

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private featuresSvc: FeatureFilterService,
    private cd: ChangeDetectorRef,
    private pageLoading: PageLoadingService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(async params => {
      const nombreCategoria = params.get('nombreCategoria');
      if (!nombreCategoria) return;

      this.categoriaNombre = decodeURIComponent(nombreCategoria);
      this.contentReady = false;
      this.pageLoading.start();

      await this.loadCategoriaYProductos(this.categoriaNombre);
    });
  }

  private async refreshProductNow(idProduct: number): Promise<void> {
    await refreshSelectedProductSimple({
      api: {
        getProductoById: (id: number) => this.api.getProductoById(id),
        getProductFeaturesByProduct: (id: number) => this.api.getProductFeaturesByProduct(id),
      },
      idProduct,
      marcaMap: this.marcaMap,
      setSelected: (p: Product) => { this.selectedProducto = p; },

      setFeatureRows: (rows: Array<{ base: string; value?: string; detail?: string }>) => {
        this.productFeatureRows = rows.map(r => ({
          base: r.base,
          value: r.value ?? r.detail ?? ''
        }));
      },

      reloadImage: async (idImage: number) => { await this.loadImagen(idImage); }
    });
    this.cd.detectChanges();
  }

  public async refreshDetailNow(): Promise<void> {
    if (!this.selectedProducto) return;
    await this.refreshProductNow(this.selectedProducto.idProduct);
  }

  get estaEditando(): boolean { return !!this.selectedProducto; }

  // ======= CARGA =======
  async loadCategoriaYProductos(nombre: string): Promise<void> {
    try {
      const categoria = await firstValueFrom(this.api.getCategoriaByNombre(nombre)) as Category;
      this.categoriaId = categoria.idCategory;

      await this.loadMarcasPorCategoria(this.categoriaId);
      await this.loadProductosPorCategoria(this.categoriaId);
      const ids = this.productos.map(p => p.idImage).filter((id): id is number => !!id);
      await this.preloadImages(ids);

      this.contentReady = true;
      this.pageLoading.stop();
      this.cd.detectChanges();
    } catch {
      this.toast.mostrarMensaje('❌ No se encontró la categoría');
      this.contentReady = true;
      this.pageLoading.stop();
      this.cd.detectChanges();
    }
  }

  private async preloadImages(ids: number[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await firstValueFrom(this.api.getImagenById(id)) as ImageResp;
          const imgId = res.idImage ?? res.id ?? id;
          this.imagenesCache[imgId] = `${res.url}?t=${Date.now()}`;
          this.imgLoaded[imgId] = true;
        } catch {
          this.imagenesCache[id] = '/img/no-image.png';
          this.imgLoaded[id] = true;
        }
      })
    );
  }

  async loadProductFeaturesTable(productId: number): Promise<void> {
    try {
      const list = await firstValueFrom(this.api.getProductFeaturesByProduct(productId)) as any[];
      this.productFeatureRows = (list || []).map(pf => ({
        base: String(pf?.feature?.featureName ?? pf?.featureName ?? '').trim(),
        value: String(pf?.featureValue ?? '').trim()
      })).filter(r => r.base);
    } catch {
      this.productFeatureRows = [];
    }
  }

  async loadProductosPorCategoria(idCategory: number): Promise<void> {
    const data = await firstValueFrom(this.api.getProductos());
    this.productos = mapProductos(data, idCategory, this.marcaMap);
    this.namePool = uniq(this.productos.map(p => norm(p.name)).filter(Boolean));
    this.brandPool = uniq(
      this.productos
        .map(p => p.brand?.name ?? this.marcaMap[p.idBrand ?? -1])
        .map(norm)
        .filter(Boolean)
    );

    await this.featuresSvc.buildFeatureTagsForProducts(this.productos);
  }

  async loadMarcasPorCategoria(idCategory: number): Promise<void> {
    const all = await firstValueFrom(this.api.getMarcas()) as Brand[];
    this.marcas = (all || []).filter(m => Number(m.category ?? (m as any).idCategory) === idCategory);
    this.marcaMap = Object.fromEntries(this.marcas.map(m => [m.idBrand, m.name]));
  }

  // ======= FILTROS =======
  private productosPorEstado(): Product[] {
    return productosPorEstado(this.productos, this.estadoFiltro);
  }

  filtrarProductos(): Product[] {
    let base = this.productosPorEstado();

    const q = lower(this.filtro);
    if (q && this.tipoFiltro && this.tipoFiltro !== 'caracteristica') {
      const byName = (p: Product) => lower(p.name).includes(q);
      const byBrand = (p: Product) => lower(p.brand?.name).includes(q);
      base = base.filter(p => (this.tipoFiltro === 'nombre' ? byName(p) : byBrand(p)));
    }

    if (this.tipoFiltro === 'caracteristica' && this.selectedFeatureTags.length > 0) {
      base = this.featuresSvc.filterProductsBySelectedTags(base);
    }

    return base;
  }

  onEstadoFiltroChange(): void { this.onFiltroTyping(this.filtro); }

  onMainTyping(val: any): void {
    if (this.tipoFiltro === 'caracteristica') this.onFeatureInput(val);
    else this.onFiltroTyping(val);
  }

  // ======= Sugerencias nombre/marca =======
  onFiltroTyping(val: any): void {
    const q = lower(val);
    this.filtro = val ?? '';
    if (!this.tipoFiltro || !q) { this.filtroSugs = []; return; }

    if (this.tipoFiltro === 'nombre') {
      this.filtroSugs = take(this.namePool.filter(n => lower(n).includes(q)), 12);
    } else {
      this.filtroSugs = take(this.brandPool.filter(n => lower(n).includes(q)), 12);
    }
  }

  onMainAutoSelected(value: string): void {
    if (this.tipoFiltro === 'caracteristica') this.onFeatureSuggestionSelected(value);
    else this.onFiltroSugSelected(value);
  }

  onFiltroSugSelected(nombre: string): void { this.filtro = nombre; this.filtroSugs = []; }

  onTipoFiltroChange(): void {
    this.filtro = '';
    this.filtroSugs = [];

    if (this.tipoFiltro === 'caracteristica') {
      this.featureQuery = '';
      this.featuresSvc.recomputeFeatureSuggestions();
    } else {
      this.featuresSvc.clearFeatureFilters();
    }
  }

  // ======= CARACTERÍSTICAS =======
  onFeatureInput(val: any): void { this.featuresSvc.onFeatureInput(val); }
  onFeatureSuggestionSelected(tag: string): void { this.featuresSvc.onFeatureSuggestionSelected(tag); }
  removeSelectedFeatureTag(tag: string): void { this.featuresSvc.removeSelectedFeatureTag(tag); }
  clearFeatureFilters(): void { this.featuresSvc.clearFeatureFilters(); }

  // ======= Imágenes =======
  async loadImagen(idImage: number): Promise<void> {
    try {
      const res = await firstValueFrom(this.api.getImagenById(idImage)) as ImageResp;
      const imgId = res.idImage ?? res.id ?? idImage;
      this.imagenesCache[imgId] = `${res.url}?t=${Date.now()}`;
      this.imgLoaded[imgId] = true;
    } catch {
      this.imagenesCache[idImage] = '/img/no-image.png';
      this.imgLoaded[idImage] = true;
    }
    // ⚠️ ya NO hacemos pageLoading.stop() aquí
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

  resetImageSelection(): void { this.selectedFile = null; this.imagePreview = null; this.nombreArchivo = null; }
  onImageError(ev: Event): void { (ev.target as HTMLImageElement).src = '/img/no-image.png'; }

  // ======= CRUD Producto =======
  private requireCamposBasicos(): boolean {
    const ok = !!this.formData.name?.trim() && this.formData.price > 0 && !!this.categoriaId;
    if (!ok) this.toast.mostrarMensaje('❌ Complete los campos requeridos');
    return ok;
  }

  private buildPayload(idImage: number | null) {
    return {
      name: this.formData.name, price: this.formData.price, category: this.categoriaId ? { idCategory: this.categoriaId } : null,
      brand: this.formData.brand ? { idBrand: this.formData.brand } : null, idImage, disabled: false
    };
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

  async crearProducto(): Promise<void> {
    if (!this.requireCamposBasicos() || !this.categoriaId) return;
    this.isLoading = true;
    try {
      const idImage = await this.ensureImagen(this.selectedFile, this.formData.name.trim(), this.categoriaId, null);
      await firstValueFrom(this.api.createProducto(this.buildPayload(idImage)));
      this.toast.mostrarMensaje('✅ Producto creado correctamente');
      this.cerrarFormulario();
      await this.loadProductosPorCategoria(this.categoriaId);
      // precarga de nuevas imágenes (si aplica)
      const ids = this.productos.map(p => p.idImage).filter((id): id is number => !!id);
      await this.preloadImages(ids);
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
      await this.refreshProductNow(this.selectedProducto.idProduct);
    } catch {
      this.toast.mostrarMensaje('❌ Error al actualizar producto');
    } finally { this.isLoading = false; }
  }

  guardarProducto(): void { this.estaEditando ? this.actualizarProducto() : this.crearProducto(); }

  // ======= Overlays =======
  openProductDetail(p: Product): void {
    this.selectedProducto = p;
    this.productDetailRef = this.overlay.open(this.productDetailTpl);
    this.loadProductFeaturesTable(p.idProduct);
  }

  closeProductDetail(): void {
    this.productDetailRef?.close();
    this.productDetailRef = undefined;
  }

  abrirFormulario(producto: Product | null = null): void {
    this.selectedProducto = producto;
    this.formData = {
      name: producto?.name ?? '', price: producto?.price ?? 0, category: this.categoriaId,
      brand: producto?.brand?.idBrand ?? producto?.idBrand ?? null, idImage: producto?.idImage ?? null, disabled: false
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
    this.productFormRef?.close();
    this.productFormRef = undefined;
  }

  resetForm(): void {
    this.formData = { name: '', price: 0, category: null, brand: null, disabled: false, idImage: null };
    this.resetImageSelection();
  }

  editProducto(producto: Product): void { this.abrirFormulario(producto); }

  abrirFormularioMarca(): void {
    this.mostrarFormularioMarca = true;
    if (this.categoriaId) this.loadMarcasPorCategoria(this.categoriaId);
    this.organizarMarcasRef = this.overlay.open(this.formOrganizarMarcasTpl);
  }
  abrirFormularioCrearMarca(): void { this.mostrarFormularioCrearMarca = true; this.crearMarcaRef = this.overlay.open(this.formCrearMarcaTpl); }
  abrirFormularioMarcaDesdeSelect(): void { this.mostrarFormularioMarca = true; this.crearMarcaRef = this.overlay.open(this.formCrearMarcaTpl); }
  cerrarFormularioCrearMarca(): void { this.mostrarFormularioCrearMarca = false; this.crearMarcaRef?.close(); this.crearMarcaRef = undefined; }
  cerrarFormularioMarca(): void { this.mostrarFormularioMarca = false; this.organizarMarcasRef?.close(); this.organizarMarcasRef = undefined; }

  abrirFormularioCrearCaracteristicaProducto(): void {
    if (!this.selectedProducto) return;
    this.mostrarCaracteristicasProducto = true;
    this.prodCaractRef = this.overlay.open(this.formProdCaractTpl);
  }
  cerrarFormularioCaracteristicaProducto(): void {
    this.mostrarCaracteristicasProducto = false;
    this.prodCaractRef?.close(); this.prodCaractRef = undefined;
    this.featuresSvc.buildFeatureTagsForProducts(this.productos);
  }

  // ======= Habilitar/Deshabilitar =======
  deshabilitar(p: Product): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px', maxWidth: '95vw', panelClass: 'custom-confirm-dialog', disableClose: true,
      data: { title: 'Deshabilitar producto', message: `¿Seguro que deseas deshabilitar el producto "${p.name}"?` }
    });
    dialogRef.afterClosed().subscribe(ok => {
      if (!ok) return;
      const payload = {
        name: p.name, price: p.price, category: { idCategory: p.idCategory ?? this.categoriaId },
        brand: p.idBrand ? { idBrand: p.idBrand } : null, idImage: p.idImage ?? null, disabled: true
      };
      this.api.updateProducto(p.idProduct, payload).subscribe({
        next: async () => {
          this.toast.mostrarMensaje('✅ Producto deshabilitado correctamente');
          await this.refreshProductNow(p.idProduct);
          if (this.categoriaId) await this.loadProductosPorCategoria(this.categoriaId);
        },
        error: () => this.toast.mostrarMensaje('❌ Error al deshabilitar producto')
      });
    });
  }

  habilitar(p: Product): void {
    if (!this.categoriaId) return;

    const payload = {
      name: p.name, price: p.price, category: { idCategory: p.idCategory ?? this.categoriaId },
      brand: (p.idBrand ?? p.brand?.idBrand) ? { idBrand: (p.idBrand ?? p.brand!.idBrand) } : null, idImage: p.idImage ?? null, disabled: false
    };

    this.api.updateProducto(p.idProduct, payload).subscribe({
      next: async () => {
        this.toast.mostrarMensaje('✅ Producto habilitado correctamente');
        await this.refreshProductNow(p.idProduct);
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
}
