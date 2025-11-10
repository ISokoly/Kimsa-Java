import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { BehaviorSubject, Observable, throwError, firstValueFrom } from "rxjs";
import { catchError, map, tap } from "rxjs/operators";

export interface UsuarioLigero {
  idUser?: number;
  username?: string;
  name?: string;
  lastName?: string;
  rol?: "Administrator" | "Employee" | string;
  administratorPermissions?: boolean;
  disabled?: boolean;
  dni?: string;
  direction?: string;
  numberPhone?: string;
}

@Injectable({ providedIn: "root" })
export class ApiService {
  public url = "http://localhost:8080";
  private apiUrl = `${this.url}/api`;

  private SESSION_FLAG = "kimsa_has_session";

  private usuarioActualSubject = new BehaviorSubject<UsuarioLigero | null>(
    null
  );
  public usuarioActual = this.usuarioActualSubject.asObservable();
  public usuario$ = this.usuarioActual;

  constructor(private http: HttpClient) {
    this.hydrateFromStorage();
    window.addEventListener("storage", () => this.hydrateFromStorage());
  }

  // ========= Helpers de estado =========
  public get usuarioAutenticado(): UsuarioLigero | null {
    return this.usuarioActualSubject.value;
  }

  public getUsuarioActual(): UsuarioLigero | null {
    return this.usuarioActualSubject.value;
  }

  public setUsuario(u: UsuarioLigero | null): void {
    if (u) localStorage.setItem("usuario", JSON.stringify(u));
    else localStorage.removeItem("usuario");
    this.usuarioActualSubject.next(u);
  }

  private hydrateFromStorage(): void {
    const saved = localStorage.getItem("usuario");
    if (saved) {
      try {
        this.usuarioActualSubject.next(JSON.parse(saved));
        return;
      } catch { }
    }
    this.usuarioActualSubject.next(null);
  }

  // ========= Headers / opciones =========
  private authHeaders(extra?: Record<string, string>) {
    const base: Record<string, string> = {};
    if (extra) Object.assign(base, extra);
    return new HttpHeaders(base);
  }

  private withCred(options?: { headers?: HttpHeaders; observe?: any }) {
    return { withCredentials: true, ...options } as const;
  }

  // ========= AUTH =========

  hasSession(): boolean {
    return localStorage.getItem(this.SESSION_FLAG) === "1";
  }

  login(username: string, password: string): Observable<UsuarioLigero> {
    return this.http
      .post<UsuarioLigero>(
        `${this.apiUrl}/auth/login`,
        { username, password },
        this.withCred({
          headers: new HttpHeaders({ "Content-Type": "application/json" }),
        })
      )
      .pipe(
        tap((user) => {
          if (!user) throw new Error("Respuesta inválida del login");
          localStorage.setItem(this.SESSION_FLAG, "1");
          this.setUsuario(user);
        }),
        catchError((err) => {
          if (err?.status === 0) {
            return throwError(
              () =>
                new Error(
                  "No se pudo conectar con el servidor (¿8080 arriba / CORS?)."
                )
            );
          }
          return throwError(
            () =>
              new Error(
                err.error?.message || err.message || "Error al iniciar sesión"
              )
          );
        })
      );
  }

  async ensureUserReady(): Promise<void> {
    if (!this.hasSession()) {
      this.setUsuario(null);
      return;
    }
    try {
      const me = await firstValueFrom(
        this.http
          .get<UsuarioLigero>(`${this.apiUrl}/auth/me`, this.withCred())
          .pipe(catchError(() => [null] as any))
      );
      this.setUsuario(me || null);
      if (!me) localStorage.removeItem(this.SESSION_FLAG);
    } catch {
      this.setUsuario(null);
      localStorage.removeItem(this.SESSION_FLAG);
    }
  }

  logout(): Promise<void> {
    return new Promise((resolve) => {
      this.http
        .post(`${this.apiUrl}/auth/logout`, {}, this.withCred())
        .subscribe({
          complete: () => {
            localStorage.removeItem("usuario");
            localStorage.removeItem(this.SESSION_FLAG);
            this.usuarioActualSubject.next(null);
            resolve();
          },
          error: () => {
            localStorage.removeItem("usuario");
            localStorage.removeItem(this.SESSION_FLAG);
            this.usuarioActualSubject.next(null);
            resolve();
          },
        });
    });
  }

