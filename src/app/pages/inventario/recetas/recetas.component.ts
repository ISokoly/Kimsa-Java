import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  TemplateRef,
  ViewChild,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";

import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { MatGridListModule } from "@angular/material/grid-list";
import { MatSelectModule } from "@angular/material/select";
import { MatIconModule } from "@angular/material/icon";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatTableModule } from "@angular/material/table";
import { MatChipsModule } from "@angular/material/chips";
import { MatCardModule } from "@angular/material/card";
import { MatDividerModule } from "@angular/material/divider";

import { firstValueFrom, forkJoin, of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import {
  OverlayHandle,
  OverlayPortalService,
} from "../../../core/services/overlay-portal.service";
import { ApiService } from "../../../core/services/api.service";
import { ToastService } from "../../../core/services/toast.service";
import { PageLoadingService } from "../../../core/services/page-loading.service";
import { DecimalPipe } from "@angular/common";

@Component({
  selector: "app-recetas",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, RouterModule,
    MatInputModule, MatGridListModule, MatButtonModule, MatSelectModule, MatIconModule, MatFormFieldModule, MatTableModule,
    MatChipsModule, MatCardModule, DecimalPipe, MatDividerModule,
  ],
  templateUrl: "./recetas.component.html",
  styleUrls: ["./recetas.component.scss"],
})
export class RecetasComponent implements OnInit {
  contentReady = false;
  private pendingLoads = 0;
  isSaving = false;
  formLoading = false;

  recipes: any[] = [];
  products: any[] = [];
  supplies: any[] = [];
  private suppliesMap = new Map<number, any>();

  detailsByRecipe: Record<
    number, Array<{idSupply: number;name: string;gramsQuantity: number;unit?: string;}>> = {};

  @ViewChild("recipeFormTpl") recipeFormTpl!: TemplateRef<any>;
  private overlay = inject(OverlayPortalService);
  private recipeFormRef?: OverlayHandle;

  selectedRecipe: any = null;
  formData: any = { idProduct: null };
  newItem: any = { idSupply: null, gramsQuantity: 0 };

  details: Array<{
    idSupply: number;
    name: string;
    gramsQuantity: number;
    unit?: string;
  }> = [];

