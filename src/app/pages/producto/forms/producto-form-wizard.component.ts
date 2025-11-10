// oxlint-disable no-unused-expressions
import { CommonModule, NgClass } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';

import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { firstValueFrom } from 'rxjs';

type Brand = { idBrand: number; name: string };
type Feature = { idFeature: number; featureName: string };
type Supply = { idSupply: number; name: string; unit?: string };

@Component({
  selector: 'app-producto-form-wizard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NgClass,
    MatButtonModule, MatDividerModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatSelectModule, MatCardModule
  ],
  templateUrl: './producto-form-wizard.component.html',
  styleUrls: ['./producto-form-wizard.component.scss']
})
export class ProductoFormWizardComponent implements OnInit {

  /* ===== Inputs ===== */
  @Input() categoriaId!: number;   // requerido
  @Input() marcas: Brand[] = [];
  @Input() supplies: Supply[] = [];
  @Input() productoEditar: any | null = null; // { idProduct, name, price, brand?, ... }

  /* ===== Outputs ===== */
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();   // crear/actualizar OK → padre refresca y cierra

  /* ===== Paso 1: básicos ===== */
  formData = {
    name: '',
    price: 0,
    brand: null as number | null,
  };
  mostrarMasOpciones = false;

  /* Imagen */
  selectedFile: File | null = null;
  nombreArchivo: string | null = null;
  imagePreview: string | null = null;

  /* ===== Wizard ===== */
  formStep: 1 | 2 = 1;
  isLoading = false;

  /* ===== Paso 2: características (borrador) ===== */
  featuresBase: Feature[] = [];
  draftFeatures: Array<{ idFeature: number; featureName: string; featureValue: string }> = [];
  newFeature = { idFeature: null as number | null, featureValue: '' };

  /* ===== Paso 2: receta (borrador) ===== */
  suppliesMap = new Map<number, Supply>();
  draftRecipe: Array<{ idSupply: number; name: string; gramsQuantity: number; unit?: string }> = [];
  newRecetaItem = { idSupply: null as number | null, gramsQuantity: 0 };

  /* ===== Para diff de características en edición ===== */
  private existingPF: Array<{ idProductFeature: number; idFeature: number; featureName: string; featureValue: string }> = [];

  /* ===== Para actualización de receta ===== */
  private existingRecipeId: number | null = null; // si existe, hacemos PUT; si no, POST

  constructor(private api: ApiService, private toast: ToastService) { }

  async ngOnInit(): Promise<void> {
    if (!this.categoriaId) {
      this.toast.mostrarMensaje('❌ Falta categoría.');
      this.close();
      return;
    }

    // Cargar catálogo de características base
    try {
      const raw = await firstValueFrom(this.api.getFeatures()) as any[];
      this.featuresBase = (raw || []).map(f => ({
        idFeature: Number(f.idFeature),
        featureName: String(f.featureName || '')
      }));
    } catch {
      this.featuresBase = [];
    }

    // mapa de insumos
    this.suppliesMap.clear();
    for (const s of (this.supplies || [])) this.suppliesMap.set(Number(s.idSupply), s);

    // Modo edición: precargar
    if (this.productoEditar) {
      this.formData.name = this.productoEditar.name;
      this.formData.price = this.productoEditar.price;
      this.formData.brand = this.productoEditar.brand?.idBrand ?? null;
      await this.loadExistingProductDetails(this.productoEditar.idProduct);
      // en edición podemos ir directo al paso 2 si quieres, pero lo dejo en 1
    }
  }

  /* ===== Navegación ===== */
  private requireCamposBasicos(): boolean {
    const ok = !!this.formData.name?.trim() && this.formData.price > 0 && !!this.categoriaId;
    if (!ok) this.toast.mostrarMensaje('❌ Complete los campos requeridos');
    return ok;
  }
  goStep2(): void { if (this.requireCamposBasicos()) this.formStep = 2; }
  backStep1(): void { this.formStep = 1; }

