// src/app/login/login.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../core/services/api.service';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatIconModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  usuario = '';
  contrasena = '';
  error = '';
  isLoading = false;
  hide = true;

  constructor(private api: ApiService, private router: Router, private toast: ToastService) {}

  login() {
    if (this.isLoading) return;
    this.error = '';
    this.isLoading = true;

    this.api.login(this.usuario, this.contrasena).subscribe({
      next: () => {
        // ✅ Ya tenemos usuario en memoria (setUsuario en el service)
        this.toast.mostrarMensaje('✅ Sesión iniciada con éxito');
        this.isLoading = false;
        this.router.navigate(['/view']); // sin ensureUserReady()
      },
      error: (err) => {
        this.error = `❌ ${err?.message || 'Usuario o contraseña incorrectos'}`;
        this.toast.mostrarMensaje(this.error);
        this.contrasena = '';
        this.isLoading = false;
      }
    });
  }
}
