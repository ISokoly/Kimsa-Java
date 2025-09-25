import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MensajeToast, ToastService } from './core/services/toast.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    CommonModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  mensajes: MensajeToast[] = [];

  constructor(private toastService: ToastService) {
  }

  ngOnInit() {
    this.toastService.mensajes$.subscribe(mensajes => {
      this.mensajes = mensajes;
    });
  }

  trackByMensajeId(index: number, mensaje: MensajeToast) {
    return mensaje.id;
  }

  cerrarMensaje(mensaje: MensajeToast) {
    this.toastService.eliminarMensaje(mensaje.id);
  }
}
