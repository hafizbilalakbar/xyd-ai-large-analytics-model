import { Injectable, signal } from '@angular/core';

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  isLeaving?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  readonly toasts = signal<Toast[]>([]);

  show(message: string, type: ToastType = 'info') {
    const toast: Toast = { id: this.nextId++, message, type };
    this.toasts.update(list => {
      const next = [toast, ...list];
      if (next.length > 3) {
        next.slice(3).forEach(t => this.clearTimer(t.id));
      }
      return next.slice(0, 3);
    });
    this.startTimer(toast.id);
  }

  dismiss(id: number) {
    this.clearTimer(id);
    const toast = this.toasts().find(t => t.id === id);
    if (!toast || toast.isLeaving) return;

    this.toasts.update(list =>
      list.map(t => (t.id === id ? { ...t, isLeaving: true } : t)),
    );

    setTimeout(() => {
      this.toasts.update(list => list.filter(t => t.id !== id));
    }, 250);
  }

  dismissAll() {
    this.toasts().forEach(t => this.dismiss(t.id));
  }

  pause(id: number) {
    this.clearTimer(id);
  }

  resume(id: number) {
    if (this.toasts().some(t => t.id === id && !t.isLeaving)) {
      this.startTimer(id);
    }
  }

  private startTimer(id: number) {
    this.clearTimer(id);
    const timer = setTimeout(() => this.dismiss(id), 4000);
    this.timers.set(id, timer);
  }

  private clearTimer(id: number) {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
