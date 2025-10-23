import { Component, inject } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { CommonModule } from '@angular/common';

import { MensajeToast, ToastService } from './core/services/toast.service';
import { OverlayPortalService } from './core/services/overlay-portal.service';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, CommonModule,
    MatToolbarModule, MatButtonModule, MatIconModule, MatSidenavModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  overlay = inject(OverlayPortalService);
  private toastService = inject(ToastService);

  mensajes: MensajeToast[] = [];

  trackByMensajeId = (_: number, m: MensajeToast) => m.id;
  trackByOverlay = (_: number, e: { id: number }) => e.id;

  ngOnInit() {
    this.toastService.mensajes$.subscribe(m => (this.mensajes = m));
  }

  cerrarMensaje(m: MensajeToast) {
    this.toastService.eliminarMensaje(m.id);
  }
}
