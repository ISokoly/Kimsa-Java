import { Component, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ViewComponent } from '../../view/view.component';
import { ToastService } from '../../core/services/toast.service';

import { MatInputModule } from '@angular/material/input';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from "@angular/material/card";
import { MatListModule } from "@angular/material/list";
import { OverlayHandle, OverlayPortalService } from '../../core/services/overlay-portal.service';
import { ConfirmDialogComponent } from '../../view/confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { PageLoadingService } from '../../core/services/page-loading.service';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [
    FormsModule,
    MatInputModule,
    MatGridListModule,
    MatButtonModule,
    MatCardModule,
    MatListModule,
  ],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.scss']
})
export class UsuariosComponent implements OnInit {

  /* ==================== DATOS ==================== */
  usuario: any;
  empleados: any[] = [];
  administradores: any[] = [];
  mostrarFormularioContrasena = false;

  Empleado = {
    username: '', name: '', lastName: '', dni: '', direction: '', numberPhone: '',
    password: '', rol: '', disabled: false, passwordActual: '', nuevaPassword: ''
  };

  userSeleccionado: any = null;
  isLoading = false;

  @ViewChild('formUsuarioTpl') formUsuarioTpl!: TemplateRef<any>;
  @ViewChild('formPasswordTpl') formPasswordTpl!: TemplateRef<any>;

  private overlay = inject(OverlayPortalService);

  private userFormRef?: OverlayHandle;
  private passFormRef?: OverlayHandle;
  /* ==================== CONSTRUCTOR ==================== */
  constructor(private apiService: ApiService, private router: Router, private toastService: ToastService, private dialog: MatDialog, private pageLoading: PageLoadingService) { }

  /* ==================== CICLO DE VIDA ==================== */
  ngOnInit(): void {
    this.pageLoading.start();
    this.refrescarDatos();
  }

  /* ==================== CARGA DE DATOS ==================== */
  refrescarDatos(): void {
    this.obtenerUsuario();
    this.pageLoading.stop();
  }

  obtenerUsuario(): void {
    const usuario = this.apiService.getUsuarioActual();
    if (!usuario) {
      this.toastService.mostrarMensaje('❌ No se encontró un usuario autenticado');
      this.pageLoading.stop();
      return;
    }
    this.usuario = usuario;
    this.pageLoading.stop();
  }

  /* ==================== NAVEGACIÓN ==================== */
  verOtros() { this.router.navigate(['/view/usuarios/otros']); ViewComponent.estaSeleccionado = true; }
  verMesas() { this.router.navigate(['/view/usuarios/mesas']); ViewComponent.estaSeleccionado = true; }
  verClientes() { this.router.navigate(['/view/usuarios/clientes']); ViewComponent.estaSeleccionado = true; }
  verDescuentos() { this.router.navigate(['/view/usuarios/descuentos']); ViewComponent.estaSeleccionado = true; }

  /* ==================== FORMULARIO ==================== */
  abrirFormulario(usuario: any): void {
    this.userSeleccionado = { ...usuario };
    this.Empleado = { ...usuario, password: '' };
    this.userFormRef = this.overlay.open(this.formUsuarioTpl);
  }

  cerrarFormulario(): void {
    this.userFormRef?.close();      // 👈 cierra SOLO el de usuario
    this.userFormRef = undefined;
    this.userSeleccionado = null;
    this.resetEmpleado();
  }

  abrirCambiarContrasena(): void {
    this.passFormRef = this.overlay.open(this.formPasswordTpl);
  }

  cerrarCambiarContrasena(): void {
    this.passFormRef?.close();
    this.passFormRef = undefined;
    this.mostrarFormularioContrasena = false;
    this.Empleado.passwordActual = '';
    this.Empleado.nuevaPassword = '';
  }

  private resetEmpleado(): void {
    this.Empleado = {
      username: '', name: '', lastName: '', dni: '', direction: '', numberPhone: '',
      password: '', rol: '', disabled: false, passwordActual: '', nuevaPassword: ''
    };
  }

