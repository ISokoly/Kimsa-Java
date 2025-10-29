import { Routes } from "@angular/router";
import { ViewComponent } from "./view/view.component";
import { LoginComponent } from "./login/login.component";
import { AuthGuard } from "./core/guard/auth.guard";
import { AdminGuard } from "./core/guard/admin.guard";
import { EmployeeGuard } from "./core/guard/employee.guard";
import { CategoriasComponent } from "./pages/categorias/categorias.component";
import { ProductoComponent } from "./pages/producto/producto.component";
import { VentasComponent } from "./pages/ventas/ventas.component";
import { RegistrarVentaComponent } from "./pages/ventas/registrar-venta/registrar-venta.component";
import { PagosComponent } from "./pages/ventas/pagos/pagos.component";
import { EstadisticasComponent } from "./pages/estadisticas/estadisticas.component";
import { UsuariosComponent } from "./pages/usuarios/usuarios.component";
import { OtrosComponent } from "./pages/usuarios/sub-paginas/otros/otros.component";
import { MesasComponent } from "./pages/usuarios/sub-paginas/mesas/mesas.component";
import { ClientesComponent } from "./pages/usuarios/sub-paginas/clientes/clientes.component";
import { DescuentosComponent } from "./pages/usuarios/sub-paginas/descuentos/descuentos.component";
import { NoAuthGuard } from "./core/guard/no-auth.guard";
import { PendingSalesGuard } from "./core/guard/pending-sales.guard";
import { PaymentAccessGuard } from "./core/guard/payment-access.guard";

export const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "view" },

  {
    path: "view",
    component: ViewComponent,
    canActivate: [AuthGuard],
    children: [
      { path: "", pathMatch: "full", redirectTo: "categoria" },
      {
        path: "categoria",
        component: CategoriasComponent,
        canActivate: [EmployeeGuard],
      },
      {
        path: "categoria/producto/:nombreCategoria",
        component: ProductoComponent,
        canActivate: [EmployeeGuard],
      },
      {
        path: "ventas",
        component: VentasComponent,
        canActivate: [EmployeeGuard],
      },
      {
        path: "ventas/registrar-venta",
        component: RegistrarVentaComponent,
        canActivate: [EmployeeGuard],
      },
      {
        path: "ventas/pagos/:id",
        component: PagosComponent,
        canActivate: [EmployeeGuard, PaymentAccessGuard],
      },
      {
        path: "ventas/editar/:id", component: RegistrarVentaComponent,
        canActivate: [EmployeeGuard, PendingSalesGuard]
      },
      {
        path: "estadisticas",
        component: EstadisticasComponent,
        canActivate: [AdminGuard],
      },
      { path: "usuarios", component: UsuariosComponent },
      {
        path: "usuarios/otros",
        component: OtrosComponent,
        canActivate: [AdminGuard],
      },
      {
        path: "usuarios/mesas",
        component: MesasComponent,
        canActivate: [AdminGuard],
      },
      {
        path: "usuarios/clientes",
        component: ClientesComponent,
        canActivate: [EmployeeGuard],
      },
      {
        path: "usuarios/descuentos",
        component: DescuentosComponent,
        canActivate: [EmployeeGuard],
      },
      { path: "**", redirectTo: "categoria" },
    ],
  },

  { path: "login", component: LoginComponent, canActivate: [NoAuthGuard] },
  { path: "**", redirectTo: "view" },
];
