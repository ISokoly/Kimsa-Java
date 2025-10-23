// view.component.ts
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationStart } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { ApiService } from '../core/services/api.service';
import { CommonModule } from '@angular/common';
import { ToastService } from '../core/services/toast.service';
import { FormsModule } from '@angular/forms';
import { MenuComponent } from "../components/menu/menu.component";
import { PageLoadingService } from '../core/services/page-loading.service';

@Component({
  selector: 'app-view',
  standalone: true,
  imports: [
    MatToolbarModule, MatButtonModule, MatIconModule, MatSidenavModule,
    CommonModule, FormsModule, MenuComponent, RouterOutlet
  ],
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss'
})
export class ViewComponent {
  usuarioNombre = '';
  usuarioRol = '';
  collapsed = signal(false);
  estaSeleccionado = false;
  ready = false;
  static estaSeleccionado: boolean;

  sidenavWidth = computed(() => (this.collapsed() ? '65px' : '250px'));
  isUsuariosPage = false;
  isEntering = false;

  public pageLoading = inject(PageLoadingService);

  get usuarioAutenticado() {
    return this.apiService.usuarioAutenticado;
  }

  constructor(private router: Router, private apiService: ApiService, private toastService: ToastService) {
    this.router.events.subscribe(() => {
      this.isUsuariosPage = this.router.url.startsWith('/view/usuarios');
    });
    const saved = localStorage.getItem('collapsed');
    if (saved != null) this.collapsed.set(saved === 'true');
  }

  ngAfterViewInit() {
    setTimeout(() => (this.ready = true));
  }

  ngOnInit() {
    const usuario = this.apiService.usuarioAutenticado;
    if (usuario) {
      this.usuarioNombre = `${usuario.name} ${usuario.lastName}`;
      this.usuarioRol = usuario.rol;
    }
    this.router.events.subscribe(e => {
      if (e instanceof NavigationStart) {
        this.pageLoading.start();
      }
    });

    this.pageLoading.loading$.subscribe(loading => {
      if (!loading) {
        this.isEntering = false;
        requestAnimationFrame(() => {
          this.isEntering = true;
          setTimeout(() => (this.isEntering = false), 260); // 250ms + margen
        });
      }
    });
  }

  cambiarRol(nuevoRol: string) {
    const usuario = this.apiService.usuarioAutenticado;
    if (!usuario) return;

    this.apiService.updateUsuario(usuario.idUser || usuario.id_user, { rol: nuevoRol }).subscribe({
      next: () => {
        this.toastService.mostrarMensaje(`✅ Rol cambiado a ${nuevoRol}`);
        this.usuarioRol = nuevoRol;
        setTimeout(() => window.location.reload(), 1000);
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al cambiar el rol')
    });
  }

  logout(): void {
    this.apiService.logout();
    this.toastService.mostrarMensaje('✅ Sesión cerrada con éxito');
    this.usuarioNombre = '';
    this.estaSeleccionado = false;
    this.router.navigate(['/']);
  }

  irAUsuarios(): void {
    this.estaSeleccionado = true;
    this.router.navigate(['/view/usuarios']);
  }
}