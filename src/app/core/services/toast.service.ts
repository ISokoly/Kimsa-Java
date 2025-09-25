import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface MensajeToast {
  id: number;
  texto: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private mensajesSubject = new BehaviorSubject<MensajeToast[]>([]);
  mensajes$ = this.mensajesSubject.asObservable();

  private mensajes: MensajeToast[] = [];

  mostrarMensaje(texto: string, duracionMs: number = 5000) {
    const id = Date.now() + Math.random();
    const mensaje: MensajeToast = { id, texto };
    this.mensajes.push(mensaje);
    this.mensajesSubject.next([...this.mensajes]);

    setTimeout(() => {
      this.mensajes = this.mensajes.filter(m => m.id !== id);
      this.mensajesSubject.next([...this.mensajes]);
    }, duracionMs);
  }

  eliminarMensaje(id: number) {
    this.mensajes = this.mensajes.filter(m => m.id !== id);
    this.mensajesSubject.next([...this.mensajes]);
  }
}
