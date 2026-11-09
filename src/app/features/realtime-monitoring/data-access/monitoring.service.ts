import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { createMonitoringMock } from './monitoring.mock';
import type {
  MonitoringDeviceStatus,
  MonitoringRecord,
  MonitoringServiceStatus,
} from './monitoring.models';

const RECEIVE_TIMEOUT_MS = 60_000;
const FREQUENCY_WINDOW_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class MonitoringService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly now = signal(Date.now());
  private readonly mock = createMonitoringMock();
  private readonly records = signal<readonly MonitoringRecord[]>(this.mock.records).asReadonly();

  readonly serviceStatus = signal<MonitoringServiceStatus>(this.mock.serviceStatus).asReadonly();
  readonly deviceStatus = signal<MonitoringDeviceStatus>(this.mock.deviceStatus).asReadonly();
  readonly activationModelVersion = signal(this.mock.activationModelVersion).asReadonly();
  readonly latestRecord = computed(() => this.records()[0] ?? null);
  readonly recentRecords = computed(() => this.records().slice(0, 10));
  readonly lastReceivedAt = computed(() => this.latestRecord()?.lockedAt ?? null);
  readonly receiveFrequency = computed<number | null>(() => {
    const records = this.records();

    if (records.length === 0) {
      return null;
    }

    const cutoff = this.now() - FREQUENCY_WINDOW_MS;
    return records.filter((record) => record.lockedAt.getTime() >= cutoff).length;
  });
  readonly isTimedOut = computed(() => {
    const lastReceivedAt = this.lastReceivedAt();
    return lastReceivedAt !== null && this.now() - lastReceivedAt.getTime() > RECEIVE_TIMEOUT_MS;
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }
}
