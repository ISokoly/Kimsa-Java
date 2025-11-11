// oxlint-disable no-unused-expressions
import { ChangeDetectorRef, Component, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';

import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatHeaderCellDef, MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';

import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { OverlayHandle, OverlayPortalService } from '../../core/services/overlay-portal.service';
import { PageLoadingService } from '../../core/services/page-loading.service';

import { lower, mapProductos, norm, productosPorEstado, take, uniq } from './producto.utils';
import { Brand, Category, ImageResp, Product } from './producto.models';
import { FeatureFilterService } from '../../core/services/feature-filter.service';
import { MarcasComponent } from './forms/marcas/marcas.component';
import { ConfirmDialogComponent } from '../../view/confirm-dialog/confirm-dialog.component';
import { refreshSelectedProductSimple } from './product-refresh.util';

import { ProductoFormWizardComponent } from './forms/producto-form-wizard.component';
import { CaracteristicasComponent } from "./forms/caracteristicas/caracteristicas.component";

@Component({
  selector: 'app-producto',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatInputModule, MatGridListModule, MatButtonModule, MatSelectModule,
    MatAutocompleteModule, MatChipsModule, MatHeaderCellDef, MatTableModule, MatIconModule,
    MatDialogModule, MatDividerModule,
    MarcasComponent, ProductoFormWizardComponent,
    CaracteristicasComponent
  ],
  templateUrl: './producto.component.html',
  styleUrls: ['./producto.component.scss']
})
export class ProductoComponent implements OnInit {
  contentReady = false;

  productos: Product[] = [];
  marcas: Brand[] = [];
  supplies: any[] = [];
  marcaMap: Record<number, string> = {};
  imagenesCache: Record<number, string> = {};
  imgLoaded: Record<number, boolean> = {};

  tipoFiltro: '' | 'nombre' | 'marca' | 'caracteristica' = '';
  filtro = '';
  estadoFiltro: 'habilitados' | 'deshabilitados' | 'todos' = 'habilitados';
  filtroSugs: string[] = [];
  private namePool: string[] = [];
  private brandPool: string[] = [];
  features: any[] = [];

  isLoading = false;

  displayedInfoColumns: string[] = ['prop', 'value'];
  displayedFeatureColumns: string[] = ['base', 'value'];
  productFeatureRows: Array<{ base: string; value: string }> = [];
  mostrarConfigurarFeature = false;

  selectedProducto: Product | null = null;

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

  // overlays/templates
  @ViewChild('formProductoTpl') formProductoTpl!: TemplateRef<any>;
  @ViewChild('formOrganizarMarcasTpl') formOrganizarMarcasTpl!: TemplateRef<any>;
  @ViewChild('formCrearMarcaTpl') formCrearMarcaTpl!: TemplateRef<any>;
  @ViewChild('formOrgCaractTpl') formOrgCaractTpl!: TemplateRef<any>;
  @ViewChild('productDetailTpl') productDetailTpl!: TemplateRef<any>;

  private productDetailRef?: OverlayHandle;
  private productFormRef?: OverlayHandle;
  private organizarMarcasRef?: OverlayHandle;
  private crearMarcaRef?: OverlayHandle;
  private orgCaractRef?: OverlayHandle;

