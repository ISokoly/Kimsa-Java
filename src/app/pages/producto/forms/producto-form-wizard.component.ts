// oxlint-disable no-unused-expressions
import { CommonModule, NgClass } from "@angular/common";
import {
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatCardModule } from "@angular/material/card";
import { MatAutocompleteModule } from "@angular/material/autocomplete";

import { ApiService } from "../../../core/services/api.service";
import { ToastService } from "../../../core/services/toast.service";
import { firstValueFrom } from "rxjs";
import {
  OverlayHandle,
  OverlayPortalService,
} from "../../../core/services/overlay-portal.service";
import { MarcasComponent } from "./marcas/marcas.component";
import { CaracteristicasComponent } from "./caracteristicas/caracteristicas.component";

type Brand = { idBrand: number; name: string; idCategory?: number };
type Feature = { idFeature: number; featureName: string };
type Supply = { idSupply: number; name: string; unit?: string };

@Component({
  selector: "app-producto-form-wizard",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgClass,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatAutocompleteModule,
    MarcasComponent,
    CaracteristicasComponent,
  ],
  templateUrl: "./producto-form-wizard.component.html",
  styleUrls: ["./producto-form-wizard.component.scss"],
})
export class ProductoFormWizardComponent implements OnInit, OnChanges {
  /* ===== Inputs ===== */
  @Input() categoriaId!: number;
  @Input() marcas: Brand[] = []; // si el padre no inyecta, el wizard las cargará
  @Input() supplies: Supply[] = [];
  @Input() productoEditar: any | null = null;

  /* ===== Outputs ===== */
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();
  @Output() marcasChanged = new EventEmitter<void>(); // avisa al padre para refrescar detail
  @Output() updated = new EventEmitter<number>(); // idProduct actualizado/creado

  @ViewChild("featureInput") featureInput!: ElementRef<HTMLInputElement>;
  @ViewChild("supplyInput") supplyInput!: ElementRef<HTMLInputElement>;

  /* ===== Paso 1 ===== */
  formData = {
    name: "",
    price: 0,
    brand: null as number | null,
  };
  mostrarMasOpciones = false;

  /* Imagen */
  selectedFile: File | null = null;
  nombreArchivo: string | null = null;
  imagePreview: string | null = null;

  /* Wizard */
  formStep: 1 | 2 = 1;
  isLoading = false;

  /* Características */
  featuresBase: Feature[] = [];
  draftFeatures: Array<{
    idFeature: number;
    featureName: string;
    featureValue: string;
  }> = [];
  newFeature = { idFeature: null as number | null, featureValue: "" };

  /* Autocomplete Características */
  textoCaracteristica = "";
  caracteristicasFiltradas: Feature[] = [];

  /* Receta */
  suppliesMap = new Map<number, Supply>();
  draftRecipe: Array<{
    idSupply: number;
    name: string;
    gramsQuantity: number;
    unit?: string;
  }> = [];
  newRecetaItem = { idSupply: null as number | null, gramsQuantity: 0 };

  /* Autocomplete Insumos */
  textoInsumo = "";
  insumosFiltrados: Supply[] = [];

  /* Marcas overlay */
  @ViewChild("formCrearMarcaTpl") formCrearMarcaTpl!: TemplateRef<any>;
  private overlay = inject(OverlayPortalService);
  private crearMarcaRef?: OverlayHandle;

  /* Características overlay (solo formulario) */
  @ViewChild("formCrearFeatureTpl") formCrearFeatureTpl!: TemplateRef<any>;
  private crearFeatureRef?: OverlayHandle;

  /* Insumo rápido overlay */
  @ViewChild("formCrearSupplyTpl") formCrearSupplyTpl!: TemplateRef<any>;
  private crearSupplyRef?: OverlayHandle;

  /* Para diff/edición */
  private existingPF: Array<{
    idProductFeature: number;
    idFeature: number;
    featureName: string;
    featureValue: string;
  }> = [];
  private existingRecipeId: number | null = null;

  /* Datos del mini formulario de insumo */
  nuevoInsumo = {
    name: "",
    unitPrice: 0,
    unit: "Units" as string,
  };

  constructor(private api: ApiService, private toast: ToastService) {}

