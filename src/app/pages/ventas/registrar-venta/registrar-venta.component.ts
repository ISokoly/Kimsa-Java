import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../../core/services/toast.service';
import { PedidoService } from '../../../core/services/pedido.service';
import { firstValueFrom } from 'rxjs';

interface RegistroVenta {
  cliente: string;
  fecha: string;
  hora: string;
  total: number;
  id_pedido?: number;
  id_mesa?: number;
}

@Component({
  selector: 'app-registrar-venta',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    MatIconModule
  ],
  templateUrl: './registrar-venta.component.html',
  styleUrls: ['./registrar-venta.component.scss'],
  providers: [DatePipe]
})


export class RegistrarVentaComponent implements OnInit {
  ngOnInit(): void {
    throw new Error('Method not implemented.');
  }
}