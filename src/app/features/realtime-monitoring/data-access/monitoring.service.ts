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

type VersionSampleInfo = {
  count: number;
  lastReceived: number; // timestamp
};

@Injectable({ providedIn: 'root' })
export class MonitoringService {
  private readonly api = inject(MonitoringApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly now = signal(Date.now());
  private readonly visible = signal(!document.hidden);
  private readonly recordsState = signal<readonly MonitoringRecord[]>(MOCK_RECORDS);
  private readonly loadError = signal<string | null>(null);
  private readonly activeVersionState = signal<string | null>(null);
  private readonly refreshing = signal(false);
  private readonly samplesByVersion = new Map<string, VersionSampleInfo>();

  readonly records = this.recordsState.asReadonly();
  readonly loadError$ = this.loadError.asReadonly();
  readonly activeVersion = this.activeVersionState.asReadonly();

  readonly status = computed<MonitorStatus>(() => {
    if (this.loadError() !== null) {
      return 'error';
    }
    const records = this.recordsState();
    // Check samples for the active version only
    const activeVersion = this.activeVersion();
    const versionRecords = records.filter(
      (record) => record.modelVersion === activeVersion
    );
    if (versionRecords.length === 0) {
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
    return (
      lastReceivedAt !== null && this.now() - lastReceivedAt.getTime() > RECEIVE_TIMEOUT_MS
    );
  });
  readonly receiveFrequency = computed<number | null>(() => {
    const records = this.recordsState();
    if (records.length === 0) {
      return null;
    }
    const cutoff = this.now() - FREQUENCY_WINDOW_MS;
    return records.filter((record) => record.lockedAt.getTime() >= cutoff).length;
  });
  readonly samplesByVersionList = computed<
    { versionId: string; count: number; lastReceived: string }[]
  >(() => {
    const result: { versionId: string; count: number; lastReceived: string }[] = [];
    this.samplesByVersion.forEach((info, versionId) => {
      result.push({
        versionId,
        count: info.count,
        lastReceived: new Date(info.lastReceived).toLocaleString(),
      });
    });
    // Sort by last received, newest first
    result.sort((a, b) => b.lastReceived.localeCompare(a.lastReceived));
    return result;
  });

  constructor() {
    const clock = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(clock));

    const onVisibilityChange = () => {
      this.visible.set(!document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onVisibilityChange));

    let pollTimeout: ReturnType<typeof setTimeout> | null = null;

    const schedulePoll = () => {
      if (pollTimeout !== null) clearTimeout(pollTimeout);
      pollTimeout = setTimeout(() => {
        if (this.visible() && !this.refreshing()) {
          void this.refresh();
        }
        schedulePoll();
      }, POLL_INTERVAL_MS);
    };
    schedulePoll();

    this.destroyRef.onDestroy(() => {
      if (pollTimeout !== null) clearTimeout(pollTimeout);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    });

    if (!USE_MONITORING_MOCK) {
      void this.refresh();
    }
  }

  async refresh(): Promise<void> {
    if (USE_MONITORING_MOCK || this.refreshing()) {
      return;
    }
    this.refreshing.set(true);
    try {
      const data = await this.api.getLatest();
      this.recordsState.set(data.items as MonitoringRecord[]);
      if (data.activeVersion !== undefined) {
        this.activeVersionState.set(data.activeVersion ?? null);
      }
      // Update samplesByVersion from the new data
      this.updateSamplesByVersion(data.items as MonitoringRecord[]);
      this.loadError.set(null);
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Failed to load monitoring data.');
    } finally {
      this.refreshing.set(false);
    }
  }

  private updateSamplesByVersion(records: MonitoringRecord[]): void {
    // Clear existing map
    this.samplesByVersion.clear();

    // Count samples per version
    const versionCounts = new Map<string, VersionSampleInfo>();
    for (const record of records) {
      const versionId = record.modelVersion;
      if (!versionId) continue;
      if (!versionCounts.has(versionId)) {
        versionCounts.set(versionId, { count: 0, lastReceived: 0 });
      }
      const info = versionCounts.get(versionId)!;
      info.count++;
      const received = record.lockedAt?.getTime() ?? 0;
      if (received > info.lastReceived) {
        info.lastReceived = received;
      }
    }

    for (const [versionId, info] of versionCounts.entries()) {
      this.samplesByVersion.set(versionId, {
        count: info.count,
        lastReceived: info.lastReceived,
      });
    }
  }
}