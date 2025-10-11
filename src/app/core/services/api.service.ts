import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  public url = 'http://localhost:8080';
  private apiUrl = `${this.url}/api`;
  private usuarioActualSubject: BehaviorSubject<any>;
  public usuarioActual: Observable<any>;

  constructor(private http: HttpClient) {
    const usuarioGuardado = localStorage.getItem('usuario');
    this.usuarioActualSubject = new BehaviorSubject<any>(
      usuarioGuardado ? JSON.parse(usuarioGuardado) : null
    );
    this.usuarioActual = this.usuarioActualSubject.asObservable();
  }

  public get usuarioAutenticado(): any {
    return this.usuarioActualSubject.value;
  }

  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, { username, password }, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      tap(response => {
        if (response?.token) {
          if (response.usuario.disabled) {
            throw new Error('Usuario deshabilitado. Contacta al administrador.');
          }

          this.setUsuarioActual(response.usuario, response.token);
        }
      }),
      catchError(error => {
        console.error('Error en login:', error);
        return throwError(() => new Error(error.error?.message || error.message || 'Error al iniciar sesión'));
      })
    );
  }

  private setUsuarioActual(usuario: any, token: string): void {
    localStorage.setItem('usuario', JSON.stringify(usuario));
    localStorage.setItem('token', token);
    this.usuarioActualSubject.next(usuario);
  }

  logout(): void {
    localStorage.removeItem('usuario');
    localStorage.removeItem('token');
    this.usuarioActualSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getUsuarios(): Observable<any> {
    return this.http.get(`${this.apiUrl}/users`, {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${this.getToken()}`
      })
    });
  }

  getUsuarioActual() {
    const usuario = localStorage.getItem('usuario');
    return usuario ? JSON.parse(usuario) : null;
  }

  getUsuarioById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/users/${id}`);
  }

  createUsuario(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/users`, data);
  }

  updateUsuario(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/users/${id}`, data, {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${this.getToken()}`
      })
    }).pipe(
      tap((usuarioActualizado: any) => {
        const usuarioGuardado = this.getUsuarioActual();

        const idGuardado = usuarioGuardado?.idUser ?? usuarioGuardado?.id_user;
        const idActualizado = usuarioActualizado?.idUser ?? usuarioActualizado?.id_user;

        if (idGuardado && idGuardado === idActualizado) {
          localStorage.setItem('usuario', JSON.stringify(usuarioActualizado));
          this.usuarioActualSubject.next(usuarioActualizado);
        }
      })
    );
  }

  cambiarPassword(id: number, payload: { actual: string, nueva: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/${id}/change-password`, payload);
  }

  cambiarPasswordByAdmin(id: number, payload: { nueva: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/${id}/change-password-by-admin`, payload);
  }

  deleteUsuario(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${id}`, {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${this.getToken()}`
      })
    });
  }

  //Mesas
  createMesas(cantidad: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/tables/create-multiples`, { cantidad });
  }

  updateMesa(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/tables/${id}`, data);
  }

  getMesaById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/tables/${id}`);
  }

  getMesas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tables`);
  }

  getMesasActivas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tables/actives`);
  }

  getMesasDeshabilitadas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tables/disables`);
  }

  actualizarCantidadMesas(cantidad: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/tables/update-quantity`, { cantidad });
  }

  actualizarEstadosMesas(cambios: any[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/tables/update-state`, cambios);
  }

  //Clientes
  getClientes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/clients`);
  }

  getClientesById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/clients/${id}`);
  }

  getClientesByDNI(dni: string) {
    return this.http
      .get<any>(`${this.apiUrl}/clients/dni/${dni}`, { observe: 'response' })
      .pipe(
        map(res => (res.status === 204 ? null : res.body)),
        catchError(() => of(null))
      );
  }

  getClientesByNombre(name: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/clients/search?name=${encodeURIComponent(name)}`);
  }

  ensureCliente(data: { name: string; dni: string; birthdate: string }) {
    return this.http.post<any>(`${this.apiUrl}/clients/ensure`, data);
  }

  createClientes(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/clients`, data);
  }

  updateCliente(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/clients/${id}`, data);
  }

  deleteCliente(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/clients/${id}`);
  }

  // Categorías
  getCategorias(): Observable<any> {
    return this.http.get(`${this.apiUrl}/categories`);
  }

  createCategoria(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/categories`, data);
  }

  updateCategoria(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/categories/${id}`, data);
  }

  disableCategoriaYProductos(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/categories/${id}/disable`, {});
  }

  deleteCategoria(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/categories/${id}`);
  }

  getCategoriaById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/categories/${id}`);
  }

  getCategoriaByNombre(nombre: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/categories/name/${encodeURIComponent(nombre)}`);
  }

  // Productos
  getProductos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/products`);
  }

  getProductoById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/products/${id}`);
  }

  createProducto(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/products`, data);
  }

  updateProducto(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/products/${id}`, data);
  }

  deleteProducto(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/products/${id}`);
  }

  getProductosByCategoriaId(idCategory: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/products/category/${idCategory}`);
  }

  // Imagenes
  getImagenes(): Observable<any> {
    return this.http.get(`${this.apiUrl}/images`);
  }

  getImagenById(id: number): Observable<{ id: number, url: string }> {
    return this.http.get<{ id: number, url: string }>(`${this.apiUrl}/images/${id}`);
  }

  getUrlByIdImagen(id_imagen: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/images/${id_imagen}`);
  }

  createImagen(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/images`, data);
  }

  uploadImage(file: File, nombre: string, tipo: string, idCategory: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('nombre', nombre);
    formData.append('tipo', tipo);
    formData.append('categoria', idCategory);
    return this.http.post<any>(`${this.apiUrl}/images/upload`, formData);
  }

  updateImagen(id: number, file: File, nombre: string, tipo: string, idCategory: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('nombre', nombre);
    formData.append('tipo', tipo);
    formData.append('categoria', idCategory);
    return this.http.put<any>(`${this.apiUrl}/images/${id}`, formData);
  }

  // Marcas
  getMarcas(): Observable<any> {
    return this.http.get(`${this.apiUrl}/brands`);
  }

  createMarca(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/brands`, data);
  }

  updateMarca(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/brands/${id}`, data);
  }

  deleteMarca(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/brands/${id}`);
  }

  /* ==================== FEATURES ==================== */

  getFeatures(): Observable<any> {
    return this.http.get(`${this.apiUrl}/features`);
  }

  getFeatureById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/features/${encodeURIComponent(id)}`);
  }

  getFeaturesByCategory(idCategory: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/features/category/${encodeURIComponent(idCategory)}`);
  }

  createFeature(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/features`, data);
  }

  updateFeature(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/features/${encodeURIComponent(id)}`, data);
  }

  deleteFeature(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/features/${encodeURIComponent(id)}`);
  }

  /* ==================== PRODUCT FEATURES ==================== */

  getProductFeatures(): Observable<any> {
    return this.http.get(`${this.apiUrl}/product-features`);
  }

  getProductFeatureById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/product-features/${encodeURIComponent(id)}`);
  }

  getProductFeaturesByProduct(idProduct: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/product-features/product/${encodeURIComponent(idProduct)}`);
  }

  createProductFeature(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/product-features`, data);
  }

  updateProductFeature(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/product-features/${encodeURIComponent(id)}`, data);
  }

  deleteProductFeature(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/product-features/${encodeURIComponent(id)}`);
  }

  getCaracteristicasByCategoriaId(categoria_id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/features/category/${encodeURIComponent(categoria_id)}`);
  }

  getCaracteristicasByProductoId(producto_id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/caracteristicas_productos/${encodeURIComponent(producto_id)}`);
  }

  /* ==================== SALES ==================== */

  getSales(): Observable<any> {
    return this.http.get(`${this.apiUrl}/orders/sales`);
  }

  getSaleById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/orders/sales/${id}`);
  }

  createSale(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/orders/sales`, data);
  }

  updateSale(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/orders/sales/${id}`, data);
  }

  updateSalePrice(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/orders/sales/${id}`, data);
  }

  updateSaleStatus(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/orders/sales/${id}`, data);
  }

  getConfirmedSales(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/orders/confirmed`);
  }

  /* ==================== ORDER DETAILS ==================== */

  createOrderDetail(orderDetail: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/order-details/sales`, orderDetail);
  }

  getOrderDetails(): Observable<any> {
    return this.http.get(`${this.apiUrl}/order-details/sales`);
  }

  getOrderDetailById(id_detail: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/order-details/sales/${id_detail}`);
  }

  updateOrderDetail(id_detail: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/order-details/sales/${id_detail}`, data);
  }

  deleteOrderDetail(id_detail: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/order-details/sales/${id_detail}`);
  }

  getOrderDetailsByOrderId(order_id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/order-details/by-order/${order_id}`);
  }

  /* ==================== PAYMENTS ==================== */

  getPayments(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/payments`);
  }

  getPaymentsByOrderId(order_id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/payments/by-order/${order_id}`);
  }

  createPayment(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/payments`, data);
  }

  updatePayment(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/payments/${id}`, data);
  }
  /* ==================== DISCOUNTS ==================== */

  getDescuentos(): Observable<any> {
    return this.http.get<any[]>(`${this.apiUrl}/discounts`);
  }

  getDescuentoById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/discounts/${id}`);
  }

  createDescuento(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/discounts`, data);
  }

  updateDescuento(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/discounts/${id}`, data);
  }

  deleteDescuento(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/discounts/${id}`);
  }
}