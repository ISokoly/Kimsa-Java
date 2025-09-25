import { Routes } from '@angular/router';
import { ProductoComponent } from './pages/producto/producto.component';
import { CategoriasComponent } from './pages/categorias/categorias.component';
import { LoginComponent } from './login/login.component';
import { ViewComponent } from './view/view.component';
import { UsuariosComponent } from './pages/usuarios/usuarios.component';
import { AuthGuard } from './core/guard/auth.guard';
import { VentasComponent } from './pages/ventas/ventas.component';
import { EstadisticasComponent } from './pages/estadisticas/estadisticas.component';
import { AdminGuard } from './core/guard/admin.guard';
import { RegistrarVentaComponent } from './pages/ventas/registrar-venta/registrar-venta.component';
import { PagosComponent } from './pages/ventas/pagos/pagos.component';
import { OtrosComponent } from './pages/usuarios/sub-paginas/otros/otros.component';
import { MesasComponent } from './pages/usuarios/sub-paginas/mesas/mesas.component';
import { ClientesComponent } from './pages/usuarios/sub-paginas/clientes/clientes.component';
import { DescuentosComponent } from './pages/usuarios/sub-paginas/descuentos/descuentos.component';
import { EmployeeGuard } from './core/guard/employee.guard';
import { HomeRedirectGuard } from './core/guard/home.guard';

const usuarioGuardado = localStorage.getItem('usuario');
const redireccionInicial = usuarioGuardado ? 'view' : 'login';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: redireccionInicial
  },
  {
    path: 'view',
    component: ViewComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        canActivate: [HomeRedirectGuard],
        component: CategoriasComponent
      },
       { path: 'categoria', component: CategoriasComponent, canActivate: [EmployeeGuard] },
      { path: 'categoria/producto/:nombreCategoria', component: ProductoComponent, canActivate: [EmployeeGuard] },
      { path: 'ventas', component: VentasComponent, canActivate: [EmployeeGuard] },
      { path: 'ventas/registrar-venta', component: RegistrarVentaComponent, canActivate: [EmployeeGuard] },
      { path: 'ventas/pagos/:id', component: PagosComponent, canActivate: [EmployeeGuard] },

      {
        path: 'ventas/editar/:id',
        component: RegistrarVentaComponent
      },
      { path: 'estadisticas', component: EstadisticasComponent, canActivate: [AdminGuard] },
      { path: 'usuarios', component: UsuariosComponent },
      { path: 'usuarios/otros', component: OtrosComponent, canActivate: [AdminGuard] },
      { path: 'usuarios/mesas', component: MesasComponent, canActivate: [AdminGuard] },
      { path: 'usuarios/clientes', component: ClientesComponent, canActivate: [EmployeeGuard] },
      { path: 'usuarios/descuentos', component: DescuentosComponent, canActivate: [EmployeeGuard] },
    ]
  },
  {
    path: 'login',
    component: LoginComponent
  }
];