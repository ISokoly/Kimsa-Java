import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { HoverScrollDirective } from '../../core/extras/hover-scroll.directive';
import { MarcasComponent } from '../producto/forms/marcas/marcas.component';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,
    MatInputModule,
    MatGridListModule,
    MatButtonModule,
    MatSelectModule,
    MatOptionModule,
    HoverScrollDirective,
    MarcasComponent
  ],
  templateUrl: './categorias.component.html',
  styleUrls: ['./categorias.component.scss']
})
export class CategoriasComponent implements OnInit {
  /* ==================== PROPIEDADES ==================== */
  categorias: any[] = [];
  marcas: any[] = [];
  imagenesCache: { [id: number]: string } = {};
  marcaMap: { [id: number]: string } = {};

  formData = { name: '', description: '', idImage: null as number | null, disabled: false };
  formDataProducts = { name: '', price: 0, category: null as number | null, brand: null as number | null, disabled: false, idImage: null as number | null };
  selectedCategoria: any = null;
  imagePreview: string | null = null;
  selectedFile: File | null = null;
  caracteresRestantes = 100;
  mostrarFormulario = false;
  mostrarFormularioProducto = false;
  nombreArchivo: string | null = null;
  isLoading = false;

  mostrarFormularioMarca = false;
  mostrarFormularioCrearMarca = false;
  mostrarMasOpciones = false;

  constructor(private router: Router, public apiService: ApiService, private toastService: ToastService) { }

  ngOnInit(): void {
    this.loadCategorias();
    this.loadMarcasPorCategoria(this.formDataProducts.category);
  }

  /* ==================== CARGA DE DATOS ==================== */
  loadCategorias(): void {
    this.apiService.getCategorias().subscribe(data => {
      this.categorias = data.filter((cat: any) => !cat.disabled);
      this.categorias.forEach(cat => {
        if (cat.idImage && !this.imagenesCache[cat.idImage]) {
          this.loadImagen(cat.idImage);
        }
      });
    });
  }

  loadMarcasPorCategoria(categoryId: number | null): void {
    if (!categoryId) {
      this.marcas = [];
      this.marcaMap = {};
      return;
    }
    this.apiService.getMarcas().subscribe(data => {
      this.marcas = data.filter((m: any) => m.category === categoryId);
      this.marcaMap = {};
      this.marcas.forEach(m => this.marcaMap[m.idBrand] = m.name);
    });
  }

  /* ==================== IMAGENES ==================== */
  loadImagen(idImage: number) {
    this.apiService.getImagenById(idImage).subscribe({
      next: res => this.imagenesCache[idImage] = `${res.url}?t=${Date.now()}`,
      error: () => this.imagenesCache[idImage] = '/img/no-image.png'
    });
  }

  getUrlImagen(idImage: number | null | undefined): string {
    if (!idImage) return '/img/no-image.png';
    return this.imagenesCache[idImage] || '/img/no-image.png';
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    const MAX_SIZE_MB = 1;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
    if (file) {
      if (file.size > MAX_SIZE_BYTES) {
        this.toastService.mostrarMensaje(`❌ La imagen no puede ser mayor a ${MAX_SIZE_MB} MB.`);
        this.resetImageSelection();
        return;
      }
      this.selectedFile = file;
      this.nombreArchivo = file.name;
      const reader = new FileReader();
      reader.onload = (e: any) => this.imagePreview = e.target.result;
      reader.readAsDataURL(file);
    } else {
      this.resetImageSelection();
    }
  }

  resetImageSelection() {
    this.selectedFile = null;
    this.imagePreview = null;
    this.nombreArchivo = null;
  }

  onImageError(event: Event) {
    (event.target as HTMLImageElement).src = '/img/no-image.png';
  }

