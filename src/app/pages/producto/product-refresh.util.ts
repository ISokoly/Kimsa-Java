import { firstValueFrom } from 'rxjs';

export interface Brand { idBrand: number; name: string; }
export interface Product {
  idProduct: number;
  name: string;
  price: number;
  idCategory: number;
  idBrand?: number | null;
  brand?: { idBrand: number; name: string } | null;
  idImage?: number | null;
  disabled: boolean;
}

export interface SimpleApiPort {
  getProductoById(id: number): any;
  getProductFeaturesByProduct(idProduct: number): any;
}

export function mapProduct(raw: any, marcaMap: Record<number, string>): Product {
  const idBrand = raw?.idBrand ?? raw?.brand?.idBrand ?? null;
  const idCategory = raw?.idCategory ?? raw?.category?.idCategory ?? null;
  return {
    idProduct: Number(raw?.idProduct ?? raw?.id),
    name: String(raw?.name ?? ''),
    price: Number(raw?.price ?? 0),
    idCategory: Number(idCategory),
    idBrand,
    brand: idBrand ? { idBrand, name: marcaMap[idBrand] } : null,
    idImage: raw?.idImage ?? null,
    disabled: !!raw?.disabled,
  };
}

function makeRow(pf: any): { base: string; value: string } | null {
  const base = String(pf?.feature?.featureName ?? pf?.featureName ?? '').trim();
  const value = String(pf?.featureValue ?? '').trim();
  if (!base) return null;
  return { base, value };
}

export async function refreshSelectedProductSimple(opts: {
  api: SimpleApiPort;
  idProduct: number;
  marcaMap: Record<number, string>;
  setSelected: (p: Product) => void;
  setFeatureRows: (rows: Array<{ base: string; value: string }>) => void;
  reloadImage?: (idImage: number) => Promise<void>;
}): Promise<void> {
  const { api, idProduct, setSelected, setFeatureRows, marcaMap, reloadImage } = opts;

  const rawProd = await firstValueFrom<any>(api.getProductoById(idProduct));
  const mapped = mapProduct(rawProd, marcaMap);
  setSelected(mapped);

  if (reloadImage && mapped.idImage) {
    await reloadImage(mapped.idImage);
  }

  const rawList = await firstValueFrom<any[]>(api.getProductFeaturesByProduct(idProduct));
  const list = Array.isArray(rawList) ? rawList : [];
  const rows = list.map(makeRow).filter(Boolean) as Array<{ base: string; value: string }>;
  setFeatureRows(rows);
}