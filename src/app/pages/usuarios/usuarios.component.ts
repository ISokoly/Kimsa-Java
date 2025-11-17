import { Component, inject, OnInit, TemplateRef, ViewChild, AfterViewInit, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MatInputModule } from '@angular/material/input';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';

import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { OverlayHandle, OverlayPortalService } from '../../core/services/overlay-portal.service';
import { ConfirmDialogComponent } from '../../view/confirm-dialog/confirm-dialog.component';
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
    MatDividerModule,
  ],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.scss']
})
export class UsuariosComponent implements OnInit, AfterViewInit {
  contentReady = false;

  usuario: any;
  Empleado = {
    username: '', name: '', lastName: '', dni: '', direction: '', numberPhone: '',
    password: '', rol: '', disabled: false, passwordActual: '', nuevaPassword: ''
  };

  userSeleccionado: any = null;
  isLoading = false;

  @ViewChild('root') root!: ElementRef<HTMLElement>;
  @ViewChild('formUsuarioTpl') formUsuarioTpl!: TemplateRef<any>;
  @ViewChild('formPasswordTpl') formPasswordTpl!: TemplateRef<any>;

  private overlay = inject(OverlayPortalService);
  private userFormRef?: OverlayHandle;
  private passFormRef?: OverlayHandle;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private toastService: ToastService,
    private dialog: MatDialog,
    private pageLoading: PageLoadingService,           // 👈 inyectado
  ) { }

  ngOnInit(): void {
    const u = this.apiService.getUsuarioActual() ?? this.apiService.usuarioAutenticado;
    this.usuario = u || null;

    this.contentReady = true;
    queueMicrotask(() => this.pageLoading.stop());
  }

  ngAfterViewInit(): void {
    const el = this.root?.nativeElement;
    if (el) {
      el.classList.add('intro');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.classList.add('ready');
        });
      });
    }
  }

  // ===== Navegación =====
  verOtros() { this.router.navigate(['/view/usuarios/otros']); }
  verMesas() { this.router.navigate(['/view/usuarios/mesas']); }
  verProveedores() { this.router.navigate(['/view/usuarios/proveedores']); }
  verClientes() { this.router.navigate(['/view/usuarios/clientes']); }
  verDescuentos() { this.router.navigate(['/view/usuarios/descuentos']); }

  // ===== Formularios (overlay) =====
  abrirFormulario(usuario: any): void {
    this.userSeleccionado = { ...usuario };
    this.Empleado = { ...usuario, password: '', passwordActual: '', nuevaPassword: '' };
    this.userFormRef?.close();
    this.userFormRef = this.overlay.open(this.formUsuarioTpl);
  }

  cerrarFormulario(): void {
    this.userFormRef?.close();
    this.userFormRef = undefined;
    this.userSeleccionado = null;
    this.resetEmpleado();
  }

  abrirCambiarContrasena(): void {
    this.passFormRef?.close();
    this.passFormRef = this.overlay.open(this.formPasswordTpl);
  }

  cerrarCambiarContrasena(): void {
    this.passFormRef?.close();
    this.passFormRef = undefined;
    this.Empleado.passwordActual = '';
    this.Empleado.nuevaPassword = '';
  }

  private resetEmpleado(): void {
    this.Empleado = {
      username: '', name: '', lastName: '', dni: '', direction: '', numberPhone: '',
      password: '', rol: '', disabled: false, passwordActual: '', nuevaPassword: ''
    };
  }

  // ===== Guardar usuario =====
  guardarEmpleado(): void {
    if (!this.userSeleccionado) {
      this.toastService.mostrarMensaje('❌ Solo se puede actualizar usuarios existentes');
      return;
    }

    if (!/^\d{8}$/.test(this.Empleado.dni || '')) {
      this.toastService.mostrarMensaje('❌ El DNI debe tener 8 números');
      return;
    }
    if (!/^\d{9}$/.test(this.Empleado.numberPhone || '')) {
      this.toastService.mostrarMensaje('❌ El teléfono debe tener 9 números');
      return;
    }

    const id = this.userSeleccionado.idUser;
    const body: any = {
      username: this.Empleado.username,
      name: this.Empleado.name,
      lastName: this.Empleado.lastName,
      dni: this.Empleado.dni,
      direction: this.Empleado.direction,
      numberPhone: this.Empleado.numberPhone,
      rol: this.Empleado.rol,
      disabled: this.Empleado.disabled
    };
    if (this.Empleado.password) body.password = this.Empleado.password;

    this.isLoading = true;
    this.pageLoading.start();
    this.apiService.updateUsuario(id, body).subscribe({
      next: (usuarioActualizado) => {
        if (usuarioActualizado?.idUser === (this.usuario?.idUser ?? this.usuario?.id_user)) {
          this.usuario = usuarioActualizado;
          localStorage.setItem('usuario', JSON.stringify(usuarioActualizado));
        }
        this.cerrarFormulario();
        this.isLoading = false;
        this.pageLoading.stop();
      },
      error: () => {
        this.toastService.mostrarMensaje('❌ Error al actualizar usuario');
        this.isLoading = false;
        this.pageLoading.stop();
      }
    });
  }

  // ===== Habilitar/Deshabilitar =====
  deshabilitarUsuario(id: number | undefined): void {
    if (!id) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px', maxWidth: '95vw', panelClass: 'custom-confirm-dialog',
      disableClose: true,
      data: { title: 'Deshabilitar usuario', message: '¿Seguro que deseas deshabilitar tu usuario?' }
    });

    dialogRef.afterClosed().subscribe(ok => {
      if (!ok) return;

      const idActual = this.usuario?.idUser ?? this.usuario?.id;
      this.isLoading = true;
      this.pageLoading.start();

      this.apiService.updateUsuario(id, { disabled: true }).subscribe({
        next: () => {
          if (idActual === id) {
            this.toastService.mostrarMensaje('✅ Tu cuenta fue deshabilitada. Cerrando sesión...');
            setTimeout(() => this.logout(), 1200);
          } else {
            this.toastService.mostrarMensaje('✅ Usuario deshabilitado correctamente');
            this.isLoading = false;
            this.pageLoading.stop();
          }
        },
        error: () => {
          this.toastService.mostrarMensaje('❌ Error al deshabilitar usuario');
          this.isLoading = false;
          this.pageLoading.stop();
        }
      });
    });
  }

  // ===== Contraseña =====
  guardarNuevaContrasena(): void {
    if (!this.userSeleccionado) {
      this.toastService.mostrarMensaje('❌ Debe seleccionar un usuario primero');
      return;
    }
    if (!this.Empleado.passwordActual || !this.Empleado.nuevaPassword) {
      this.toastService.mostrarMensaje('❌ Debe ingresar ambas contraseñas');
      return;
    }

    const id = this.userSeleccionado.idUser;
    const payload = { actual: this.Empleado.passwordActual, nueva: this.Empleado.nuevaPassword };

    this.isLoading = true;
    this.pageLoading.start();                               // 🔹 opcional

    this.apiService.cambiarPassword(id, payload).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Contraseña actualizada correctamente');
        this.cerrarCambiarContrasena();
        this.isLoading = false;
        this.pageLoading.stop();
      },
      error: (error) => {
        if (error.status === 400) this.toastService.mostrarMensaje('❌ Contraseña actual incorrecta');
        else this.toastService.mostrarMensaje('❌ Error al actualizar la contraseña');
        this.isLoading = false;
        this.pageLoading.stop();
      }
    });
  }

  // ===== Util =====
  soloNumeros(event: KeyboardEvent): void {
    const code = event.which ? event.which : (event as any).keyCode;
    if (code < 48 || code > 57) event.preventDefault();
  }

  logout(): void {
    this.apiService.logout();
    location.reload();
  }
}
