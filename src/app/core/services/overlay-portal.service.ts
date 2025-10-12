// core/services/overlay-portal.service.ts
import { Injectable, TemplateRef, signal, computed } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { Subject } from 'rxjs';

export interface OverlayHandle {
  id: number;
  close: () => void;
}

type OverlayEntry = { id: number; tpl: TemplateRef<any> };

@Injectable({ providedIn: 'root' })
export class OverlayPortalService {
  private _entries = signal<OverlayEntry[]>([]);
  private _seq = 0;

  private _cleared$ = new Subject<void>();
  cleared$ = this._cleared$.asObservable();

  entries = computed(() => this._entries());
  hasAny = computed(() => this._entries().length > 0);
  top = computed(() => {
    const arr = this._entries();
    return arr.length ? arr[arr.length - 1] : null;
  });

  constructor(private router: Router) {
    this.router.events.subscribe(ev => {
      if (ev instanceof NavigationStart) {
        this.hide();
        this._cleared$.next();
      }
    });
  }

  open(tpl: TemplateRef<any>): OverlayHandle {
    const id = ++this._seq;
    this._entries.set([...this._entries(), { id, tpl }]);

    document.body.classList.add('lock-scroll');

    return {
      id,
      close: () => this.hide(id)
    };
  }

  hideTop(): void {
    const arr = this._entries();
    if (!arr.length) return;
    this.hide(arr[arr.length - 1].id);
  }

  hide(id?: number) {
    if (id == null) {
      this._entries.set([]);
      this._cleared$.next(); // por si se llama manualmente a hide()
    } else {
      this._entries.set(this._entries().filter(e => e.id !== id));
    }
    if (this._entries().length === 0) {
      document.body.classList.remove('lock-scroll');
    }
  }

  topId(): number | null {
    const t = this.top();
    return t ? t.id : null;
  }
}