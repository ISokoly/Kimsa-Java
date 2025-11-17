import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from '@angular/material/button';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PageLoadingService } from '../../../../core/services/page-loading.service';

@Component({
  selector: 'app-compras-registradas',
  imports: [RouterModule, MatButtonModule, MatIconModule, DecimalPipe, DatePipe],
  templateUrl: './compras-registradas.component.html',
  styleUrl: './compras-registradas.component.scss'
})
export class ComprasRegistradasComponent implements OnInit {
  contentReady = false;

  purchase: any | null = null;
  items: any[] = [];
  supplier: any | null = null;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private toast: ToastService,
    private router: Router,
    private pageLoading: PageLoadingService,
  ) { }

  ngOnInit(): void {
    this.contentReady = false;
    this.pageLoading.start();

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.toast.mostrarMensaje('❌ ID de compra inválido');
      this.pageLoading.stop();
      this.contentReady = true;
      this.router.navigate(['/purchases']);
      return;
    }

    this.loadPurchase(id);
  }

  private loadPurchase(id: number): void {
    this.api.getPurchaseById(id).subscribe({
      next: (res: any) => {
        this.purchase = res || null;
        this.items = res?.items ?? [];
        this.supplier = res?.supplier ?? null;
        this.pageLoading.stop();
        this.contentReady = true;
      },
      error: () => {
        this.pageLoading.stop();
        this.contentReady = true;
        this.toast.mostrarMensaje('❌ No se pudo cargar la compra');
        this.router.navigate(['/view/inventario/compras']);
      },
    });
  }

printReceipt(): void {
  document.body.classList.add('print-mode');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('print-mode');
  }, 0);
}


  volver(): void {
    this.router.navigate(['/view/inventario/compras']);
  }

  // Para track de @for
  trackItem(index: number, item: any): any {
    return item?.idPurchaseDetail ??
      item?.idItem ??
      item?.supply?.idSupply ??
      index;
  }
}