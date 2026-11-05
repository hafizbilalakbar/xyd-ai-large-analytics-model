import { Injectable, signal } from '@angular/core';

export interface OperationLogEntry {
  readonly id: number;
  readonly time: string;
  readonly operator: string;
  readonly format: string;
  readonly scope: string;
  readonly recordCount: number;
  readonly deleted: boolean;
}

@Injectable({ providedIn: 'root' })
export class OperationLogService {
  private readonly logs = signal<OperationLogEntry[]>([]);
  private nextId = 1;

  readonly entries = this.logs;

  add(entry: Omit<OperationLogEntry, 'id' | 'time'>) {
    const log: OperationLogEntry = {
      id: this.nextId++,
      time: new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
      ...entry,
    };
    this.logs.update(list => [log, ...list]);
  }

  clear() {
    this.logs.set([]);
  }
}