  async ngOnInit(): Promise<void> {
    if (!this.categoriaId) {
      this.toast.mostrarMensaje("❌ Falta categoría.");
      this.cerrar();
      return;
    }

    // Cargar features base
    try {
      const raw = (await firstValueFrom(this.api.getFeatures())) as any[];
      this.featuresBase = (raw || []).map((f) => ({
        idFeature: Number(f.idFeature),
        featureName: String(f.featureName || ""),
      }));
      this.caracteristicasFiltradas = [...this.featuresBase];
    } catch {
      this.featuresBase = [];
      this.caracteristicasFiltradas = [];
    }

    // Mapa de insumos
    this.suppliesMap.clear();
    for (const s of this.supplies || []) {
      this.suppliesMap.set(Number(s.idSupply), s);
    }
    this.insumosFiltrados = [...this.supplies];

    // Si el padre no pasó marcas, las cargamos aquí
    if (!this.marcas?.length) {
      await this.cargarMarcasPorCategoria(this.categoriaId);
    }

    // Modo edición
    if (this.productoEditar) {
      this.formData.name = this.productoEditar.name;
      this.formData.price = this.productoEditar.price;
      this.formData.brand = this.productoEditar.brand?.idBrand ?? null;
      await this.cargarDatosExistentesProducto(this.productoEditar.idProduct);
      this.mostrarMasOpciones = this.formData.brand != null;
    }
  }

  ngOnChanges(): void {
    // Si se limpia productoEditar (modo "crear"), resetea todo
    if (!this.productoEditar) {
      this.restablecerFormulario();
    }
  }

  /* ===== Marcas ===== */
  private async cargarMarcasPorCategoria(idCategory: number): Promise<void> {
    try {
      const all = (await firstValueFrom(this.api.getMarcas())) as Brand[];
      this.marcas = (all || []).filter(
        (m) =>
          Number(
            (m as any).idCategory ??
              (m as any).category ??
              (m as any).id_category
          ) === idCategory
      );
    } catch {
      this.marcas = [];
    }
  }

  abrirFormularioCrearMarca(): void {
    this.crearMarcaRef = this.overlay.open(this.formCrearMarcaTpl);
  }

  async alCerrarOverlayMarcas(): Promise<void> {
    if (this.categoriaId) {
      await this.cargarMarcasPorCategoria(this.categoriaId);
    }

    if (
      this.formData.brand &&
      !this.marcas.some((m) => m.idBrand === this.formData.brand)
    ) {
      this.formData.brand = null;
    }

    this.marcasChanged.emit();
    this.crearMarcaRef?.close();
    this.crearMarcaRef = undefined;
  }

  async alEliminarMarca(idBrand: number): Promise<void> {
    await this.cargarMarcasPorCategoria(this.categoriaId);
    if (this.formData.brand === idBrand) {
      this.formData.brand = null;
      this.mostrarMasOpciones = false;
    }
    this.marcasChanged.emit();
  }

  /* ===== Navegación ===== */
  private requerirCamposBasicos(): boolean {
    const ok =
      !!this.formData.name?.trim() &&
      this.formData.price > 0 &&
      !!this.categoriaId;
    if (!ok) {
      this.toast.mostrarMensaje("❌ Complete los campos requeridos");
    }
    return ok;
  }

  irPaso2(): void {
    if (this.requerirCamposBasicos()) this.formStep = 2;
  }
  volverPaso1(): void {
    this.formStep = 1;
  }

  /* ===== Imagen ===== */
  alSeleccionarArchivo(event: any): void {
    const file: File | undefined = event?.target?.files?.[0];
    const MAX_BYTES = 1 * 1024 * 1024;
    if (!file) return this.reiniciarSeleccionImagen();
    if (file.size > MAX_BYTES) {
      this.toast.mostrarMensaje("❌ La imagen no puede ser mayor a 1 MB.");
      return this.reiniciarSeleccionImagen();
    }
    this.selectedFile = file;
    this.nombreArchivo = file.name;
    const r = new FileReader();
    r.onload = (e: any) => (this.imagePreview = e.target.result);
    r.readAsDataURL(file);
  }

  reiniciarSeleccionImagen(): void {
    this.selectedFile = null;
    this.imagePreview = null;
    this.nombreArchivo = null;
  }

  /* ===== Helpers ===== */
  private minusculas(s: any) {
    return String(s ?? "")
      .trim()
      .toLowerCase();
  }

  etiquetaUnidad(unit?: string): string {
    const map: Record<string, string> = {
      Grams: "g",
      Milliliters: "ml",
      Units: "u",
    };
    return unit ? map[unit] ?? unit : "";
  }

  etiquetaUnidadPorInsumo(idSupply: number | null): string {
    if (!idSupply) return "";
    const s = this.suppliesMap.get(Number(idSupply));
    return s ? this.etiquetaUnidad(s.unit) : "";
  }

