import { Component, computed, inject, signal, OnDestroy, AfterViewInit, OnInit, } from '@angular/core';
import {
  Router,
  RouterOutlet,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, UsuarioLigero } from '../core/services/api.service';
import { ToastService } from '../core/services/toast.service';
import { MenuComponent } from '../components/menu/menu.component';
import { PageLoadingService } from '../core/services/page-loading.service';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';

import { toSignal } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { filter, map, startWith, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    // Material
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    // propios
    MenuComponent,
  ],
  templateUrl: './view.component.html',
  styleUrl: './view.component.scss',
})
export class ViewComponent implements OnInit, AfterViewInit, OnDestroy {
  // UI
  usuarioNombre = '';
  usuarioRol: 'Administrator' | 'Employee' | '' = '';
  collapsed = signal(false);
  estaSeleccionado = false;
  static estaSeleccionado: boolean;
  ready = false;
  isLoading = false;

  sidenavWidth = computed(() => (this.collapsed() ? '65px' : '250px'));
  isUsuariosPage = false;
  isEntering = false;

  // inyecciones
  private router = inject(Router);
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);
  private dialog = inject(MatDialog);
  public pageLoading = inject(PageLoadingService);

  // subs
  private destroy$ = new Subject<void>();
  public loadingSig = toSignal(this.pageLoading.loading$, { initialValue: false });

  get usuarioAutenticado() {
    return this.apiService.usuarioAutenticado;
  }

  constructor() {
    const saved = localStorage.getItem('collapsed');
    if (saved != null) this.collapsed.set(saved === 'true');
  }

  // ---------- helpers ----------
  private setUsuarioEnCabecera = (u: UsuarioLigero | null) => {
    const nombre = (u?.name ?? '').trim();
    const apell = (u?.lastName ?? '').trim();
    this.usuarioNombre = (nombre || apell) ? `${nombre} ${apell}`.trim() : '';
    this.usuarioRol = (u?.rol as 'Administrator' | 'Employee') ?? '';
  };

  // ---------- ciclo de vida ----------
  ngOnInit(): void {
    // Suscribirse a cambios del usuario en memoria (refresca nombre/rol en vivo)
    this.apiService.usuarioActual
      .pipe(takeUntil(this.destroy$))
      .subscribe(u => this.setUsuarioEnCabecera(u));

    // Hidratar si se recarga la página y aún no hay usuario en memoria
    if (!this.apiService.usuarioAutenticado) {
      this.apiService.ensureUserReady().then(() => {
        this.setUsuarioEnCabecera(this.apiService.usuarioAutenticado);
      });
    }

    // Router → spinner global + reset selecciones
    this.router.events
      .pipe(
        takeUntil(this.destroy$),
        filter(e => e instanceof NavigationStart)
      )
      .subscribe((e: any) => {
        this.pageLoading.start();
        if (!e.url.startsWith('/view/usuarios')) this.estaSeleccionado = false;
      });

    // Detectar si estamos en /view/usuarios
    this.router.events
      .pipe(
        takeUntil(this.destroy$),
        filter(e => e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError),
        map(() => this.router.url),
        startWith(this.router.url)
      )
      .subscribe(url => {
        this.isUsuariosPage = url.startsWith('/view/usuarios');
      });

    // Animación de entrada al terminar el loading global
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
    // Evita NG0100 al activar animaciones/clases
    setTimeout(() => (this.ready = true), 0);
  }

  ngOnDestroy(): void {
    this.pageLoading.stop();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- acciones UI ----------
  toggleCollapse(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    localStorage.setItem('collapsed', String(next));
  }

  cambiarRol(nuevoRol: string): void {
    const usuario = this.apiService.usuarioAutenticado;
    if (!usuario) return;

    const id = usuario.idUser;
    if (id == null) {
      this.toastService.mostrarMensaje('❌ No se encontró el ID del usuario.');
      return;
    }

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
      this.apiService.updateUsuario(id, { rol: nuevoRol }).subscribe({
        next: () => {
          this.toastService.mostrarMensaje(`✅ Rol cambiado a ${nuevoRol}`);
          this.usuarioRol = nuevoRol as any;
          setTimeout(() => window.location.reload(), 750);
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

    this.router.navigate(['/login']);   // ve directo a /login para no disparar guards
  }

  irAUsuarios(): void {
    this.estaSeleccionado = true;
    this.router.navigate(['/view/usuarios']);
  }
}