  displayedColumns: string[] = ["id", "product", "items", "actions"];

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private pageLoading: PageLoadingService,
    private cdr: ChangeDetectorRef
  ) {}

  private groupStart() {
    if (this.pendingLoads === 0) this.pageLoading.start();
    this.pendingLoads++;
  }
  private groupEnd() {
    this.pendingLoads = Math.max(0, this.pendingLoads - 1);
    if (this.pendingLoads === 0) {
      this.pageLoading.stop();
      this.contentReady = true;
      this.cdr.markForCheck();
    }
  }

  async ngOnInit(): Promise<void> {
    this.contentReady = false;
    this.groupStart();
    try {
      const [prods, sups, recs] = await Promise.all([
        firstValueFrom(this.api.getProductos()),
        firstValueFrom(this.api.getSupplies()),
        firstValueFrom(this.api.getRecipes()),
      ]);

      this.products = arr(prods);
      this.supplies = arr(sups);
      this.suppliesMap.clear();
      for (const s of this.supplies)
        this.suppliesMap.set(Number(s.idSupply), s);

      this.recipes = arr(recs);

      await this.loadAllDetailsForTable();
    } catch {
      this.toast.mostrarMensaje("❌ Error cargando recetas/catálogos");
      this.products = [];
      this.supplies = [];
      this.recipes = [];
      this.detailsByRecipe = {};
    } finally {
      this.groupEnd();
    }
  }

  private async loadAllDetailsForTable(): Promise<void> {
    if (!this.recipes.length) {
      this.detailsByRecipe = {};
      return;
    }

    const calls = this.recipes.map((r) =>
      this.api.getRecipeDetails(r.idRecipe).pipe(
        map((list: any[]) => ({ id: r.idRecipe, details: arr(list) })),
        catchError(() => of({ id: r.idRecipe, details: [] }))
      )
    );

    const results = await firstValueFrom(forkJoin(calls));
    const mapDetails: typeof this.detailsByRecipe = {};

    for (const res of results) {
      mapDetails[res.id] = res.details.map((d: any) => {
        const idSupply = toNum(d?.idSupply ?? d?.supply?.idSupply);
        const qty = toNum(d?.gramsQuantity ?? d?.cantidad_gramos, 0);
        const s = this.suppliesMap.get(idSupply);
        return {
          idSupply,
          name: s?.name ?? d?.supply?.name ?? `#${idSupply}`,
          gramsQuantity: qty,
          unit: s?.unit ?? d?.supply?.unit ?? undefined,
        };
      });
    }
    this.detailsByRecipe = mapDetails;
    this.cdr.markForCheck();
  }

  get availableSupplies(): any[] {
    const used = new Set(this.details.map((d) => d.idSupply));
    return this.supplies.filter((s) => !used.has(s.idSupply));
  }

  abrirFormulario(recipe: any = null): void {
    this.selectedRecipe = recipe;

    if (recipe) {
      this.formData = {
        idProduct: recipe.idProduct ?? recipe.product?.idProduct ?? null,
      };
    } else {
      this.formData = { idProduct: null };
      this.details = [];
    }

    this.recipeFormRef?.close();
    this.recipeFormRef = this.overlay.open(this.recipeFormTpl);
    this.cdr.markForCheck();

    if (recipe) {
      this.formLoading = true;
      this.cdr.markForCheck();

      this.api.getRecipeDetails(recipe.idRecipe).subscribe({
        next: (arr: any[]) => {
          const list = Array.isArray(arr) ? arr : [];
          this.details = list.map((d) => {
            const idSupply = Number(d.idSupply ?? d.supply?.idSupply);
            const s = this.suppliesMap.get(idSupply);
            return {
              idSupply,
              name: s?.name ?? d?.supply?.name ?? `#${idSupply}`,
              gramsQuantity: Number(d.gramsQuantity ?? d.cantidad_gramos ?? 0),
              unit: s?.unit ?? d?.supply?.unit ?? undefined,
            };
          });
        },
        error: () => {
          this.details = [];
        },
        complete: () => {
          this.formLoading = false;
          this.cdr.markForCheck();
        },
      });
    }
  }

  cerrarFormulario(): void {
    this.recipeFormRef?.close();
    this.recipeFormRef = undefined;
    this.selectedRecipe = null;
    this.formData = { idProduct: null };
    this.details = [];
    this.newItem = { idSupply: null, gramsQuantity: 0 };
    this.cdr.markForCheck();
  }

  /* ====== Agregar / editar items ====== */
  canAddItem(): boolean {
    return (
      typeof this.newItem.idSupply === "number" &&
      (Number(this.newItem.gramsQuantity) || 0) > 0
    );
  }

  onSelectNewSupply(): void {
    if (this.newItem && !(Number(this.newItem.gramsQuantity) > 0)) {
      this.newItem.gramsQuantity = 0.01;
    }
  }

  addItem(): void {
    if (!this.canAddItem()) {
      this.toast.mostrarMensaje("⚠️ Selecciona insumo y cantidad > 0");
      return;
    }
    const s = this.suppliesMap.get(Number(this.newItem.idSupply));
    if (!s) {
      this.toast.mostrarMensaje("❌ Insumo inválido");
      return;
    }

    const qty = Math.max(0.01, Number(this.newItem.gramsQuantity) || 0);
    const existing = this.details.find((i) => i.idSupply === s.idSupply);
    if (existing) {
      existing.gramsQuantity = round2(existing.gramsQuantity + qty);
    } else {
      this.details = [
        ...this.details,
        {
          idSupply: s.idSupply,
          name: s.name,
          gramsQuantity: round2(qty),
          unit: s.unit,
        },
      ];
    }
    this.newItem = { idSupply: null, gramsQuantity: 0 };
    this.cdr.markForCheck();
  }

  removeItem(it: any): void {
    this.details = this.details.filter((x) => x !== it);
    this.cdr.markForCheck();
  }

  clampNewGrams(): void {
    const g = Math.max(0.01, Number(this.newItem.gramsQuantity) || 0.01);
    this.newItem.gramsQuantity = round2(g);
  }
  clampItemGrams(it: any): void {
    const g = Math.max(0.01, Number(it.gramsQuantity) || 0.01);
    it.gramsQuantity = round2(g);
  }

  canSave(): boolean {
    return (
      typeof this.formData.idProduct === "number" &&
      this.details.length > 0 &&
      this.details.every((i) => i.gramsQuantity > 0)
    );
  }

  async saveRecipe(): Promise<void> {
    if (!this.canSave()) {
      this.toast.mostrarMensaje(
        "⚠️ Selecciona producto y agrega insumos con cantidad > 0"
      );
      return;
    }
    this.isSaving = true;
    this.cdr.markForCheck();

    const payload = {
      idProduct: this.formData.idProduct as number,
      details: this.details.map((d) => ({
        idSupply: d.idSupply,
        gramsQuantity: d.gramsQuantity,
      })),
    };

    try {
      if (this.selectedRecipe?.idRecipe) {
        await firstValueFrom(
          this.api.updateRecipe(this.selectedRecipe.idRecipe, payload)
        );
        this.toast.mostrarMensaje("✅ Receta actualizada");
      } else {
        await firstValueFrom(this.api.createRecipe(payload));
        this.toast.mostrarMensaje("✅ Receta creada");
      }

      const recs = await firstValueFrom(this.api.getRecipes());
      this.recipes = arr(recs);
      await this.loadAllDetailsForTable();

      this.cerrarFormulario();
    } catch {
      this.toast.mostrarMensaje("❌ Error al guardar receta");
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  private UNIT_MAP: Record<string, string> = {
    Grams: "g",
    Milliliters: "ml",
    Units: "u",
  };
  unitLabel(unit: string | null | undefined): string {
    return unit ? this.UNIT_MAP[unit] ?? unit : "";
  }
  unitLabelBySupply(idSupply: number | null): string {
    if (!idSupply) return "";
    const s = this.suppliesMap.get(Number(idSupply));
    return s ? this.unitLabel(s.unit) : "";
  }

  private get usedProductIds(): Set<number> {
    const set = new Set<number>();
    for (const r of this.recipes) {
      const id = Number(r?.idProduct ?? r?.product?.idProduct);
      if (Number.isFinite(id)) set.add(id);
    }
    return set;
  }
  get availableProducts(): any[] {
    const currentId = this.selectedRecipe
      ? Number(
          this.selectedRecipe?.idProduct ??
            this.selectedRecipe?.product?.idProduct
        )
      : null;

    const used = this.usedProductIds;
    return this.products.filter((p) => {
      const pid = Number(p.idProduct);
      if (!Number.isFinite(pid)) return false;
      if (currentId != null && pid === currentId) return true;
      return !used.has(pid);
    });
  }

  trackByRecipe = (_: number, r: any) => r?.idRecipe ?? _;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function toNum(v: any, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function arr<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}