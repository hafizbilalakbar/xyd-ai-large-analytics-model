import { Injectable, signal } from '@angular/core';

export type ToastType = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(message: string, type: ToastType = 'info') {
    const toast: Toast = { id: this.nextId++, message, type };
    this.toasts.update(list => {
      const next = [toast, ...list];
      return next.slice(0, 3);
    });
    setTimeout(() => this.dismiss(toast.id), 4000);
  }

  dismiss(id: number) {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}
