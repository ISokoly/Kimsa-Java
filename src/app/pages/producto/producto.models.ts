export interface Brand { idBrand: number; name: string; category?: number; }
export interface Product {
  idProduct: number; name: string; price: number; idCategory: number;
  idBrand?: number | null; brand?: { idBrand: number; name: string } | null;
  idImage?: number | null; disabled: boolean;
}
export interface Category { idCategory: number; name: string; }
export interface ImageResp { idImage?: number; id?: number; url: string; }