  /* ===== Autocomplete: Características ===== */
  alEscribirCaracteristica(): void {
    if (this.newFeature.idFeature !== null) return;
    const q = this.minusculas(this.textoCaracteristica);
    if (!q) {
      this.caracteristicasFiltradas = [...this.featuresBase];
      return;
    }
    this.caracteristicasFiltradas = this.featuresBase.filter((f) =>
      this.minusculas(f.featureName).includes(q)
    );
  }

  alSeleccionarCaracteristica(value: any): void {
    // Opción especial: crear nueva característica
    if (value === "__create_feature__") {
      // Limpiar estado lógico
      this.newFeature.idFeature = null;
      this.textoCaracteristica = "";

      // Limpiar el input real del DOM (por si Angular escribió algo raro)
      if (this.featureInput?.nativeElement) {
        this.featureInput.nativeElement.value = "";
      }

      // Restaurar lista normal
      this.caracteristicasFiltradas = [...this.featuresBase];

      // Abrir el formulario embebido
      this.abrirCrearCaracteristica();
      return;
    }

    // Selección normal
    const f = this.featuresBase.find((x) => x.idFeature === Number(value));
    if (!f) return;

    this.newFeature.idFeature = f.idFeature;
    this.textoCaracteristica = f.featureName;
    this.caracteristicasFiltradas = [f];
  }

  limpiarCaracteristicaSeleccion(): void {
    this.newFeature.idFeature = null;
    this.textoCaracteristica = "";
    this.caracteristicasFiltradas = [...this.featuresBase];
  }

  /* ===== Características (draft) ===== */
  agregarCaracteristicaBorrador(): void {
    if (!this.newFeature.idFeature || !this.newFeature.featureValue.trim()) {
      this.toast.mostrarMensaje(
        "⚠️ Selecciona una característica y escribe un valor."
      );
      return;
    }
    const base = this.featuresBase.find(
      (f) => f.idFeature === this.newFeature.idFeature
    );
    if (!base) {
      this.toast.mostrarMensaje("❌ Característica base inválida.");
      return;
    }

    const idx = this.draftFeatures.findIndex(
      (x) => x.idFeature === base.idFeature
    );
    const item = {
      idFeature: base.idFeature,
      featureName: base.featureName,
      featureValue: this.newFeature.featureValue.trim(),
    };
    if (idx >= 0) this.draftFeatures[idx] = item;
    else this.draftFeatures = [...this.draftFeatures, item];

    this.newFeature = { idFeature: null, featureValue: "" };
    this.textoCaracteristica = "";
    this.caracteristicasFiltradas = [...this.featuresBase];
  }

  eliminarCaracteristicaBorrador(f: {
    idFeature: number;
    featureName: string;
    featureValue: string;
  }): void {
    this.draftFeatures = this.draftFeatures.filter(
      (x) => x.idFeature !== f.idFeature
    );
  }

  editarCaracteristicaBorrador(f: {
    idFeature: number;
    featureName: string;
    featureValue: string;
  }): void {
    this.newFeature = { idFeature: f.idFeature, featureValue: f.featureValue };
    this.textoCaracteristica = f.featureName;
    this.draftFeatures = this.draftFeatures.filter(
      (x) => x.idFeature !== f.idFeature
    );
    this.caracteristicasFiltradas = [...this.featuresBase];
  }

  /* ===== Abrir/Cerrar overlay características ===== */
  abrirCrearCaracteristica(): void {
    this.crearFeatureRef = this.overlay.open(this.formCrearFeatureTpl);
  }

  async alCerrarOverlayFeature(): Promise<void> {
    this.crearFeatureRef?.close();
    this.crearFeatureRef = undefined;

    // recargar características
    try {
      const raw = (await firstValueFrom(this.api.getFeatures())) as any[];
      this.featuresBase = (raw || []).map((f) => ({
        idFeature: Number(f.idFeature),
        featureName: String(f.featureName || ""),
      }));
      this.caracteristicasFiltradas = [...this.featuresBase];
    } catch {
      this.featuresBase = [];
      this.caracteristicasFiltradas = [];
    }
  }

  /* ===== Autocomplete: Insumos ===== */
  alEscribirInsumo(): void {
    if (this.newRecetaItem.idSupply !== null) return;
    const q = this.minusculas(this.textoInsumo);
    if (!q) {
      this.insumosFiltrados = [...this.supplies];
      return;
    }
    this.insumosFiltrados = this.supplies.filter((s) =>
      this.minusculas(s.name).includes(q)
    );
  }

