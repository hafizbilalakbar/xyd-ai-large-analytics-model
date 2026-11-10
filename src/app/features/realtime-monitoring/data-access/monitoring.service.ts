import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { MonitoringApiService } from './monitoring-api.service';
import { USE_MONITORING_MOCK } from './monitoring.mock';
import type {
  MonitoringDeviceStatus,
  MonitoringRecord,
} from './monitoring.models';

const RECEIVE_TIMEOUT_MS = 60_000;
const FREQUENCY_WINDOW_MS = 60_000;
const POLL_INTERVAL_MS = 3000;

const MOCK_RECORDS: readonly MonitoringRecord[] = [];

type MonitorStatus = 'idle' | 'receiving' | 'timeout' | 'error';

@Injectable({ providedIn: 'root' })
export class MonitoringService {
  private readonly api = inject(MonitoringApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly now = signal(Date.now());
  private readonly visible = signal(!document.hidden);
  private readonly recordsState = signal<readonly MonitoringRecord[]>(MOCK_RECORDS);
  private readonly loadError = signal<string | null>(null);
  private readonly activeVersionState = signal<string | null>(null);
  private refreshing = false;

  readonly records = this.recordsState.asReadonly();
  readonly loadError$ = this.loadError.asReadonly();
  readonly activeVersion = this.activeVersionState.asReadonly();

  readonly status = computed<MonitorStatus>(() => {
    if (this.loadError() !== null) {
      return 'error';
    }
    const records = this.recordsState();
    if (records.length === 0) {
      return 'idle';
    }
    if (this.isTimedOut()) {
      return 'timeout';
    }
    return 'receiving';
  });

  readonly deviceStatus = computed<MonitoringDeviceStatus>(() => {
    return this.recordsState().length > 0 ? 'pushed' : 'waiting';
  });

  readonly latestRecord = computed(() => this.recordsState()[0] ?? null);
  readonly recentRecords = computed(() => this.recordsState().slice(0, 10));
  readonly lastReceivedAt = computed(() => this.latestRecord()?.lockedAt ?? null);
  readonly isTimedOut = computed(() => {
    const lastReceivedAt = this.lastReceivedAt();
    return lastReceivedAt !== null && this.now() - lastReceivedAt.getTime() > RECEIVE_TIMEOUT_MS;
  });
  readonly receiveFrequency = computed<number | null>(() => {
    const records = this.recordsState();
    if (records.length === 0) {
      return null;
    }
    const cutoff = this.now() - FREQUENCY_WINDOW_MS;
    return records.filter((record) => record.lockedAt.getTime() >= cutoff).length;
  });

  constructor() {
    const clock = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(clock));

    const onVisibilityChange = () => {
      this.visible.set(!document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onVisibilityChange));

    const poll = () => {
      if (this.visible()) {
        void this.refresh();
      }
    };
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));

    if (!USE_MONITORING_MOCK) {
      void this.refresh();
    }
  }

  async refresh(): Promise<void> {
    if (USE_MONITORING_MOCK || this.refreshing) {
      return;
    }
    this.refreshing = true;
    try {
      const data = await this.api.getLatest();
      this.recordsState.set(data.items ?? []);
      if (data.activeVersion !== undefined) {
        this.activeVersionState.set(data.activeVersion ?? null);
      }
      this.loadError.set(null);
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Failed to load monitoring data.');
    } finally {
      this.refreshing = false;
    }
  }
}
