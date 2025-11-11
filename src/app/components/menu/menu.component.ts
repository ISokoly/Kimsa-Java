import { Component, computed, Input, signal } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { firstValueFrom } from 'rxjs';

type Categoria = { idCategory: number; name: string };

export type MenuItem = {
  icon: string;
  label: string;
  route?: string | any[];
  children?: Array<{ label: string; route: string | any[] }>;
};

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [MatListModule, MatIconModule, RouterLink, RouterLinkActive],
  template: `
  <div class="sidenav-header">
    <img src="kimsa_black.png" alt="" [width]="profilePicSize()">
    <div class="header-text" [class.hide-header-text]="sideNavCollpsed()">
      <h2>Kimsa</h2>
      <p>Pastas y Pizzas</p>
    </div>
  </div>
  <br><br>

  <mat-nav-list>
    @for (item of menuItems(); track $index) {

      <!-- ===== Productos con expansión ===== -->
      @if (item.label === 'Productos') {
        <mat-list-item
          class="menu-item"
          routerLinkActive="selected-menu-item"
          [routerLink]="item.route">

          <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>

          <ng-container matListItemTitle>
            @if (!sideNavCollpsed()) {
              <span class="title">{{ item.label }}</span>
            }
          </ng-container>

          @if (item.children?.length && !sideNavCollpsed()) {
            <button
              mat-icon-button
              matListItemMeta
              type="button" class="chev-abs"
              (click)="toggleExpand($event)"
              aria-label="Expandir productos">
              <mat-icon>{{ expanded() ? 'expand_more' : 'chevron_right' }}</mat-icon>
            </button>
          }
        </mat-list-item>

        @if (expanded() && !sideNavCollpsed() && item.children?.length) {
          <div class="submenu">
            @for (child of item.children; track child.label) {
              <mat-list-item
                class="submenu-item"
                routerLinkActive="selected-submenu-item"
                [routerLink]="child.route">
                <mat-icon matListItemIcon>label</mat-icon>
                <ng-container matListItemTitle>
                  <span class="title">{{ child.label }}</span>
                </ng-container>
              </mat-list-item>
            }
          </div>
        }
      }

      <!-- ===== Resto de ítems normales ===== -->
      @else {
        <mat-list-item
          class="menu-item"
          routerLinkActive="selected-menu-item"
          [routerLink]="item.route">
          <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
          <ng-container matListItemTitle>
            @if (!sideNavCollpsed()) {
              <span class="title">{{ item.label }}</span>
            }
          </ng-container>
        </mat-list-item>
      }
    }
  </mat-nav-list>
  `,
  styles: `
  :host { transition: all 500ms ease-in-out }

  h2 { font-weight: bold; color: white; font-size: 25px !important; padding: 5px; }
  p  { color: white; font-size: 15px !important; }

  .sidenav-header {
    padding-top: 24px;
    text-align: center;
    > img { border-radius: 100%; border: 2px solid #3a000d; object-fit: cover; }
    .header-text {
      > h2 { margin: 0; font-size: 1rem; line-height: 1.5rem; }
      > p  { margin: 0; font-size: 0.8rem; }
    }
  }

  .hide-header-text { opacity: 0; height: 0px !important; }

  /* ===== ITEM base: tamaño estable y sin reflujo ===== */
  mat-list-item.menu-item {
    box-sizing: border-box;
    border: 2px solid transparent;     /* mismo grosor SIEMPRE */
    color: white;
    min-height: 48px;                   /* altura consistente */
    padding-right: 0;                   /* el slot meta ya reserva espacio */
    position: relative;
  }

  mat-list-item.menu-item:hover {
    outline: 0;
  }

  .chev-abs {
    position: absolute;
    right: -10px !important;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    background: transparent;
    border: none;
    outline: none;
    cursor: pointer;
    height: 32px;
    width: 32px;
  }

  .menu-item { font-weight: bold; color: white; }
  .menu-item mat-icon { color: white; }

  .selected-menu-item {
    border: 2px solid white !important;
    background-color: rgba(219, 21, 21, 0.59);
    box-shadow: inset 5px 0 0 0 white;
  }

  .menu-item:hover {
    background-color: rgba(219, 21, 21, 0.59);
  }

  .selected-menu-item:hover {
    background-color: rgba(219, 21, 21, 0.49);
  }

  :host ::ng-deep .mdc-list-item__meta {
    width: 40px;
    min-width: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-left: auto !important;  /* lo ancla a la derecha */
  }

  .submenu {
    margin-left: 12px;
    border-left: 2px solid white;
  }
  .submenu .submenu-item { padding-left: 20px; color: white; font-weight: bold}
  .submenu-item mat-icon { color: white; }

  .submenu-item:hover {
    background-color: rgba(219, 21, 21, 0.59);
    
  }
  .selected-submenu-item {
    background-color: rgba(219, 21, 21, 0.59);
    box-shadow: inset 5px 0 0 0 white;
    border: 2px solid white
  }
  `
})
export class MenuComponent {

  sideNavCollpsed = signal(false);
  @Input() set collapsed(val: boolean) { this.sideNavCollpsed.set(val); }

  menuItems = signal<MenuItem[]>([]);
  expanded = signal(false);

  constructor(private api: ApiService) {
    this.initMenu();
  }

  profilePicSize = computed(() => this.sideNavCollpsed() ? '32' : '100');

  private getRolUsuario(): string {
    const usuarioGuardado = localStorage.getItem('usuario');
    if (!usuarioGuardado) return '';
    try {
      const usuario = JSON.parse(usuarioGuardado);
      return usuario.rol;
    } catch { return ''; }
  }

  private async initMenu(): Promise<void> {
    const rol = this.getRolUsuario();

    let children: Array<{ label: string; route: any[] }> = [];
    try {
      const cats = await firstValueFrom(this.api.getCategorias()) as Categoria[];
      children = (cats || []).map(c => ({
        label: c.name,
        route: ['categoria/producto', c.name] // sin slash inicial
      }));
    } catch { }

    const items: MenuItem[] = [];

    if (rol === 'Employee') {
      items.push(
        { icon: 'local_pizza', label: 'Productos', route: 'categoria', children },
        { icon: 'store', label: 'Ventas', route: 'ventas' }
      );
    }

    if (rol === 'Administrator') {
      items.push(
        { icon: 'trending_up', label: 'Estadísticas', route: 'estadisticas' },
        { icon: 'inventory_2', label: 'Inventario', route: 'inventario' }
      );
    }

    this.menuItems.set(items);
  }

  toggleExpand(ev: MouseEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.expanded.set(!this.expanded());
  }
}
