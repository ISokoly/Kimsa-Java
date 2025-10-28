import { ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';

import { ApiService } from '../../core/services/api.service';
import { HoverScrollDirective } from '../../core/extras/hover-scroll.directive';
import { OverlayPortalService, OverlayHandle } from '../../core/services/overlay-portal.service';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../core/services/toast.service';
import { PageLoadingService } from '../../core/services/page-loading.service';
import { catchError, firstValueFrom, forkJoin, map, of } from 'rxjs';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [
    FormsModule, RouterModule,
    MatInputModule, MatGridListModule, MatButtonModule, MatSelectModule,
    MatOptionModule, MatTableModule,
    HoverScrollDirective, MatIconModule
  ],
  templateUrl: './categorias.component.html',
  styleUrls: ['./categorias.component.scss']
})
export class CategoriasComponent implements OnInit {
  categorias: any[] = [];
  imagenesCache: Record<number, string> = {};
  marcaMap: Record<number, string> = {};
  imgLoaded: Record<number, boolean> = {};
  private cd = inject(ChangeDetectorRef);

  formData = { name: '', description: '', idImage: null as number | null, disabled: false };

  selectedCategoria: any = null;
  imagePreview: string | null = null;
  selectedFile: File | null = null;
  caracteresRestantes = 100;
  nombreArchivo: string | null = null;
  isLoading = false;
  contentReady = false;

  @ViewChild('formCategoriaTpl') formCategoriaTpl!: TemplateRef<any>;
  @ViewChild('categoryDetailTpl') categoryDetailTpl!: TemplateRef<any>;

  private overlay = inject(OverlayPortalService);
  private formCategoriaRef?: OverlayHandle;
  private categoryDetailRef?: OverlayHandle;

  displayedInfoColumns: string[] = ['prop', 'value'];
  get CategoryInfoRows() {
    const c = this.selectedCategoria;
    if (!c) return [];
    return [
      { prop: 'Nombre', value: c.name },
      { prop: 'Descripción', value: c.description || '—' },
      { prop: 'Estado', value: c.disabled ? 'Deshabilitado' : 'Habilitado' }
    ];
  }

  constructor(private router: Router, private apiService: ApiService, private toastService: ToastService, private pageLoading: PageLoadingService) { }

  async ngOnInit(): Promise<void> {
    this.pageLoading.start();
    try {
      await this.loadCategoriasYImagenes();
      this.contentReady = true;
    } finally {
      this.pageLoading.stop();
    }
  }

  /* === Datos === */
  private async loadCategoriasYImagenes(): Promise<void> {
    const data = await firstValueFrom(this.apiService.getCategorias());
    this.categorias = (data || []).filter((c: any) => !c.disabled);

    const ids = this.categorias
      .map(c => c.idImage)
      .filter((id): id is number => !!id && !this.imagenesCache[id]);

    if (ids.length) {
      const results = await firstValueFrom(
        forkJoin(ids.map(id =>
          this.apiService.getImagenById(id).pipe(
            map((res: any) => ({ id, url: `${res.url}?t=${Date.now()}` })),
            catchError(() => of({ id, url: '/img/no-image.png' }))
          )
        ))
      );
      for (const { id, url } of results) this.imagenesCache[id] = url;
    }

    if (this.categoryDetailRef && this.selectedCategoria) {
      this.rebindSelectedCategoria();
    }
  }

  getUrlImagen(idImage?: number | null): string {
    return idImage ? (this.imagenesCache[idImage] || '/img/no-image.png') : '/img/no-image.png';
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return this.resetImageSelection();
    if (file.size > 1024 * 1024) {
      this.toastService.mostrarMensaje('❌ La imagen no puede ser mayor a 1 MB.');
      return this.resetImageSelection();
    }
    this.selectedFile = file;
    this.nombreArchivo = file.name;
  }

  resetImageSelection() { this.selectedFile = null; this.nombreArchivo = null; }

  onImageError(event: Event) {
    (event.target as HTMLImageElement).src = '/img/no-image.png';
  }

  /* === Formularios con Overlay === */
  abrirFormulario(categoria: any = null): void {
    this.selectedCategoria = categoria;
    this.formData = {
      name: categoria?.name ?? '',
      description: categoria?.description ?? '',
      idImage: categoria?.idImage ?? null,
      disabled: categoria?.disabled ?? false
    };
    this.formCategoriaRef = this.overlay.open(this.formCategoriaTpl);
  }

  cerrarFormulario(): void {
    this.formCategoriaRef?.close();
    this.formCategoriaRef = undefined;
    this.resetForm();
  }

