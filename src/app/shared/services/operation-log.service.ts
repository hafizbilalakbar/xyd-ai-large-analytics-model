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

export interface Alarm {
  readonly id: number;
  readonly time: string;
  readonly type: 'storage' | 'model' | 'training' | 'export';
  readonly details: string;
  readonly read: boolean;
}

@Injectable({ providedIn: 'root' })
export class OperationLogService {
  private readonly logs = signal<OperationLogEntry[]>([]);
  private readonly alarms = signal<Alarm[]>([]);
  private nextId = 1;

  readonly entries = this.logs;
  readonly alarmEntries = this.alarms;

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

  addAlarm(type: Alarm['type'], details: string) {
    const alarm: Alarm = {
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
      type,
      details,
      read: false,
    };
    this.alarms.update(list => [alarm, ...list]);
  }

  markAlarmRead(id: number) {
    this.alarms.update(list => list.map(a => a.id === id ? { ...a, read: true } : a));
  }

  removeAlarm(id: number) {
    this.alarms.update(list => list.filter(a => a.id !== id));
  }

  clear() {
    this.logs.set([]);
  }
}