  alSeleccionarInsumo(value: any): void {
    // Opción especial: crear nuevo insumo
    if (value === "__create_supply__") {
      this.newRecetaItem.idSupply = null;
      this.textoInsumo = "";

      if (this.supplyInput?.nativeElement) {
        this.supplyInput.nativeElement.value = "";
      }

      this.insumosFiltrados = [...this.supplies];

      this.abrirCrearInsumo();
      return;
    }

    const s = this.suppliesMap.get(Number(value));
    if (!s) return;

    this.newRecetaItem.idSupply = s.idSupply;
    this.textoInsumo = s.name;
    this.insumosFiltrados = [s];
  }

  limpiarInsumoSeleccion(): void {
    this.newRecetaItem.idSupply = null;
    this.textoInsumo = "";
    this.insumosFiltrados = [...this.supplies];
  }

  /* ===== Receta (draft) ===== */
  get puedeAgregarItemReceta(): boolean {
    return (
      typeof this.newRecetaItem.idSupply === "number" &&
      (Number(this.newRecetaItem.gramsQuantity) || 0) > 0
    );
  }

  ajustarCantidadNueva(): void {
    const g = Math.max(0.01, Number(this.newRecetaItem.gramsQuantity) || 0.01);
    this.newRecetaItem.gramsQuantity =
      Math.round((g + Number.EPSILON) * 100) / 100;
  }

  agregarItemReceta(): void {
    if (!this.puedeAgregarItemReceta) {
      this.toast.mostrarMensaje("⚠️ Selecciona insumo y cantidad > 0");
      return;
    }
    const s = this.suppliesMap.get(Number(this.newRecetaItem.idSupply));
    if (!s) {
      this.toast.mostrarMensaje("❌ Insumo inválido");
      return;
    }

    const exists = this.draftRecipe.find((d) => d.idSupply === s.idSupply);
    const qty =
      Math.round(
        (Math.max(0.01, Number(this.newRecetaItem.gramsQuantity) || 0) +
          Number.EPSILON) *
          100
      ) / 100;

    if (exists) {
      exists.gramsQuantity =
        Math.round((exists.gramsQuantity + qty + Number.EPSILON) * 100) / 100;
    } else {
      this.draftRecipe = [
        ...this.draftRecipe,
        {
          idSupply: s.idSupply,
          name: s.name,
          gramsQuantity: qty,
          unit: s.unit,
        },
      ];
    }

    this.newRecetaItem = { idSupply: null, gramsQuantity: 0 };
    this.textoInsumo = "";
    this.insumosFiltrados = [...this.supplies];
  }

  eliminarItemReceta(it: any): void {
    this.draftRecipe = this.draftRecipe.filter((x) => x !== it);
  }

  ajustarCantidadItem(it: any): void {
    const g = Math.max(0.01, Number(it.gramsQuantity) || 0.01);
    it.gramsQuantity = Math.round((g + Number.EPSILON) * 100) / 100;
  }

  /* ===== Imagen helper ===== */
  private async asegurarImagen(
    file: File | null,
    nombre: string,
    categoriaId: number,
    currentIdImage: number | null
  ): Promise<number | null> {
    if (!file) return currentIdImage;
    const res = (await firstValueFrom(
      this.api.uploadImage(file, nombre, "producto", String(categoriaId))
    )) as any;
    const imgId = res?.idImage ?? res?.id ?? null;
    return imgId ?? null;
  }

  /* ===== Validación ===== */
  puedeFinalizar(): boolean {
    const basicsOk = this.requerirCamposBasicos();
    return (
      basicsOk && this.draftFeatures.length > 0 && this.draftRecipe.length > 0
    );
  }

  private minusculasCmp(s: string) {
    return (s || "").trim().toLowerCase();
  }

