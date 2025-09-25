import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatGridListModule } from '@angular/material/grid-list';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { MarcasComponent } from "./marcas/marcas.component";
import { MatSelectModule } from "@angular/material/select";

@Component({
  selector: 'app-producto',
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,
    MatInputModule,
    MatGridListModule,
    MatButtonModule,
    MarcasComponent,
    MatSelectModule
  ],
  templateUrl: './producto.component.html',
  styleUrls: ['./producto.component.scss']
})
export class ProductoComponent implements OnInit {
  /* ==================== PROPIEDADES ==================== */
  productos: any[] = [];
  marcas: any[] = [];

  formData = {
    name: '',
    price: 0,
    category: null as number | null,
    brand: null as number | null,
    disabled: false,
    idImage: null as number | null
  };

  selectedProducto: any = null;
  imagenesCache: { [id: number]: string } = {};
  marcaMap: { [id: number]: string } = {};

  imagePreview: string | null = null;
  selectedFile: File | null = null;
  nombreArchivo: string | null = null;

  mostrarFormulario = false;
  filtro: string = '';
  tipoFiltro: string = 'nombre';
  isLoading = false;

  categoriaId: number | null = null;
  categoriaNombre: string = '';

  mostrarFormularioMarca = false;
  mostrarFormularioCrearMarca = false;
  mostrarMasOpciones = false;