  openCategoryDetail(cat: any): void {
    this.selectedCategoria = { ...cat };
    this.categoryDetailRef?.close();
    this.categoryDetailRef = this.overlay.open(this.categoryDetailTpl);
    this.cd.detectChanges();
  }

  closeCategoryDetail(): void {
    this.categoryDetailRef?.close();
    this.categoryDetailRef = undefined;
  }

  resetForm() { this.formData = { name: '', description: '', idImage: null, disabled: false }; }

  async crearCategoria(): Promise<void> {
    const name = this.formData.name.trim();
    if (!name) return this.toastService.mostrarMensaje('❌ El nombre de la categoría no puede estar vacío.');
    this.isLoading = true;
    try {
      const categorias = await this.apiService.getCategorias().toPromise();
      if (categorias.some((cat: any) => cat.name.toLowerCase() === name.toLowerCase())) {
        return this.toastService.mostrarMensaje('❌ Ya existe una categoría con este nombre.');
      }
      let idImage: number | null = null;
      if (this.selectedFile) {
        const res = await this.apiService.uploadImage(this.selectedFile, name, 'categoria', '').toPromise();
        idImage = res.idImage;
        if (idImage) this.imagenesCache[idImage] = `${res.url}?t=${Date.now()}`;
      }
      await this.apiService.createCategoria({ name, description: this.formData.description, idImage }).toPromise();
      this.toastService.mostrarMensaje('✅ Categoría creada correctamente');
      this.cerrarFormulario();
      this.loadCategoriasYImagenes();
    } catch {
      this.toastService.mostrarMensaje('❌ Error al crear la categoría');
    } finally { this.isLoading = false; }
  }

  async actualizarCategoria(): Promise<void> {
    const name = this.formData.name?.trim() || '';
    const description = this.formData.description?.trim() || '';
    if (!name || !this.selectedCategoria) return this.toastService.mostrarMensaje('❌ El nombre no puede estar vacío.');
    this.isLoading = true;
    try {
      const categorias = await this.apiService.getCategorias().toPromise();
      if (categorias.some((cat: any) => cat.name.toLowerCase() === name.toLowerCase() &&
        cat.idCategory !== this.selectedCategoria.idCategory)) {
        return this.toastService.mostrarMensaje('❌ Ya existe otra categoría con este nombre.');
      }
      let idImage: number | null = this.selectedCategoria.idImage ?? null;
      if (this.selectedFile) {
        if (idImage) {
          const res = await this.apiService.updateImagen(idImage, this.selectedFile, name, 'categoria', '').toPromise();
          this.imagenesCache[idImage] = `${res.url}?t=${Date.now()}`;
        } else {
          const res = await this.apiService.uploadImage(this.selectedFile, name, 'categoria', '').toPromise();
          idImage = res.idImage;
          if (idImage) this.imagenesCache[idImage] = `${res.url}?t=${Date.now()}`;
        }
      }
      await this.apiService.updateCategoria(this.selectedCategoria.idCategory, { name, description, idImage }).toPromise();
      this.toastService.mostrarMensaje('✅ Categoría actualizada correctamente');
      this.cerrarFormulario();
      this.loadCategoriasYImagenes();
    } catch {
      this.toastService.mostrarMensaje('❌ Error al actualizar la categoría');
    } finally { this.isLoading = false; }
  }

  deshabilitar(id: number): void {
    if (!confirm('¿Seguro que deseas deshabilitar esta categoría?')) return;
    this.apiService.disableCategoriaYProductos(id).subscribe({
      next: () => { this.toastService.mostrarMensaje('✅ Categoría deshabilitada'); this.loadCategoriasYImagenes(); this.closeCategoryDetail(); },
      error: () => this.toastService.mostrarMensaje('❌ Error al deshabilitar')
    });
  }

  habilitar(id: number): void {
    this.apiService.updateCategoria(id, { disabled: false }).subscribe({
      next: () => { this.toastService.mostrarMensaje('✅ Categoría habilitada'); this.loadCategoriasYImagenes(); this.closeCategoryDetail(); },
      error: () => this.toastService.mostrarMensaje('❌ Error al habilitar')
    });
  }

  verProductos(nombre: string) {
    this.router.navigate([`/view/categoria/producto/${encodeURIComponent(nombre)}`]);
  }

  private rebindSelectedCategoria(): void {
    const id = this.selectedCategoria?.idCategory;
    if (!id) return;

    const fresh = this.categorias.find(c => c.idCategory === id);
    if (fresh) {
      this.selectedCategoria = { ...fresh };
    }
    this.cd.detectChanges();
  }

  limitarCaracteres() {
    if (this.formData.description.length > 100)
      this.formData.description = this.formData.description.slice(0, 100);
    this.caracteresRestantes = 100 - this.formData.description.length;
  }
}
