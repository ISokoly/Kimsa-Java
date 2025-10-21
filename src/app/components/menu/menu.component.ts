import { Component, computed, Input, signal } from '@angular/core';
import { MatListModule } from '@angular/material/list'
import { MatIconModule } from '@angular/material/icon'
import { RouterLink, RouterLinkActive } from '@angular/router';

export type MenuItem = {
  icon: string;
  label: string;
  route: string;
}


@Component({
  selector: 'app-menu',
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
      <a  class="menu-item">
      <mat-list-item routerLinkActive ="selected-menu-item" 
      #rla="routerLinkActive" routerLink={{item.route}}>
        <mat-icon matListItemIcon>{{item.icon}}</mat-icon>
        @if (!sideNavCollpsed()) {
          <span class="title" matListItemTitle>{{item.label}}</span>
        }
      </mat-list-item>
      </a>
    }
  </mat-nav-list>
  `,

  styles: `
  :host {
    transition: all 500ms ease-in-out
}

h2 {
    font-weight: bold;
    color: white;
    font-size: 25px !important;
    padding: 5px;
}

p {
    color: white;
    font-size: 15px !important;
}

mat-list-item {
    border: 2px solid transparent;
    color: white;

    mat-icon {
        color: white;
    }

    .title {
        font-weight: bold;
        color: white;
    }

    &:hover {
        background-color: rgba(221, 44, 44, 0.1);
        border-color: white;
    }
}

.sidenav-header {
    padding-top: 24px;
    text-align: center;

    >img {
        border-radius: 100%;
        border: 2px solid #3a000d;
        object-fit: cover;
    }

    .header-text {
        >h2 {
            margin: 0;
            font-size: 1rem;
            line-height: 1.5rem;
        }

        >p {
            margin: 0;
            font-size: 0.8rem;
        }
    }
}

.hide-header-text {
    opacity: 0;
    height: 0px !important;
}

.menu-item {
    border-right: 50px solid;
    border-color: rgba(48, 17, 187, 0);

}

.selected-menu-item {
    border-left: 5px solid white;
    background-color: rgba(219, 21, 21, 0.59);
    border-color: white;
}

.selected-menu-item:hover {
    background-color: rgba(221, 44, 44, 0.4);
}
  `
})
export class MenuComponent {

  sideNavCollpsed = signal(false);
  @Input() set collapsed(val: boolean) {
    this.sideNavCollpsed.set(val)
  }

  private getRolUsuario(): string {
    const usuarioGuardado = localStorage.getItem('usuario');
    if (!usuarioGuardado) return '';
    try {
      const usuario = JSON.parse(usuarioGuardado);
      return usuario.rol;
    } catch {
      return '';
    }
  }

  menuItems = signal<MenuItem[]>([]);

  constructor() {
    const rol = this.getRolUsuario();

    if (rol === 'Employee') {
      this.menuItems.set([
        { icon: 'local_pizza', label: 'Productos', route: 'categoria' },
        { icon: 'store', label: 'Ventas', route: 'ventas' }
      ]);
    }

    if (rol === 'Administrator') {
      this.menuItems.set([
        { icon: 'trending_up', label: 'Estadisticas', route: 'estadisticas' }
      ]);
    }
  }

  profilePicSize = computed(() =>
    this.sideNavCollpsed() ? '32' : '100'
  );
}