  /* ==================== GUARDAR USUARIO ==================== */
  guardarEmpleado(): void {
    if (!this.userSeleccionado) {
      this.toastService.mostrarMensaje('❌ Solo se puede actualizar usuarios existentes');
      return;
    }

    if (!/^\d{8}$/.test(this.Empleado.dni || '')) {
      return this.toastService.mostrarMensaje('❌ El DNI debe tener 8 números');
    }
    if (!/^\d{9}$/.test(this.Empleado.numberPhone || '')) {
      return this.toastService.mostrarMensaje('❌ El teléfono debe tener 9 números');
    }

    const id = this.userSeleccionado.idUser;
    const usuarioBackend: any = {
      username: this.Empleado.username,
      name: this.Empleado.name,
      lastName: this.Empleado.lastName,
      dni: this.Empleado.dni,
      direction: this.Empleado.direction,
      numberPhone: this.Empleado.numberPhone,
      rol: this.Empleado.rol,
      disabled: this.Empleado.disabled
    };

    if (this.Empleado.password) usuarioBackend.password = this.Empleado.password;

    this.isLoading = true;
    this.apiService.updateUsuario(id, usuarioBackend).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Usuario actualizado correctamente');
        this.refrescarDatos();
        this.cerrarFormulario();
        this.isLoading = false;
      },
      error: () => {
        this.toastService.mostrarMensaje('❌ Error al actualizar usuario');
        this.isLoading = false;
      }
    });
  }

  /* ==================== DESHABILITAR USUARIO ==================== */
  deshabilitarUsuario(id: number | undefined): void {
    if (!id) {
      console.error('ID inválido al intentar deshabilitar:', id);
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      maxWidth: '95vw',
      panelClass: 'custom-confirm-dialog',
      disableClose: true,
      data: {
        title: 'Deshabilitar usuario',
        message: '¿Seguro que deseas deshabilitar tu usuario?'
      }
    });

    dialogRef.afterClosed().subscribe(ok => {
      if (!ok) return;
      const usuarioActual = this.apiService.getUsuarioActual();
      const idActual = usuarioActual?.idUser ?? usuarioActual?.id;
      this.isLoading = true;

      this.apiService.updateUsuario(id, { disabled: true }).subscribe({
        next: () => {
          if (idActual === id) {
            this.toastService.mostrarMensaje('✅ Tu cuenta fue deshabilitada. Cerrando sesión...');
            setTimeout(() => this.logout(), 1500);
          } else {
            this.toastService.mostrarMensaje('✅ Usuario deshabilitado correctamente');
            this.refrescarDatos();
            this.isLoading = false;
          }
        },
        error: () => {
          this.toastService.mostrarMensaje('❌ Error al deshabilitar usuario');
          this.isLoading = false;
        }
      });
    });
  }
  /* ==================== CONTRASEÑA ==================== */
  guardarNuevaContrasena(): void {
    if (!this.userSeleccionado) {
      return this.toastService.mostrarMensaje('❌ Debe seleccionar un usuario primero');
    }
    if (!this.Empleado.passwordActual || !this.Empleado.nuevaPassword) {
      return this.toastService.mostrarMensaje('❌ Debe ingresar ambas contraseñas');
    }

    const id = this.userSeleccionado.idUser;
    const payload = { actual: this.Empleado.passwordActual, nueva: this.Empleado.nuevaPassword };
    this.isLoading = true;

    this.apiService.cambiarPassword(id, payload).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Contraseña actualizada correctamente');
        this.mostrarFormularioContrasena = false;
        this.Empleado.passwordActual = '';
        this.Empleado.nuevaPassword = '';
        this.isLoading = false;
      },
      error: (error) => {
        if (error.status === 400) this.toastService.mostrarMensaje('❌ Contraseña actual incorrecta');
        else this.toastService.mostrarMensaje('❌ Error al actualizar la contraseña');
        this.isLoading = false;
      }
    });
  }

  /* ==================== UTILIDADES ==================== */
  soloNumeros(event: KeyboardEvent): void {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) event.preventDefault();
  }

  logout(): void {
    this.apiService.logout();
    location.reload();
  }
}