  /* ===== Imagen ===== */
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

  /* ===== Helpers ===== */
  private lower(s: any) { return String(s ?? '').trim().toLowerCase(); }

  unitLabel(unit?: string): string {
    const map: Record<string, string> = { Grams: 'g', Milliliters: 'ml', Units: 'u' };
    return unit ? (map[unit] ?? unit) : '';
  }
  unitLabelBySupply(idSupply: number | null): string {
    if (!idSupply) return '';
    const s = this.suppliesMap.get(Number(idSupply));
    return s ? this.unitLabel(s.unit) : '';
  }

  /* ===== Características (draft) ===== */
  addDraftFeature(): void {
    if (!this.newFeature.idFeature || !this.newFeature.featureValue.trim()) {
      this.toast.mostrarMensaje('⚠️ Selecciona una característica y escribe un valor.');
      return;
    }
    const base = this.featuresBase.find(f => f.idFeature === this.newFeature.idFeature);
    if (!base) { this.toast.mostrarMensaje('❌ Característica base inválida.'); return; }

    // si ya existe misma base en draft, la reemplazamos (para simplificar edición local)
    const idx = this.draftFeatures.findIndex(x => x.idFeature === base.idFeature);
    const item = { idFeature: base.idFeature, featureName: base.featureName, featureValue: this.newFeature.featureValue.trim() };
    if (idx >= 0) this.draftFeatures[idx] = item;
    else this.draftFeatures = [...this.draftFeatures, item];

    this.newFeature = { idFeature: null, featureValue: '' };
  }
  removeDraftFeature(f: { idFeature: number; featureName: string; featureValue: string }): void {
    this.draftFeatures = this.draftFeatures.filter(x => x.idFeature !== f.idFeature);
  }

  /* ===== Receta (draft) ===== */
  get canAddReceta(): boolean {
    return typeof this.newRecetaItem.idSupply === 'number' && (Number(this.newRecetaItem.gramsQuantity) || 0) > 0;
  }
  clampNewGrams(): void {
    const g = Math.max(0.01, Number(this.newRecetaItem.gramsQuantity) || 0.01);
    this.newRecetaItem.gramsQuantity = Math.round((g + Number.EPSILON) * 100) / 100;
  }
  addRecetaItem(): void {
    if (!this.canAddReceta) {
      this.toast.mostrarMensaje('⚠️ Selecciona insumo y cantidad > 0');
      return;
    }
    const s = this.suppliesMap.get(Number(this.newRecetaItem.idSupply));
    if (!s) { this.toast.mostrarMensaje('❌ Insumo inválido'); return; }

    const exists = this.draftRecipe.find(d => d.idSupply === s.idSupply);
    const qty = Math.round((Math.max(0.01, Number(this.newRecetaItem.gramsQuantity) || 0) + Number.EPSILON) * 100) / 100;
    if (exists) {
      exists.gramsQuantity = Math.round((exists.gramsQuantity + qty + Number.EPSILON) * 100) / 100;
    } else {
      this.draftRecipe = [...this.draftRecipe, { idSupply: s.idSupply, name: s.name, gramsQuantity: qty, unit: s.unit }];
    }
    this.newRecetaItem = { idSupply: null, gramsQuantity: 0 };
  }
  removeRecetaItem(it: any): void {
    this.draftRecipe = this.draftRecipe.filter(x => x !== it);
  }
  clampItemGrams(it: any): void {
    const g = Math.max(0.01, Number(it.gramsQuantity) || 0.01);
    it.gramsQuantity = Math.round((g + Number.EPSILON) * 100) / 100;
  }

  /* ===== Imagen ===== */
  private async ensureImagen(file: File | null, nombre: string, categoriaId: number, currentIdImage: number | null): Promise<number | null> {
    if (!file) return currentIdImage;
    const res = await firstValueFrom(this.api.uploadImage(file, nombre, 'producto', String(categoriaId))) as any;
    const imgId = res?.idImage ?? res?.id ?? null;
    return imgId ?? null;
  }