  /* ==================== CREAR / ACTUALIZAR ==================== */
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
      this.loadCategorias();
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
      this.loadCategorias();
    } catch {
      this.toastService.mostrarMensaje('❌ Error al actualizar la categoría');
    } finally { this.isLoading = false; }
  }

  async crearProducto(): Promise<void> {
    const name = this.formDataProducts.name.trim();
    if (!name || this.formDataProducts.price <= 0 || !this.formDataProducts.category) {
      return this.toastService.mostrarMensaje('❌ Complete los campos requeridos');
    }
    this.isLoading = true;
    try {
      let idImage: number | null = null;
      if (this.selectedFile) {
        const res = await this.apiService
          .uploadImage(this.selectedFile, name, 'producto', this.formDataProducts.category.toString())
          .toPromise();
        idImage = res.idImage;
        if (idImage) this.imagenesCache[idImage] = `${res.url}?t=${Date.now()}`;
      }
      await this.apiService.createProducto({
        name,
        price: this.formDataProducts.price,
        category: { idCategory: this.formDataProducts.category },
        brand: this.formDataProducts.brand ? { idBrand: this.formDataProducts.brand } : null,
        idImage,
        disabled: false
      }).toPromise();
      this.toastService.mostrarMensaje('✅ Producto creado correctamente');
      this.cerrarFormularioProducto();
    } catch {
      this.toastService.mostrarMensaje('❌ Error al crear producto');
    } finally { this.isLoading = false; }
  }

  /* ==================== FORMULARIO ==================== */
  abrirFormulario(categoria: any = null): void {
    this.selectedCategoria = categoria;
    this.formData = {
      name: categoria?.name || '',
      description: categoria?.description || '',
      idImage: categoria?.idImage || null,
      disabled: categoria?.disabled || false
    };
    this.caracteresRestantes = 100 - (this.formData.description?.length || 0);
    this.mostrarMasOpciones = !!categoria?.idCategory;
    this.imagePreview = null;
    this.mostrarFormulario = true;
    document.body.style.overflow = 'hidden';
  }

  cerrarFormulario(): void { this.resetForm(); this.mostrarFormulario = false; document.body.style.overflow = 'auto'; }
  resetForm(): void { this.formData = { name: '', description: '', idImage: null, disabled: false }; this.selectedCategoria = null; this.resetImageSelection(); }
  abrirFormularioProducto(categoryId?: number): void {
    this.formDataProducts = { name: '', price: 0, category: categoryId || null, brand: null, idImage: null, disabled: false };
    if (this.formDataProducts.category) this.loadMarcasPorCategoria(this.formDataProducts.category);
    this.imagePreview = null; this.selectedFile = null; this.nombreArchivo = null;
    this.mostrarFormularioProducto = true; document.body.style.overflow = 'hidden';
    this.mostrarMasOpciones = false;
  }
  cerrarFormularioProducto(): void { this.resetFormProducto(); this.mostrarFormularioProducto = false; document.body.style.overflow = 'auto'; }
  resetFormProducto(): void { this.formDataProducts = { name: '', price: 0, category: null, brand: null, idImage: null, disabled: false }; this.resetImageSelection(); }

  abrirFormularioCrearMarca(): void { this.mostrarFormularioCrearMarca = true; }
  abrirFormularioMarcaDesdeSelect(): void { this.mostrarFormularioMarca = true; }
  cerrarFormularioCrearMarca(): void { this.mostrarFormularioCrearMarca = false; }
  cerrarFormularioMarca(): void { this.mostrarFormularioMarca = false; }

  limitarCaracteres(): void {
    if (this.formData.description.length > 100) this.formData.description = this.formData.description.slice(0, 100);
    this.caracteresRestantes = 100 - this.formData.description.length;
  }

  deshabilitar(idCategory: number): void {
    if (!confirm('¿Seguro que deseas deshabilitar esta categoría y todos sus productos?')) return;

    this.apiService.disableCategoriaYProductos(idCategory).subscribe({
      next: () => this.toastService.mostrarMensaje('✅ Categoria y productos deshabilitados correctamente'),
      error: () => this.toastService.mostrarMensaje('❌ Error al deshabilitar la categoría')
    });
  }

  verProductos(nombreCategoria: string) {
    const nombreFormateado = encodeURIComponent(nombreCategoria);
    this.router.navigate([`/view/categoria/producto/${nombreFormateado}`]);
  }

  onCategoriaChange(): void {
    this.loadMarcasPorCategoria(this.formDataProducts.category);
    this.formDataProducts.brand = null;
  }
}
