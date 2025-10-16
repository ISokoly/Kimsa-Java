import { Product } from './producto.models';

export const norm = (s: any) => String(s ?? '').trim();
export const lower = (s: any) => norm(s).toLowerCase();
export const uniq = (arr: string[]) => Array.from(new Set(arr));
export const take = <T>(arr: T[], n: number) => arr.slice(0, Math.max(0, n));

export function mapProductos(raw: any[], idCategory: number, marcaMap: Record<number, string>): Product[] {
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
        brand: idBrand ? { idBrand, name: marcaMap[idBrand] } : null,
        idImage: p.idImage ?? null,
        disabled: !!p.disabled
      } as Product;
    });
}

export function productosPorEstado(productos: Product[], estado: 'habilitados' | 'deshabilitados' | 'todos'): Product[] {
  if (estado === 'habilitados') return productos.filter(p => !p.disabled);
  if (estado === 'deshabilitados') return productos.filter(p => p.disabled);
  return productos;
}

export function makeFeatureTag(pf: any): string {
  const base = norm(pf?.feature?.featureName ?? pf?.featureName);
  const val  = norm(pf?.featureValue);
  if (!base) return '';
  return val ? `${base}: ${val}` : base;
}
