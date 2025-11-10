import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageLoadingService } from '../../core/services/page-loading.service';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [RouterModule, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './inventario.component.html',
  styleUrls: ['./inventario.component.scss']
})
export class InventarioComponent implements OnInit {
  contentReady = false;   // sigue existiendo por compatibilidad
  animateIn = false;      // <- nuevo: controla la animación de entrada

  constructor(
    private router: Router,
    private pageLoading: PageLoadingService
  ) {}

  async ngOnInit(): Promise<void> {
    this.pageLoading.start();

    this.contentReady = true;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.animateIn = true;
        this.pageLoading.stop();
      });
    });
  }

  goToInsumos(): void { this.router.navigate(['/view/inventario/insumos']); }
  goToRecetas(): void { this.router.navigate(['/view/inventario/recetas']); }
  goToCompras(): void { this.router.navigate(['/view/inventario/compras']); }
}