  /* ===== Validación para finalizar ===== */
  canFinish(): boolean {
    const basicsOk = this.requireCamposBasicos();
    return basicsOk && this.draftFeatures.length > 0 && this.draftRecipe.length > 0;
  }

  /* ===== Crear/Actualizar todo ===== */
  async finish(): Promise<void> {
    if (!this.canFinish()) {
      this.toast.mostrarMensaje('⚠️ Completa datos, al menos 1 característica y 1 insumo en la receta.');
      return;
    }

    this.isLoading = true;
    try {
      const name = this.formData.name.trim();
      const productos = await this.api.getProductos().toPromise();

      if (this.productoEditar) {
        // === ACTUALIZAR ===
        const idProduct = Number(this.productoEditar.idProduct);
        const currentName = this.lower(this.productoEditar.name);
        const newName = this.lower(name);

        // Permitir mismo nombre (mismo producto); si cambia, validar contra otros
        if (newName !== currentName) {
          const conflict = (productos || []).some((p: any) =>
            this.lower(p.name) === newName && Number(p.idProduct) !== idProduct
          );
          if (conflict) {
            this.isLoading = false;
            return this.toast.mostrarMensaje('❌ Ya existe un producto con este nombre.');
          }
        }

        // Imagen: si subiste una nueva, súbela; si no, conserva la actual
        const idImage = await this.ensureImagen(this.selectedFile, name, this.categoriaId, this.productoEditar.idImage ?? null);

        // 1) UPDATE PRODUCTO
        await firstValueFrom(this.api.updateProducto(idProduct, {
          name,
          price: this.formData.price,
          category: { idCategory: this.categoriaId },
          brand: this.formData.brand ? { idBrand: this.formData.brand } : null,
          idImage,
          disabled: false
        }));

        // 2) UPSERT CARACTERÍSTICAS
        //    necesitamos la lista actual (this.existingPF) y la draft (this.draftFeatures)
        const existingByFeature = new Map<number, { idProductFeature: number; value: string }>();
        for (const pf of this.existingPF) {
          existingByFeature.set(pf.idFeature, { idProductFeature: pf.idProductFeature, value: pf.featureValue });
        }

        // a) crear/actualizar presentes en draft
        for (const d of this.draftFeatures) {
          const already = existingByFeature.get(d.idFeature);
          if (already) {
            // actualizar si cambió el valor
            if (this.lower(already.value) !== this.lower(d.featureValue)) {
              await firstValueFrom(this.api.updateProductFeature(already.idProductFeature, {
                featureValue: d.featureValue,
                product: { idProduct },
                feature: { idFeature: d.idFeature }
              }));
            }
            existingByFeature.delete(d.idFeature); // marcado como atendido
          } else {
            // crear
            await firstValueFrom(this.api.createProductFeature({
              featureValue: d.featureValue,
              product: { idProduct },
              feature: { idFeature: d.idFeature }
            }));
          }
        }

        // b) los que quedaron en existingByFeature no están en draft → eliminar
        for (const leftover of existingByFeature.values()) {
          await firstValueFrom(this.api.deleteProductFeature(leftover.idProductFeature));
        }

        // 3) UPSERT RECETA
        //    Si existe receta → PUT /recipes/{id}
        //    Si no → POST /recipes
        const items = this.draftRecipe.map(d => ({ idSupply: d.idSupply, gramsQuantity: d.gramsQuantity }));
        if (this.existingRecipeId) {
          await firstValueFrom(this.api.updateRecipe(this.existingRecipeId, { idProduct, items }));
        } else {
          await firstValueFrom(this.api.createRecipe({ idProduct, items }));
        }

        this.toast.mostrarMensaje('✅ Producto actualizado con características y receta');
        this.created.emit();

      } else {
        // === CREAR ===
        const conflict = (productos || []).some((p: any) => this.lower(p.name) === this.lower(name));
        if (conflict) {
          this.isLoading = false;
          return this.toast.mostrarMensaje('❌ Ya existe un producto con este nombre.');
        }

        const idImage = await this.ensureImagen(this.selectedFile, name, this.categoriaId, null);

        // 1) CREAR PRODUCTO
        const created: any = await firstValueFrom(this.api.createProducto({
          name,
          price: this.formData.price,
          category: { idCategory: this.categoriaId },
          brand: this.formData.brand ? { idBrand: this.formData.brand } : null,
          idImage,
          disabled: false
        }));
        const idProduct = Number(created?.idProduct ?? created?.id);
        if (!Number.isFinite(idProduct)) throw new Error('No se obtuvo idProduct');

        // 2) CREAR CARACTERÍSTICAS
        for (const pf of this.draftFeatures) {
          await firstValueFrom(this.api.createProductFeature({
            featureValue: pf.featureValue,
            product: { idProduct },
            feature: { idFeature: pf.idFeature }
          }));
        }

        // 3) CREAR RECETA
        await firstValueFrom(this.api.createRecipe({
          idProduct,
          items: this.draftRecipe.map(d => ({ idSupply: d.idSupply, gramsQuantity: d.gramsQuantity }))
        }));

        this.toast.mostrarMensaje('✅ Producto, características y receta creados correctamente');
        this.created.emit();
      }
    } catch (e) {
      console.error(e);
      this.toast.mostrarMensaje('❌ Error al guardar el producto y su configuración');
    } finally {
      this.isLoading = false;
    }
  }

