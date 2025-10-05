import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

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

  getClientesByDNI(dni: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/clients/${dni}`);
  }

  getClientesByNombre(name: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/clients/search?name=${encodeURIComponent(name)}`);
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

  // Obtener todas las características
  getFeatures(): Observable<any> {
    return this.http.get(`${this.apiUrl}/features`);
  }

  // Obtener una característica por ID
  getFeatureById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/features/${encodeURIComponent(id)}`);
  }

  // Obtener características filtradas por categoría
  getFeaturesByCategory(idCategory: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/features/category/${encodeURIComponent(idCategory)}`);
  }

  // Crear característica
  createFeature(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/features`, data);
  }

  // Actualizar característica
  updateFeature(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/features/${encodeURIComponent(id)}`, data);
  }

  // Eliminar característica
  deleteFeature(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/features/${encodeURIComponent(id)}`);
  }

  /* ==================== PRODUCT FEATURES ==================== */

  // Obtener todos los productFeatures
  getProductFeatures(): Observable<any> {
    return this.http.get(`${this.apiUrl}/product-features`);
  }

  // Obtener un productFeature por ID
  getProductFeatureById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/product-features/${encodeURIComponent(id)}`);
  }

  // Obtener características por producto
  getProductFeaturesByProduct(idProduct: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/product-features/product/${encodeURIComponent(idProduct)}`);
  }

  // Crear detalle de característica
  createProductFeature(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/product-features`, data);
  }

  // Actualizar detalle de característica
  updateProductFeature(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/product-features/${encodeURIComponent(id)}`, data);
  }

  // Eliminar detalle de característica
  deleteProductFeature(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/product-features/${encodeURIComponent(id)}`);
  }

  getCaracteristicasByCategoriaId(categoria_id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/features/category/${encodeURIComponent(categoria_id)}`);
  }

  getCaracteristicasByProductoId(producto_id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/caracteristicas_productos/${encodeURIComponent(producto_id)}`);
  }

  getVentas(): Observable<any> {
    return this.http.get(`${this.apiUrl}/pedidos/ventas`);
  }

  getVentasById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/pedidos/ventas/${id}`);
  }

  createVentas(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/pedidos/ventas`, data);
  }

  updateVentas(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/pedidos/ventas/${id}`, data);
  }

  updatePrecioVentas(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/pedidos/ventas/${id}`, data);
  }

  updateEstadoVentas(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/pedidos/ventas/${id}`, data);
  }

  deleteVentas(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/pedidos/ventas/${id}`);
  }

  getVentasConfirmadas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/pedidos/ventas-confirmadas/confirmados`);
  }

  crearDetallePedido(detallePedido: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/detalle-pedidos/ventas`, detallePedido);
  }

  getDetallePedido(): Observable<any> {
    return this.http.get(`${this.apiUrl}/detalle-pedidos/ventas`);
  }

  getDetallePedidoById(id_detalle: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/detalle-pedidos/ventas/${id_detalle}`);
  }

  updateDetallePedido(id_detalle: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/detalle-pedidos/ventas/${id_detalle}`, data);
  }

  deleteDetallePedido(id_detalle: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/detalle-pedidos/ventas/${id_detalle}`);
  }

  getDetallePedidoByIdPedido(id_pedido: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/detalle-pedido/pedidos/${id_pedido}`);
  }

  // Pagos
  getPagos(): Observable<any> {
    return this.http.get<any[]>(`${this.apiUrl}/pizzeria/pagos`);
  }

  getPagosByIdPedido(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/pagados/pagos/${id}`);
  }

  createPago(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/pizzeria/pagos`, data);
  }

  updatePago(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/pizzeria/pagos/${id}`, data);
  }

  deletePago(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/pizzeria/pagos/${id}`);
  }

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