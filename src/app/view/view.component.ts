// view.component.ts
import { Component, computed, inject, signal, OnDestroy, AfterViewInit, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService } from '../core/services/api.service';
import { ToastService } from '../core/services/toast.service';
import { MenuComponent } from '../components/menu/menu.component';
import { PageLoadingService } from '../core/services/page-loading.service';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { toSignal } from '@angular/core/rxjs-interop';

import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

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
export class ViewComponent implements OnInit, AfterViewInit, OnDestroy {
  usuarioNombre = '';
  usuarioRol = '';
  collapsed = signal(false);
  estaSeleccionado = false;
  static estaSeleccionado: boolean;
  ready = false;
  isLoading = false;

  sidenavWidth = computed(() => (this.collapsed() ? '65px' : '250px'));
  isUsuariosPage = false;
  isEntering = false;

  private router = inject(Router);
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);
  private dialog = inject(MatDialog);
  public pageLoading = inject(PageLoadingService);

  private destroy$ = new Subject<void>();
  public loadingSig = toSignal(this.pageLoading.loading$, { initialValue: false });

  get usuarioAutenticado() {
    return this.apiService.usuarioAutenticado;
  }

  constructor() {
    const saved = localStorage.getItem('collapsed');
    if (saved != null) this.collapsed.set(saved === 'true');
  }

  ngOnInit(): void {
    const usuario = this.apiService.usuarioAutenticado;
    if (usuario) {
      this.usuarioNombre = `${usuario.name} ${usuario.lastName}`;
      this.usuarioRol = (usuario.rol as 'Administrator' | 'Employee') ?? '';
    }

    // Enciende spinner al iniciar navegación
    this.router.events
      .pipe(takeUntil(this.destroy$), filter(e => e instanceof NavigationStart))
      .subscribe((e: any) => {
        this.pageLoading.start();
        if (!e.url.startsWith('/view/usuarios')) this.estaSeleccionado = false;
      });

    // ✅ Apaga spinner cuando la navegación termina, se cancela o falla
    this.router.events
      .pipe(
        takeUntil(this.destroy$),
        filter(e => e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError)
      )
      .subscribe(() => {
        this.pageLoading.stop();                  // ✅ APAGA AQUÍ
      });

    // animación de entrada cuando el spinner pasa a false (puedes dejarlo)
    this.pageLoading.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        if (!loading) {
          this.isEntering = false;
          requestAnimationFrame(() => {
            this.isEntering = true;
            setTimeout(() => (this.isEntering = false), 260);
          });
        }
      });
  }

  ngAfterViewInit(): void {
    setTimeout(() => (this.ready = true));
  }

  ngOnDestroy(): void {
    this.pageLoading.stop();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // === acciones UI ===
  toggleCollapse(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    localStorage.setItem('collapsed', String(next));
  }

  cambiarRol(nuevoRol: string): void {
    const usuario = this.apiService.usuarioAutenticado;
    if (!usuario) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      maxWidth: '95vw',
      panelClass: 'custom-confirm-dialog',
      disableClose: true,
      data: { title: 'Cambiar de rol', message: `¿Seguro que deseas cambiar el rol a ${nuevoRol}?` }
    });

    dialogRef.afterClosed().subscribe(ok => {
      if (!ok) return;
      this.isLoading = true;
      this.apiService.updateUsuario(usuario.idUser!, { rol: nuevoRol }).subscribe({
        next: () => {
          this.toastService.mostrarMensaje(`✅ Rol cambiado a ${nuevoRol}`);
          this.usuarioRol = nuevoRol;
          setTimeout(() => window.location.reload(), 1000);
        },
        error: () => {
          this.toastService.mostrarMensaje('❌ Error al cambiar el rol');
          this.isLoading = false;
        }
      });
    });
  }

  logout(): void {
    this.pageLoading.stop();
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