  /* ===== Precarga para modo edición ===== */
  private async loadExistingProductDetails(idProduct: number): Promise<void> {
    try {
      const [features, recipeSummaryOrId, recipeDetails] = await Promise.all([
        firstValueFrom(this.api.getProductFeaturesByProduct(idProduct)),
        // intenta obtener resumen (con idRecipe) si tu API lo tiene; si no, déjalo en null
        // puedes implementar getRecipeByProduct(id) que devuelva { idRecipe, ... }
        this.api.getRecipeByProduct ? firstValueFrom(this.api.getRecipeByProduct(idProduct)) : Promise.resolve(null as any),
        // los detalles para poblar cantidades
        firstValueFrom(this.api.getRecipeDetailsByProduct(idProduct)) // ← array de detalles
      ]);

      // mapear características existentes (para diff posterior)
      this.existingPF = (features || []).map((f: any) => ({
        idProductFeature: Number(f.idProductFeature),
        idFeature: Number(f.feature?.idFeature ?? f.idFeature),
        featureName: String(f.feature?.featureName ?? ''),
        featureValue: String(f.featureValue ?? '')
      }));

      // draft desde existentes (UI)
      this.draftFeatures = this.existingPF.map(x => ({
        idFeature: x.idFeature,
        featureName: x.featureName,
        featureValue: x.featureValue
      }));

      // id recipe si vino
      this.existingRecipeId = recipeSummaryOrId?.idRecipe ?? null;

      // detalles receta (array)
      const detailsArray = Array.isArray(recipeDetails) ? recipeDetails : [];
      this.draftRecipe = detailsArray.map((d: any) => {
        const idSupply = d.supply?.idSupply ?? d.idSupply;
        const s = this.suppliesMap.get(Number(idSupply));
        return {
          idSupply,
          name: s?.name ?? d.supply?.name ?? `#${idSupply}`,
          gramsQuantity: Math.max(0.01, Number(d.gramsQuantity) || 0),
          unit: s?.unit ?? d.supply?.unit ?? ''
        };
      });
    } catch (err) {
      console.error('Error cargando datos del producto', err);
      this.existingPF = [];
      this.draftFeatures = [];
      this.existingRecipeId = null;
      this.draftRecipe = [];
    }
  }

  /* ===== Cerrar ===== */
  close(): void { this.closed.emit(); }
}