  private overlay = inject(OverlayPortalService);

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private dialog: MatDialog,                 // ✅ inyección válida (MatDialogModule importado)
    private featuresSvc: FeatureFilterService,
    private cd: ChangeDetectorRef,
    private pageLoading: PageLoadingService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(async params => {
      const nombreCategoria = params.get('nombreCategoria');
      if (!nombreCategoria) return;

      this.categoriaNombre = decodeURIComponent(nombreCategoria);
      this.contentReady = false;
      this.pageLoading.start();

      await this.loadCategoriaYProductos(this.categoriaNombre);
      await this.loadAllFeatures();

    });
  }

  // ========= CARGA =========
  async loadCategoriaYProductos(nombre: string): Promise<void> {
    try {
      const categoria = await firstValueFrom(this.api.getCategoriaByNombre(nombre)) as Category;
      this.categoriaId = categoria.idCategory;

      await this.loadMarcasPorCategoria(this.categoriaId);
      await this.loadProductosPorCategoria(this.categoriaId);
      await this.loadSupplies();

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

  private async loadSupplies(): Promise<void> {
    try {
      const res = await firstValueFrom(this.api.getSupplies());
      this.supplies = Array.isArray(res) ? res : [];
    } catch {
      this.supplies = [];
    }
  }

  loadAllFeatures(): void {
    this.api.getFeatures().subscribe((data: any[]) => {
      this.features = data || [];
    });
  }

  private async preloadImages(ids: number[]): Promise<void> {
    if (!ids?.length) return;
    await Promise.all(ids.map(async (id) => {
      try {
        const res = await firstValueFrom(this.api.getImagenById(id)) as ImageResp;
        const imgId = res.idImage ?? res.id ?? id;
        this.imagenesCache[imgId] = `${res.url}?t=${Date.now()}`;
        this.imgLoaded[imgId] = true;
      } catch {
        this.imagenesCache[id] = '/img/no-image.png';
        this.imgLoaded[id] = true;
      }
    }));
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

  async onMarcasChanged(): Promise<void> {
    if (this.categoriaId) await this.loadMarcasPorCategoria(this.categoriaId);
    await this.refreshDetailNow();
  }

  // ========= FILTROS =========
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
    this.filtro = ''; this.filtroSugs = [];
    if (this.tipoFiltro === 'caracteristica') {
      this.featureQuery = '';
      this.featuresSvc.recomputeFeatureSuggestions();
    } else {
      this.featuresSvc.clearFeatureFilters();
    }
  }

  // ========= CARACTERÍSTICAS (filtro) =========
  onFeatureInput(val: any): void { this.featuresSvc.onFeatureInput(val); }
  onFeatureSuggestionSelected(tag: string): void { this.featuresSvc.onFeatureSuggestionSelected(tag); }
  removeSelectedFeatureTag(tag: string): void { this.featuresSvc.removeSelectedFeatureTag(tag); }
  clearFeatureFilters(): void { this.featuresSvc.clearFeatureFilters(); }

  // ========= IMAGEN (detalle) =========
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
  }
  getUrlImagen(idImage?: number | null): string {
    return idImage ? (this.imagenesCache[idImage] || '/img/no-image.png') : '/img/no-image.png';
  }
  onImageError(ev: Event): void { (ev.target as HTMLImageElement).src = '/img/no-image.png'; }

  // ========= DETALLE =========
  async refreshDetailNow(): Promise<void> {
    if (!this.selectedProducto) return;
    await refreshSelectedProductSimple({
      api: {
        getProductoById: (id: number) => this.api.getProductoById(id),
        getProductFeaturesByProduct: (id: number) => this.api.getProductFeaturesByProduct(id),
      },
      idProduct: this.selectedProducto.idProduct,
      marcaMap: this.marcaMap,
      setSelected: (p: Product) => { this.selectedProducto = p; },
      setFeatureRows: (rows: Array<{ base: string; value?: string; detail?: string }>) => {
        this.productFeatureRows = rows.map(r => ({ base: r.base, value: r.value ?? r.detail ?? '' }));
      },
      reloadImage: async (idImage: number) => { await this.loadImagen(idImage); }
    });
    this.cd.detectChanges();
  }

  async onProductoActualizado(idProduct: number): Promise<void> {
    if (this.categoriaId) await this.loadProductosPorCategoria(this.categoriaId);

    if (this.selectedProducto && this.selectedProducto.idProduct === idProduct) {
      await this.refreshDetailNow();
    } else {
      const p = this.productos.find(p => p.idProduct === idProduct);
      if (p?.idImage) await this.loadImagen(p.idImage);
    }

    this.cerrarFormulario();
  }

  // ========= OVERLAYS =========
  openProductDetail(p: Product): void {
    this.selectedProducto = p;
    this.productDetailRef = this.overlay.open(this.productDetailTpl);
    this.loadProductFeaturesTable(p.idProduct);
  }
  closeProductDetail(): void {
    this.productDetailRef?.close();
    this.productDetailRef = undefined;
  }

  abrirFormulario(_producto: Product | null = null): void {
    if (!this.categoriaId) {
      this.toast.mostrarMensaje('❌ No hay categoría seleccionada.');
      return;
    }
    this.closeProductDetail();

    this.productFormRef?.close();
    this.productFormRef = undefined;

    this.selectedProducto = _producto ? { ..._producto } : null;

    setTimeout(() => {
      this.productFormRef = this.overlay.open(this.formProductoTpl);
    }, 0);
  }


  cerrarFormulario(): void {
    this.productFormRef?.close();
    this.productFormRef = undefined;
  }

  // ========= Habilitar/Deshabilitar =========
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
          await this.refreshDetailNow();
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
        await this.refreshDetailNow();
        await this.loadProductosPorCategoria(this.categoriaId!);
      },
      error: () => this.toast.mostrarMensaje('❌ Error al habilitar producto')
    });
  }

  // ========= Marcas =========
  abrirFormularioMarca(): void {
    this.organizarMarcasRef = this.overlay.open(this.formOrganizarMarcasTpl);
  }
  abrirFormularioCrearMarca(): void {
    this.crearMarcaRef = this.overlay.open(this.formCrearMarcaTpl);
  }
  cerrarFormularioCrearMarca(): void {
    this.crearMarcaRef?.close(); this.crearMarcaRef = undefined;
  }
  cerrarFormularioMarca(): void {
    this.organizarMarcasRef?.close(); this.organizarMarcasRef = undefined;
  }

  onMarcaDeleted(_idBrand: number): void {
    if (this.categoriaId) {
      this.loadMarcasPorCategoria(this.categoriaId);
      this.loadProductosPorCategoria(this.categoriaId);
    }
  }

  // ========= Caracteristicas =========
  abrirConfigurarFeature(): void {
    this.mostrarConfigurarFeature = true;
    this.orgCaractRef = this.overlay.open(this.formOrgCaractTpl)
  }
  cerrarConfigurarFeature(): void {
    this.mostrarConfigurarFeature = false;
    this.orgCaractRef?.close();
    this.orgCaractRef = undefined;
    this.loadAllFeatures();
  }

  volverInventario(): void {
    this.router.navigate([`/view/categoria`]);
  }
}
