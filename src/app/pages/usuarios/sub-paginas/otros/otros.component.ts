import { Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';

import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { OverlayHandle, OverlayPortalService } from '../../../../core/services/overlay-portal.service';
import { ConfirmDialogComponent } from '../../../../view/confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { PageLoadingService } from '../../../../core/services/page-loading.service';

@Component({
  selector: 'app-otros',
  standalone: true,
  imports: [
    FormsModule, MatInputModule, MatGridListModule,
    MatButtonModule, MatSelectModule, MatOptionModule, MatTableModule
  ],
  templateUrl: './otros.component.html',
  styleUrls: ['./otros.component.scss']
})
export class OtrosComponent implements OnInit {

  usuario: any;
  listaUsuarios: any[] = [];
  listaFiltrada: any[] = [];

  filtroTexto: string = '';
  filtroRol: string = '';
  filtroEstado: string = '';
  filtroPor: 'username' | 'dni' = 'username';

  displayedColumns: string[] = [
    'username', 'name', 'dni', 'rol', 'numberPhone', 'direction', 'estado', 'acciones'
  ];

  Empleado = {
    username: '', name: '', lastName: '', dni: '', direction: '', numberPhone: '', password: '', rol: '', disabled: false, confirmarPassword: '', passwordActual: '', nuevaPassword: ''
  };

  userSeleccionado: any = null;

  @ViewChild('formEditarTpl') formEditarTpl!: TemplateRef<any>;
  @ViewChild('formCrearTpl') formCrearTpl!: TemplateRef<any>;
  @ViewChild('formPasswordTpl') formPasswordTpl!: TemplateRef<any>;

  private overlay = inject(OverlayPortalService);
  private editRef?: OverlayHandle;
  private createRef?: OverlayHandle;
  private passRef?: OverlayHandle;

  constructor(private apiService: ApiService, private toastService: ToastService, private dialog: MatDialog, private pageLoading: PageLoadingService) { }

  ngOnInit(): void {
    this.pageLoading.start();
    this.cargarOtrosUsuarios();
    this.listaFiltrada = [...this.listaUsuarios];
  }

  /* ====== Datos ====== */
  private cargarOtrosUsuarios(): void {
    this.obtenerUsuario();
    this.apiService.getUsuarios().subscribe(data => {
      this.listaUsuarios = data || [];
      const actual = this.apiService.getUsuarioActual();
      this.listaFiltrada = this.listaUsuarios.filter(u => u.idUser !== actual?.idUser);
      this.aplicarFiltro();
    });
    this.pageLoading.stop();
  }

  obtenerUsuario(): void {
    const usuario = this.apiService.getUsuarioActual();
    if (!usuario) {
      this.toastService.mostrarMensaje('❌ No se encontró un usuario autenticado');
      return;
    }
    this.usuario = usuario;
    this.pageLoading.stop();
  }

  /* ====== Formularios (overlay) ====== */
  abrirFormulario(usuario: any): void {
    this.userSeleccionado = { ...usuario };
    this.Empleado = { ...usuario, password: '' };
    this.editRef?.close();
    this.editRef = this.overlay.open(this.formEditarTpl);
  }

  crearUsuario(): void {
    this.userSeleccionado = null;
    this.Empleado = {
      username: '', name: '', lastName: '', dni: '', direction: '',
      numberPhone: '', password: '', rol: '', disabled: false,
      confirmarPassword: '', passwordActual: '', nuevaPassword: ''
    };
    this.createRef?.close();
    this.createRef = this.overlay.open(this.formCrearTpl);
  }

  abrirFormularioContrasena(usuario: any): void {
    this.userSeleccionado = usuario;
    this.Empleado.nuevaPassword = '';
    this.Empleado.confirmarPassword = '';
    this.passRef?.close();
    this.passRef = this.overlay.open(this.formPasswordTpl);
  }

  cerrarFormulario(): void {
    this.editRef?.close(); this.editRef = undefined;
    this.createRef?.close(); this.createRef = undefined;
    this.resetEmpleado();
  }

  cerrarFormularioContrasena(): void {
    this.passRef?.close(); this.passRef = undefined;
    this.Empleado.nuevaPassword = '';
    this.Empleado.confirmarPassword = '';
  }

  private resetEmpleado(): void {
    this.Empleado = {
      username: '', name: '', lastName: '', dni: '',
      direction: '', numberPhone: '', password: '', rol: '',
      disabled: false, confirmarPassword: '', passwordActual: '', nuevaPassword: ''
    };
    this.userSeleccionado = null;
  }

  /* ====== Crear / Actualizar ====== */
  guardarEmpleado(): void {
    if (!this.userSeleccionado) {
      this.toastService.mostrarMensaje('❌ Solo se puede actualizar usuarios existentes');
      return;
    }
    const id = this.userSeleccionado.idUser;
    this.apiService.updateUsuario(id, this.Empleado).subscribe(
      () => {
        this.toastService.mostrarMensaje('✅ Usuario actualizado correctamente');
        this.cargarOtrosUsuarios();
        this.cerrarFormulario();
      },
      () => this.toastService.mostrarMensaje('❌ Error al actualizar usuario')
    );
  }

  guardarNuevoEmpleado(): void {
    const e = this.Empleado;
    if (!e.username || !e.name || !e.lastName || !e.dni || !e.password || !e.rol) {
      this.toastService.mostrarMensaje('❌ Todos los campos son obligatorios');
      return;
    }
    if (String(e.dni).length !== 8) {
      this.toastService.mostrarMensaje('❌ El DNI debe tener 8 dígitos');
      return;
    }
    if (e.numberPhone && String(e.numberPhone).length !== 9) {
      this.toastService.mostrarMensaje('❌ El teléfono debe tener 9 dígitos');
      return;
    }

    this.apiService.createUsuario(e).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Usuario creado correctamente');
        this.cerrarFormulario();
        this.cargarOtrosUsuarios();
      },
      error: (err) => {
        this.toastService.mostrarMensaje('❌ Error al crear el usuario');
        console.error(err);
      }
    });
  }

  guardarNuevaContrasena(): void {
    if (!this.userSeleccionado) {
      this.toastService.mostrarMensaje('❌ Debe seleccionar un usuario primero');
      return;
    }
    if (!this.Empleado.nuevaPassword || !this.Empleado.confirmarPassword) {
      this.toastService.mostrarMensaje('❌ Debe ingresar y confirmar la contraseña');
      return;
    }
    if (this.Empleado.nuevaPassword !== this.Empleado.confirmarPassword) {
      this.toastService.mostrarMensaje('❌ Las contraseñas no coinciden');
      return;
    }

    const id = this.userSeleccionado.idUser;
    const payload = { nueva: this.Empleado.nuevaPassword };

    this.apiService.cambiarPasswordByAdmin(id, payload).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Contraseña actualizada correctamente');
        this.cerrarFormularioContrasena();
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al actualizar la contraseña')
    });
  }

  /* ====== Habilitar / Deshabilitar ====== */
  deshabilitarUsuario(id: number): void {
    const usuario = this.listaUsuarios.find(u => u.idUser === id);

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      maxWidth: '95vw',
      panelClass: 'custom-confirm-dialog',
      disableClose: true,
      data: {
        title: 'Deshabilitar usuario',
        message: `¿Seguro que deseas deshabilitar a "${usuario ? usuario.name + ' ' + usuario.lastName : 'este usuario'}"?`
      }
    });

    dialogRef.afterClosed().subscribe(ok => {
      if (!ok) return;
      const body = usuario ? {
        username: usuario.username,
        name: usuario.name,
        lastName: usuario.lastName,
        dni: usuario.dni,
        direction: usuario.direction,
        numberPhone: usuario.numberPhone,
        rol: usuario.rol,
        disabled: true
      } : { disabled: true };

      this.apiService.updateUsuario(id, body).subscribe({
        next: () => {
          this.toastService.mostrarMensaje('✅ Usuario deshabilitado correctamente');
          this.cargarOtrosUsuarios();
        },
        error: () => this.toastService.mostrarMensaje('❌ Error al deshabilitar usuario')
      });
    });
  }

  habilitarUsuario(id: number): void {
    const usuario = this.listaUsuarios.find(u => u.idUser === id);
    const body = usuario ? {
      username: usuario.username,
      name: usuario.name,
      lastName: usuario.lastName,
      dni: usuario.dni,
      direction: usuario.direction,
      numberPhone: usuario.numberPhone,
      rol: usuario.rol,
      disabled: false
    } : { disabled: false };

    this.apiService.updateUsuario(id, body).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Usuario habilitado correctamente');
        this.cargarOtrosUsuarios();
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al habilitar usuario')
    });
  }

  /* ====== Filtros ====== */
  aplicarFiltro() {
    const actualId = this.apiService.getUsuarioActual()?.idUser;
    const texto = (this.filtroTexto || '').toString().toLowerCase().trim();

    this.listaFiltrada = this.listaUsuarios.filter(u => {
      if (u.idUser === actualId) return false;

      const fuente = this.filtroPor === 'dni'
        ? String(u.dni ?? '').toLowerCase()
        : String(u.username ?? '').toLowerCase();

      const coincideTexto = texto ? fuente.includes(texto) : true;
      const coincideRol = this.filtroRol ? u.rol === this.filtroRol : true;
      const coincideEstado = this.filtroEstado
        ? (this.filtroEstado === 'habilitado' ? !u.disabled : u.disabled)
        : true;

      return coincideTexto && coincideRol && coincideEstado;
    });
  }

  /* ====== Util ====== */
  soloNumeros(event: KeyboardEvent): void {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) event.preventDefault();
  }
}