  /* ===== Crear/Actualizar producto + features + receta ===== */
  async finalizar(): Promise<void> {
    if (!this.puedeFinalizar()) {
      this.toast.mostrarMensaje(
        "⚠️ Completa datos, al menos 1 característica y 1 insumo en la receta."
      );
      return;
    }
    this.isLoading = true;
    try {
      const name = this.formData.name.trim();
      const productos: any[] = (await this.api
        .getProductos()
        .toPromise()) as any[];

      if (this.productoEditar) {
        // UPDATE
        const idProduct = Number(this.productoEditar.idProduct);
        const currentName = this.minusculasCmp(this.productoEditar.name);
        const newName = this.minusculasCmp(name);
        if (newName !== currentName) {
          const conflict = (productos || []).some(
            (p: any) =>
              this.minusculasCmp(p.name) === newName &&
              Number(p.idProduct) !== idProduct
          );
          if (conflict) {
            this.isLoading = false;
            return this.toast.mostrarMensaje(
              "❌ Ya existe un producto con este nombre."
            );
          }
        }

        const idImage = await this.asegurarImagen(
          this.selectedFile,
          name,
          this.categoriaId,
          this.productoEditar.idImage ?? null
        );

        await firstValueFrom(
          this.api.updateProducto(idProduct, {
            name,
            price: this.formData.price,
            category: { idCategory: this.categoriaId },
            brand: this.formData.brand
              ? { idBrand: this.formData.brand }
              : null,
            idImage,
            disabled: false,
          })
        );

        // upsert características
        const existingByFeature = new Map<
          number,
          { idProductFeature: number; value: string }
        >();
        for (const pf of this.existingPF) {
          existingByFeature.set(pf.idFeature, {
            idProductFeature: pf.idProductFeature,
            value: pf.featureValue,
          });
        }

        for (const d of this.draftFeatures) {
          const already = existingByFeature.get(d.idFeature);
          if (already) {
            if (
              this.minusculasCmp(already.value) !==
              this.minusculasCmp(d.featureValue)
            ) {
              await firstValueFrom(
                this.api.updateProductFeature(already.idProductFeature, {
                  featureValue: d.featureValue,
                  product: { idProduct },
                  feature: { idFeature: d.idFeature },
                })
              );
            }
            existingByFeature.delete(d.idFeature);
          } else {
            await firstValueFrom(
              this.api.createProductFeature({
                featureValue: d.featureValue,
                product: { idProduct },
                feature: { idFeature: d.idFeature },
              })
            );
          }
        }

        for (const leftover of existingByFeature.values()) {
          await firstValueFrom(
            this.api.deleteProductFeature(leftover.idProductFeature)
          );
        }

        // upsert receta
        const items = this.draftRecipe.map((d) => ({
          idSupply: d.idSupply,
          gramsQuantity: d.gramsQuantity,
        }));

        if (this.existingRecipeId) {
          await firstValueFrom(
            this.api.updateRecipe(this.existingRecipeId, {
              idProduct,
              items,
            })
          );
        } else {
          await firstValueFrom(
            this.api.createRecipe({
              idProduct,
              items,
            })
          );
        }

        this.toast.mostrarMensaje("✅ Producto actualizado correctamente");
        this.created.emit();
        this.updated.emit(idProduct);
      } else {
        // CREATE
        const conflict = (productos || []).some(
          (p: any) => this.minusculasCmp(p.name) === this.minusculasCmp(name)
        );
        if (conflict) {
          this.isLoading = false;
          return this.toast.mostrarMensaje(
            "❌ Ya existe un producto con este nombre."
          );
        }

        const idImage = await this.asegurarImagen(
          this.selectedFile,
          name,
          this.categoriaId,
          null
        );

        const created: any = await firstValueFrom(
          this.api.createProducto({
            name,
            price: this.formData.price,
            category: { idCategory: this.categoriaId },
            brand: this.formData.brand
              ? { idBrand: this.formData.brand }
              : null,
            idImage,
            disabled: false,
          })
        );
        const idProduct = Number(created?.idProduct ?? created?.id);
        if (!Number.isFinite(idProduct)) {
          throw new Error("No se obtuvo idProduct");
        }

        for (const pf of this.draftFeatures) {
          await firstValueFrom(
            this.api.createProductFeature({
              featureValue: pf.featureValue,
              product: { idProduct },
              feature: { idFeature: pf.idFeature },
            })
          );
        }

        await firstValueFrom(
          this.api.createRecipe({
            idProduct,
            items: this.draftRecipe.map((d) => ({
              idSupply: d.idSupply,
              gramsQuantity: d.gramsQuantity,
            })),
          })
        );

        this.toast.mostrarMensaje("✅ Producto creado correctamente");
        this.created.emit();
        this.updated.emit(idProduct);
      }
    } catch {
      this.toast.mostrarMensaje(
        "❌ Error al guardar el producto y su configuración"
      );
    } finally {
      this.isLoading = false;
    }
  }