  constructor(private apiService: ApiService, private toastService: ToastService, private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const nombreCategoria = params.get('nombreCategoria');
      if (nombreCategoria) {
        this.categoriaNombre = decodeURIComponent(nombreCategoria);
        this.loadCategoriaYProductos(this.categoriaNombre);
      }
    });
  }

  /* ==================== GETTERS ==================== */
  get estaEditando(): boolean {
    return !!this.selectedProducto;
  }

  /* ==================== CARGA DE DATOS ==================== */
  loadCategoriaYProductos(nombre: string): void {
    this.apiService.getCategoriaByNombre(nombre).subscribe({
      next: (categoria: any) => {
        this.categoriaId = categoria.idCategory;
        this.loadProductosPorCategoria(this.categoriaId!);
        this.loadMarcasPorCategoria(this.categoriaId!);
      },
      error: () => {
        this.toastService.mostrarMensaje('❌ No se encontró la categoría');
      }
    });
  }

  loadProductosPorCategoria(idCategory: number): void {
    this.apiService.getProductos().subscribe(data => {
      // Filtrar usando product.category.idCategory
      this.productos = data
        .filter((p: any) => !p.disabled && p.category?.idCategory === idCategory)
        .map((p: any) => ({
          ...p,
          brand: p.brand ? p.brand : null
        }));

      this.productos.forEach(p => {
        if (p.idImage) this.loadImagen(p.idImage);
      });
    });
  }

  loadMarcasPorCategoria(idCategory: number): void {
    this.apiService.getMarcas().subscribe(data => {
      this.marcas = data.filter((m: any) => m.category === idCategory);
      this.marcaMap = {};
      this.marcas.forEach(m => this.marcaMap[m.idBrand] = m.name);
    });
  }

  /* ==================== FILTRO ==================== */
  filtrarProductos(): any[] {
    const filtroLower = this.filtro.toLowerCase();
    if (!this.filtro.trim()) return this.productos;

    return this.productos.filter(p => {
      const nombreProducto = p.name?.toLowerCase() || '';
      const nombreMarca = p.brand?.name?.toLowerCase() || '';

      if (this.tipoFiltro === 'nombre') return nombreProducto.includes(filtroLower);
      if (this.tipoFiltro === 'marca') return nombreMarca.includes(filtroLower);
      return false;
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
  async crearProducto(): Promise<void> {
    const name = this.formData.name.trim();
    if (!name || this.formData.price <= 0 || !this.categoriaId) {
      return this.toastService.mostrarMensaje('❌ Complete los campos requeridos');
    }

    this.isLoading = true;
    try {
      let idImage: number | null = null;

      if (this.selectedFile) {
        const res = await this.apiService.uploadImage(
          this.selectedFile,
          name,
          'producto',
          this.categoriaId.toString()
        ).toPromise();
        idImage = res.idImage;
        if (idImage) this.imagenesCache[idImage] = `${res.url}?t=${Date.now()}`;
      }

      await this.apiService.createProducto({
        name: this.formData.name,
        price: this.formData.price,
        category: { idCategory: this.categoriaId }, // enviar como objeto
        brand: this.formData.brand ? { idBrand: this.formData.brand } : null,
        idImage,
        disabled: false
      }).toPromise();

      this.toastService.mostrarMensaje('✅ Producto creado correctamente');
      this.cerrarFormulario();
      this.loadProductosPorCategoria(this.categoriaId);
    } catch {
      this.toastService.mostrarMensaje('❌ Error al crear producto');
    } finally {
      this.isLoading = false;
    }
  }

  async actualizarProducto(): Promise<void> {
    const name = this.formData.name?.trim();
    if (!name || !this.selectedProducto || !this.categoriaId) {
      return this.toastService.mostrarMensaje('❌ Complete los campos requeridos');
    }
    if (this.formData.price <= 0) {
      this.toastService.mostrarMensaje('⚠️ El precio debe ser mayor a 0');
      return;
    }

    this.isLoading = true;
    try {
      let idImage: number | null = this.selectedProducto.idImage ?? null;

      if (this.selectedFile) {
        if (idImage) {
          const res = await this.apiService.updateImagen(
            idImage,
            this.selectedFile,
            name,
            'producto',
            this.categoriaId.toString()
          ).toPromise();
          this.imagenesCache[idImage] = `${res.url}?t=${Date.now()}`;
        } else {
          const res = await this.apiService.uploadImage(
            this.selectedFile,
            name,
            'producto',
            this.categoriaId.toString()
          ).toPromise();
          idImage = res.idImage;
          if (idImage) this.imagenesCache[idImage] = `${res.url}?t=${Date.now()}`;
        }
      }

      await this.apiService.updateProducto(this.selectedProducto.idProduct, {
        name: this.formData.name,
        price: this.formData.price,
        category: { idCategory: this.categoriaId }, // enviar como objeto
        brand: this.formData.brand ? { idBrand: this.formData.brand } : null,
        idImage,
        disabled: false
      }).toPromise();

      this.toastService.mostrarMensaje('✅ Producto actualizado correctamente');
      this.cerrarFormulario();
      this.loadProductosPorCategoria(this.categoriaId);
    } catch {
      this.toastService.mostrarMensaje('❌ Error al actualizar producto');
    } finally {
      this.isLoading = false;
    }
  }

  guardarProducto(): void {
    this.estaEditando ? this.actualizarProducto() : this.crearProducto();
  }

  /* ==================== FORMULARIO ==================== */
  abrirFormulario(producto: any = null): void {
    this.selectedProducto = producto;

    this.formData = {
      name: producto?.name || '',
      price: producto?.price || 0,
      category: this.categoriaId,
      brand: producto?.brand?.idBrand || null,
      idImage: producto?.idImage ?? null,
      disabled: false
    };

    this.resetImageSelection();
    this.mostrarFormulario = true;
    this.mostrarMasOpciones = this.formData.brand != null;
    document.body.style.overflow = 'hidden';
  }

  cerrarFormulario(): void {
    this.resetForm();
    this.mostrarFormulario = false;
    this.mostrarMasOpciones = false;
    document.body.style.overflow = 'auto';
  }

  resetForm(): void {
    this.formData = {
      name: '',
      price: 0,
      category: null,
      brand: null,
      disabled: false,
      idImage: null
    };
    this.selectedProducto = null;
    this.mostrarMasOpciones = false;
  }

  editProducto(producto: any): void {
    this.abrirFormulario(producto);
  }

  abrirFormularioMarca(): void {
    this.mostrarFormularioMarca = true;
    if (this.categoriaId) this.loadMarcasPorCategoria(this.categoriaId);
  }

  abrirFormularioCrearMarca(): void {
    this.mostrarFormularioCrearMarca = true;
  }

  abrirFormularioMarcaDesdeSelect(): void {
    this.mostrarFormularioMarca = true;
  }

  cerrarFormularioCrearMarca(): void {
    this.mostrarFormularioCrearMarca = false;
  }

  cerrarFormularioMarca(): void {
    this.mostrarFormularioMarca = false;
  }

  /* ==================== UTILIDADES ==================== */
  deshabilitar(idProduct: number): void {
    if (!confirm('¿Seguro que deseas deshabilitar este producto?')) return;
    this.apiService.getProductoById(idProduct).subscribe(producto => {
      producto.disabled = true;
      this.apiService.updateProducto(idProduct, producto).subscribe(
        () => {
          this.toastService.mostrarMensaje('✅ Producto deshabilitado correctamente');
          if (this.categoriaId) this.loadProductosPorCategoria(this.categoriaId);
        },
        () => this.toastService.mostrarMensaje('❌ Error al deshabilitar producto')
      );
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