import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';

import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-otros',
  standalone: true,
  imports: [
    FormsModule,
    MatInputModule,
    MatGridListModule,
    MatButtonModule,
    MatSelectModule,
    MatOptionModule,
    MatTableModule
  ],
  templateUrl: './otros.component.html',
  styleUrls: ['./otros.component.scss']
})
export class OtrosComponent implements OnInit {

  /* ==================== PROPIEDADES ==================== */
  usuario: any;
  listaUsuarios: any[] = [];
  listaFiltrada: any[] = [];

  mostrarFormulario = false;
  mostrarFormularioCrear = false;
  mostrarFormularioContrasena = false;

  filtroTexto: string = '';
  filtroRol: string = '';
  filtroEstado: string = '';
  filtroPor: 'username' | 'dni' = 'username';

  Empleado = {
    username: '',
    name: '',
    lastName: '',
    dni: '',
    direction: '',
    numberPhone: '',
    password: '',
    rol: '',
    disabled: false,
    confirmarPassword: '',
    passwordActual: '',
    nuevaPassword: ''
  };

  displayedColumns: string[] = [
    'username',
    'name',
    'dni',
    'rol',
    'numberPhone',
    'direction',
    'estado',
    'acciones'
  ];

  userSeleccionado: any = null;

  constructor(private apiService: ApiService, private toastService: ToastService) { }

  ngOnInit(): void {
    this.refrescarListados();
    this.listaFiltrada = [...this.listaUsuarios];
  }

  /* ==================== CARGA DE DATOS ==================== */
  private refrescarListados(): void {
    this.obtenerUsuario();
    this.apiService.getUsuarios().subscribe(data => {
      this.listaUsuarios = data;
      this.listaFiltrada = this.listaUsuarios.filter(
        u => u.idUser !== this.apiService.getUsuarioActual().idUser
      );
    });
  }

  obtenerUsuario(): void {
    const usuario = this.apiService.getUsuarioActual();
    if (!usuario) {
      this.toastService.mostrarMensaje('❌ No se encontró un usuario autenticado');
      return;
    }
    this.usuario = usuario;
  }

  /* ==================== FORMULARIO ==================== */
  abrirFormulario(usuario: any): void {
    this.userSeleccionado = { ...usuario };
    this.Empleado = { ...usuario, password: '' }; // 👈 no modificas el original
    this.mostrarFormulario = true;
  }

  cerrarFormulario(): void {
    if (this.mostrarFormulario === true) {
      this.mostrarFormulario = false;
    } else if (this.mostrarFormularioCrear === true) {
      this.mostrarFormularioCrear = false;
    }
    this.Empleado = {
      username: '',
      name: '',
      lastName: '',
      dni: '',
      direction: '',
      numberPhone: '',
      password: '',
      rol: '',
      nuevaPassword: '',
      passwordActual: '',
      confirmarPassword: '',
      disabled: false
    };
    this.userSeleccionado = null;
  }

  crearUsuario(): void {
    this.userSeleccionado = null;
    this.Empleado = {
      username: '',
      name: '',
      lastName: '',
      dni: '',
      direction: '',
      numberPhone: '',
      password: '',
      rol: '',
      disabled: false,
      confirmarPassword: '',
      passwordActual: '',
      nuevaPassword: ''
    };
    this.mostrarFormularioCrear = true;
  }

  abrirFormularioContrasena(usuario: any): void {
    this.userSeleccionado = usuario;
    this.mostrarFormularioContrasena = true;
  }

  /* ==================== CREAR / ACTUALIZAR ==================== */
  guardarEmpleado(): void {
    if (!this.userSeleccionado) {
      this.toastService.mostrarMensaje('❌ Solo se puede actualizar usuarios existentes');
      return;
    }

    const id = this.userSeleccionado.idUser;
    this.apiService.updateUsuario(id, this.Empleado).subscribe(
      () => {
        this.toastService.mostrarMensaje('✅ Usuario actualizado correctamente');
        this.refrescarListados();
        this.cerrarFormulario();
      },
      () => this.toastService.mostrarMensaje('❌ Error al actualizar usuario')
    );
  }

  guardarNuevoEmpleado(): void {
    if (!this.Empleado.username || !this.Empleado.name || !this.Empleado.lastName ||
      !this.Empleado.dni || !this.Empleado.password || !this.Empleado.rol) {
      this.toastService.mostrarMensaje('❌ Todos los campos son obligatorios');
      return;
    }

    if (this.Empleado.dni.length !== 8) {
      this.toastService.mostrarMensaje('❌ El DNI debe tener 8 dígitos');
      return;
    }

    if (this.Empleado.numberPhone && this.Empleado.numberPhone.length !== 9) {
      this.toastService.mostrarMensaje('❌ El teléfono debe tener 9 dígitos');
      return;
    }

    this.apiService.createUsuario(this.Empleado).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Usuario creado correctamente');
        this.cerrarFormulario();
        this.refrescarListados();
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
        this.mostrarFormularioContrasena = false;
        this.Empleado.nuevaPassword = '';
        this.Empleado.confirmarPassword = '';
      },
      error: () => this.toastService.mostrarMensaje('❌ Error al actualizar la contraseña')
    });
  }

  /* ==================== HABILITAR / DESHABILITAR ==================== */
  deshabilitarUsuario(id: number): void {
    if (confirm('¿Seguro que deseas deshabilitar este usuario?')) {
      this.apiService.updateUsuario(id, { disabled: true }).subscribe(
        () => {
          this.toastService.mostrarMensaje('✅ Usuario deshabilitado correctamente');
          this.refrescarListados();
        },
        () => this.toastService.mostrarMensaje('❌ Error al deshabilitar usuario')
      );
    }
  }

  habilitarUsuario(id: number): void {
    this.apiService.updateUsuario(id, { disabled: false }).subscribe(
      () => {
        this.toastService.mostrarMensaje('✅ Usuario habilitado correctamente');
        this.refrescarListados();
      },
      () => this.toastService.mostrarMensaje('❌ Error al habilitar usuario')
    );
  }

  /* ==================== FILTROS ==================== */
  aplicarFiltro() {
    this.listaFiltrada = this.listaUsuarios.filter(usuario => {
      if (usuario.idUser === this.apiService.getUsuarioActual()?.idUser) {
        return false;
      }

      const campo = this.filtroPor;
      const coincideTexto = this.filtroTexto
        ? usuario[campo]?.toLowerCase().includes(this.filtroTexto.toLowerCase())
        : true;
      const coincideRol = this.filtroRol ? usuario.rol === this.filtroRol : true;
      const coincideEstado = this.filtroEstado
        ? (this.filtroEstado === 'habilitado' ? !usuario.disabled : usuario.disabled)
        : true;

      return coincideTexto && coincideRol && coincideEstado;
    });
  }

  /* ==================== UTILIDADES ==================== */
  soloNumeros(event: KeyboardEvent): void {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }
}