  /* ===== Precarga edición ===== */
  private async cargarDatosExistentesProducto(
    idProduct: number
  ): Promise<void> {
    try {
      const [features, recipeSummaryOrId, recipeDetails] = await Promise.all([
        firstValueFrom(this.api.getProductFeaturesByProduct(idProduct)),
        this.api.getRecipeByProduct
          ? firstValueFrom(this.api.getRecipeByProduct(idProduct))
          : Promise.resolve(null as any),
        firstValueFrom(this.api.getRecipeDetailsByProduct(idProduct)),
      ]);

      this.existingPF = (features || []).map((f: any) => ({
        idProductFeature: Number(f.idProductFeature),
        idFeature: Number(f.feature?.idFeature ?? f.idFeature),
        featureName: String(f.feature?.featureName ?? ""),
        featureValue: String(f.featureValue ?? ""),
      }));

      this.draftFeatures = this.existingPF.map((x) => ({
        idFeature: x.idFeature,
        featureName: x.featureName,
        featureValue: x.featureValue,
      }));

      this.existingRecipeId = recipeSummaryOrId?.idRecipe ?? null;

      const detailsArray = Array.isArray(recipeDetails) ? recipeDetails : [];
      this.draftRecipe = detailsArray.map((d: any) => {
        const idSupply = d.supply?.idSupply ?? d.idSupply;
        const s = this.suppliesMap.get(Number(idSupply));
        return {
          idSupply,
          name: s?.name ?? d.supply?.name ?? `#${idSupply}`,
          gramsQuantity: Math.max(0.01, Number(d.gramsQuantity) || 0),
          unit: s?.unit ?? d.supply?.unit ?? "",
        };
      });
    } catch {
      this.existingPF = [];
      this.draftFeatures = [];
      this.existingRecipeId = null;
      this.draftRecipe = [];
    }
  }

  /* ===== Mini formulario de insumo ===== */
  abrirCrearInsumo(): void {
    this.nuevoInsumo = {
      name: "",
      unitPrice: 0,
      unit: "Units",
    };
    this.crearSupplyRef = this.overlay.open(this.formCrearSupplyTpl);
  }

  cancelarNuevoInsumo(): void {
    this.crearSupplyRef?.close();
    this.crearSupplyRef = undefined;
  }

  private async recargarInsumos(): Promise<void> {
    try {
      const raw = (await firstValueFrom(this.api.getSupplies())) as any[];
      this.supplies = (raw || []) as Supply[];
      this.suppliesMap.clear();
      for (const s of this.supplies) {
        this.suppliesMap.set(Number(s.idSupply), s);
      }
      this.insumosFiltrados = [...this.supplies];
    } catch {
      this.supplies = [];
      this.suppliesMap.clear();
      this.insumosFiltrados = [];
    }
  }

  async guardarNuevoInsumo(): Promise<void> {
    const name = (this.nuevoInsumo.name || "").trim();
    if (!name) {
      this.toast.mostrarMensaje(
        "❌ El nombre del insumo no puede estar vacío."
      );
      return;
    }

    this.isLoading = true;
    try {
      await firstValueFrom(
        this.api.createSupply({
          name,
          unitPrice: Number(this.nuevoInsumo.unitPrice) || 0,
          unit: this.nuevoInsumo.unit || "Units",
        })
      );

      this.toast.mostrarMensaje("✅ Insumo creado correctamente");
      await this.recargarInsumos();

      this.nuevoInsumo = { name: "", unitPrice: 0, unit: "Units" };
      this.cancelarNuevoInsumo();
    } catch {
      this.toast.mostrarMensaje("❌ Error al crear el insumo");
    } finally {
      this.isLoading = false;
    }
  }

  /* ===== Cerrar / Reset ===== */
  rastrearPorId(index: number, item: any): number {
    return item.idFeature ?? item.idSupply ?? item.idBrand ?? index;
  }

  cerrar(): void {
    this.restablecerFormulario();
    this.closed.emit();
  }

  private restablecerFormulario(): void {
    this.productoEditar = null;
    this.formData = { name: "", price: 0, brand: null };
    this.draftFeatures = [];
    this.draftRecipe = [];
    this.newFeature = { idFeature: null, featureValue: "" };
    this.newRecetaItem = { idSupply: null, gramsQuantity: 0 };
    this.textoCaracteristica = "";
    this.textoInsumo = "";
    this.caracteristicasFiltradas = [...this.featuresBase];
    this.insumosFiltrados = [...this.supplies];
    this.mostrarMasOpciones = false;
    this.selectedFile = null;
    this.nombreArchivo = null;
    this.imagePreview = null;
    this.formStep = 1;
    this.existingPF = [];
    this.existingRecipeId = null;
  }
}
