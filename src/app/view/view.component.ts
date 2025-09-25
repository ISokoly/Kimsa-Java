import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MenuComponent } from '../components/menu/menu.component';
import { ApiService } from '../core/services/api.service';
import { CommonModule } from '@angular/common';
import { MensajeToast, ToastService } from '../core/services/toast.service';


@Component({
  selector: 'app-view',
  imports: [
    RouterOutlet,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MenuComponent,
    CommonModule
  ],
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss'
})
export class ViewComponent {
  usuarioNombre = '';

  collapsed = signal(false);
  estaSeleccionado = false;

  sidenavWidth = computed(() => this.collapsed() ? '65px' : '250px');
  isUsuariosPage: boolean = false;
  static estaSeleccionado: boolean;

  constructor(private router: Router, private apiService: ApiService, private toastService: ToastService) {
    this.router.events.subscribe(() => {
      this.isUsuariosPage = this.router.url.startsWith('/view/usuarios');
    });
  }

  ngOnInit() {
    const usuario = this.apiService.usuarioAutenticado;
    if (usuario) {
      this.usuarioNombre = `${usuario.name} ${usuario.lastName}`;
    }
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