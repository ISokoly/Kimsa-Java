import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

// Material Modules
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

import { ApiService } from '../core/services/api.service';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  usuario: string = '';
  contrasena: string = '';
  error: string = '';

  constructor(private apiService: ApiService, private router: Router, private toastService: ToastService) { }

  login() {
    this.apiService.login(this.usuario, this.contrasena).subscribe({
      next: () => {
        this.toastService.mostrarMensaje('✅ Sesión iniciada con éxito');
        this.router.navigate(['/view']);
      },
      error: (err) => {
        let mensaje = err.error?.message || err.message || 'Usuario o contraseña incorrectos';
        if (!mensaje.startsWith('❌')) {
          mensaje = `❌ ${mensaje}`;
        }
        this.toastService.mostrarMensaje(mensaje);
        this.contrasena = '';
      }
    });
  }
}