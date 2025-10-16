import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { Product } from '../../pages/producto/producto.models';
import { lower, makeFeatureTag, norm, take, uniq } from '../../pages/producto/producto.utils';

@Injectable({ providedIn: 'root' })
export class FeatureFilterService {
  featureQuery = '';
  featureSuggestions: string[] = [];
  selectedFeatureTags: string[] = [];
  productFeatureTags: Record<number, string[]> = {};
  allFeatureTags: string[] = []; // pool global único

  constructor(private api: ApiService) {}

  async buildFeatureTagsForProducts(productos: Product[]): Promise<void> {
    this.productFeatureTags = {};

    await Promise.all(
      productos.map(async (p) => {
        try {
          const list = await firstValueFrom(this.api.getProductFeaturesByProduct(p.idProduct)) as any[];
          const tags = (list || []).map(makeFeatureTag).filter(Boolean);
          this.productFeatureTags[p.idProduct] = uniq(tags);
        } catch {
          this.productFeatureTags[p.idProduct] = [];
        }
      })
    );

    const poolAll: string[] = [];
    Object.values(this.productFeatureTags).forEach(tags => poolAll.push(...tags));
    this.allFeatureTags = uniq(poolAll);

    this.recomputeFeatureSuggestions();
  }

  onFeatureInput(val: any): void {
    this.featureQuery = (val ?? '').toString();
    this.recomputeFeatureSuggestions();
  }

  onFeatureSuggestionSelected(tag: string): void {
    const t = norm(tag);
    if (!t) return;
    const exists = this.selectedFeatureTags.some(x => lower(x) === lower(t));
    if (!exists) this.selectedFeatureTags.push(t);
    this.featureQuery = '';
    this.recomputeFeatureSuggestions();
  }

  removeSelectedFeatureTag(tag: string): void {
    this.selectedFeatureTags = this.selectedFeatureTags.filter(x => lower(x) !== lower(tag));
    this.recomputeFeatureSuggestions();
  }

  clearFeatureFilters(): void {
    this.featureQuery = '';
    this.selectedFeatureTags = [];
    this.recomputeFeatureSuggestions();
  }

  recomputeFeatureSuggestions(): void {
    const q = lower(this.featureQuery);
    const taken = new Set(this.selectedFeatureTags.map(lower));
    this.featureSuggestions = take(
      this.allFeatureTags
        .filter(t => !!t)
        .filter(t => !taken.has(lower(t)))
        .filter(t => !q || lower(t).includes(q)),
      15
    );
  }

  filterProductsBySelectedTags(products: Product[]): Product[] {
    if (this.selectedFeatureTags.length === 0) return products;
    const selected = this.selectedFeatureTags.map(lower);
    return products.filter(p => {
      const tags = (this.productFeatureTags[p.idProduct] || []).map(lower);
      if (tags.length === 0) return false;
      const set = new Set(tags);
      return selected.every(t => set.has(t));
    });
  }
}