  // ========= USUARIOS =========
  getUsuarios(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/users`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  getUsuarioById(id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/users/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  createUsuario(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/users`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  updateUsuario(id: number, data: any): Observable<any> {
    return this.http
      .put<any>(
        `${this.apiUrl}/users/${id}`,
        data,
        this.withCred({ headers: this.authHeaders() })
      )
      .pipe(
        tap((usuarioActualizado: any) => {
          const actual = this.getUsuarioActual();
          const idGuardado = actual?.idUser ?? (actual as any)?.id;
          const idActualizado =
            usuarioActualizado?.idUser ?? (usuarioActualizado as any)?.id ?? id;

          if (idGuardado && idGuardado === idActualizado) {
            const merged = { ...actual, ...usuarioActualizado, ...data };
            this.setUsuario(merged);
          }
        })
      );
  }

  cambiarPassword(
    id: number,
    payload: { actual: string; nueva: string }
  ): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/users/${id}/change-password`,
      payload,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  cambiarPasswordByAdmin(
    id: number,
    payload: { nueva: string }
  ): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/users/${id}/change-password-by-admin`,
      payload,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  deleteUsuario(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/users/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= MESAS =========
  createMesas(cantidad: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/tables/create-multiples`,
      { cantidad },
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updateMesa(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/tables/${id}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getMesaById(id: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/tables/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getMesas(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/tables`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getMesasActivas(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/tables/actives`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getMesasDeshabilitadas(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/tables/disables`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  actualizarCantidadMesas(cantidad: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/tables/update-quantity`,
      { cantidad },
      this.withCred({ headers: this.authHeaders() })
    );
  }
  actualizarEstadosMesas(cambios: any[]): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/tables/update-state`,
      cambios,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= CLIENTES =========
  getClientes(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/clients`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getClientesById(id: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/clients/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getClientesByDNI(dni: string): Observable<any | null> {
    return this.http
      .get<any>(
        `${this.apiUrl}/clients/dni/${dni}`,
        this.withCred({ headers: this.authHeaders(), observe: "response" })
      )
      .pipe(
        map((res: any) => (res.status === 204 ? null : res.body)),
        catchError(() => [null] as any)
      );
  }
  getClientesByNombre(name: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/clients/search?name=${encodeURIComponent(name)}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  ensureCliente(data: { name: string; dni: string; birthdate: string }) {
    return this.http.post<any>(
      `${this.apiUrl}/clients/ensure`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  createClientes(data: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/clients`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updateCliente(id: number, data: any): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/clients/${id}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  deleteCliente(id: number): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/clients/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= CATEGORÍAS =========
  getCategorias(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/categories`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  createCategoria(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/categories`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updateCategoria(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/categories/${id}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  disableCategoriaYProductos(id: number): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/categories/${id}/disable`,
      {},
      this.withCred({ headers: this.authHeaders() })
    );
  }
  deleteCategoria(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/categories/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getCategoriaById(id: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/categories/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getCategoriaByNombre(nombre: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/categories/name/${encodeURIComponent(nombre)}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= PRODUCTOS =========
  getProductos(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/products`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getProductoById(id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/products/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  createProducto(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/products`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updateProducto(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/products/${id}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  deleteProducto(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/products/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getProductosByCategoriaId(idCategory: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/products/category/${idCategory}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= IMÁGENES =========
  getImagenes(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/images`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getImagenById(id: number): Observable<{ id: number; url: string }> {
    return this.http.get<{ id: number; url: string }>(
      `${this.apiUrl}/images/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getUrlByIdImagen(id_imagen: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/images/${id_imagen}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  createImagen(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/images`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  uploadImage(
    file: File,
    nombre: string,
    tipo: string,
    idCategory: string
  ): Observable<any> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("nombre", nombre);
    formData.append("tipo", tipo);
    formData.append("categoria", idCategory);
    return this.http.post<any>(
      `${this.apiUrl}/images/upload`,
      formData,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updateImagen(
    id: number,
    file: File,
    nombre: string,
    tipo: string,
    idCategory: string
  ): Observable<any> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("nombre", nombre);
    formData.append("tipo", tipo);
    formData.append("categoria", idCategory);
    return this.http.put<any>(
      `${this.apiUrl}/images/${id}`,
      formData,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= MARCAS =========
  getMarcas(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/brands`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  createMarca(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/brands`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updateMarca(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/brands/${id}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  deleteMarca(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/brands/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= FEATURES =========
  getFeatures(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/features`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getFeatureById(id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/features/${encodeURIComponent(id)}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getFeaturesByCategory(idCategory: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/features/category/${encodeURIComponent(idCategory)}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  createFeature(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/features`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updateFeature(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/features/${encodeURIComponent(id)}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  deleteFeature(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/features/${encodeURIComponent(id)}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= PRODUCT FEATURES =========
  getProductFeatures(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/product-features`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getProductFeatureById(id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/product-features/${encodeURIComponent(id)}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getProductFeaturesByProduct(idProduct: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/product-features/product/${encodeURIComponent(
        idProduct
      )}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  createProductFeature(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/product-features`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updateProductFeature(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/product-features/${encodeURIComponent(id)}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  deleteProductFeature(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/product-features/${encodeURIComponent(id)}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getCaracteristicasByCategoriaId(categoria_id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/features/category/${encodeURIComponent(categoria_id)}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getCaracteristicasByProductoId(producto_id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/caracteristicas_productos/${encodeURIComponent(
        producto_id
      )}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= VENTAS / ORDERS =========
  getSales(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/orders/sales`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getSaleById(id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/orders/sales/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  createSale(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/orders/sales`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updateSale(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/orders/sales/${id}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updateSalePrice(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/orders/sales/${id}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updateSaleStatus(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/orders/sales/${id}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getConfirmedSales(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/orders/confirmed`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= ORDER DETAILS =========
  createOrderDetail(orderDetail: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/order-details/sales`,
      orderDetail,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getOrderDetails(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/order-details/sales`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getOrderDetailById(id_detail: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/order-details/sales/${id_detail}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updateOrderDetail(id_detail: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/order-details/sales/${id_detail}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  deleteOrderDetail(id_detail: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/order-details/sales/${id_detail}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getOrderDetailsByOrderId(order_id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/order-details/by-order/${order_id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= PAYMENTS =========
  getPayments(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/payments`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getPaymentsByOrderId(order_id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/payments/by-order/${order_id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  createPayment(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/payments`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updatePayment(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/payments/${id}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= DISCOUNTS =========
  getDescuentos(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/discounts`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getDescuentoById(id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/discounts/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  createDescuento(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/discounts`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updateDescuento(id: number, data: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/discounts/${id}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  deleteDescuento(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/discounts/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= SUPPLIES (INSUMOS) =========
  getSupplies(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/supplies`, this.withCred({ headers: this.authHeaders() }));
  }

  createSupply(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/supplies`, data, this.withCred({ headers: this.authHeaders() }));
  }

  updateSupply(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/supplies/${id}`, data, this.withCred({ headers: this.authHeaders() }));
  }

  toggleSupply(id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/supplies/${id}/toggle`, {}, this.withCred({ headers: this.authHeaders() }));
  }

  // ========= SUPPLIERS (PROVEEDORES) =========
  getSuppliers(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/suppliers`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getSupplierById(id: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/suppliers/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  createSupplier(data: { name: string; phone?: string; address?: string; email?: string }): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/suppliers`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  updateSupplier(id: number, data: any): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/suppliers/${id}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  toggleSupplier(id: number): Observable<any> {
    return this.http.patch<any>(
      `${this.apiUrl}/suppliers/${id}/toggle`,
      {},
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= PURCHASES (COMPRAS / ENTRADAS A STOCK) =========
  getPurchases(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/purchases`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  updatePurchase(id: number, data: { idSupplier: number; items: Array<{ idSupply: number; quantity: number }> }): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/purchases/${id}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  getPurchaseById(id: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/purchases/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
  createPurchase(data: { idSupplier: number; items: Array<{ idSupply: number; quantity: number }> }): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/purchases`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // ========= RECIPES (RECETAS DE PRODUCTO) =========
  getRecipes(): any {
    return this.http.get(
      `${this.apiUrl}/recipes`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  getRecipeByProduct(idProduct: number): any {
    return this.http.get(
      `${this.apiUrl}/recipes/product/${idProduct}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  getRecipeDetails(idRecipe: number): any {
    return this.http.get(
      `${this.apiUrl}/recipes/${idRecipe}/details`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  getRecipeDetailsByProduct(idProduct: number): any {
    return this.http.get(
      `${this.apiUrl}/recipes/product/${idProduct}/details`,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  // payload: { idProduct: number, items: [{ idSupply:number, gramsQuantity:number }] }
  createRecipe(data: any): any {
    return this.http.post(
      `${this.apiUrl}/recipes`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  updateRecipe(id: number, data: any): any {
    return this.http.put(
      `${this.apiUrl}/recipes/${id}`,
      data,
      this.withCred({ headers: this.authHeaders() })
    );
  }

  deleteRecipe(id: number): any {
    return this.http.delete(
      `${this.apiUrl}/recipes/${id}`,
      this.withCred({ headers: this.authHeaders() })
    );
  }
}
