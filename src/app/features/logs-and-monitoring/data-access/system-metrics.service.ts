import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { ModelVersionStore } from '../../../shared/services/model-version.store';

export interface SystemMetrics {
  readonly system: {
    readonly cpu_percent: number;
    readonly mem_percent: number;
    readonly disk_used_mb: number | null;
    readonly disk_total_mb: number | null;
    readonly uptime_s: number;
  };
  readonly ingest: {
    readonly today_count: number;
    readonly error_count: number;
    readonly last_at: string | null;
  };
  readonly inference: {
    readonly active_version: string | null;
    readonly today_count: number;
    readonly avg_dur_ms: number | null;
    readonly pass_count: number;
    readonly fail_count: number;
  };
}

export type MetricsSource = 'live' | 'local';

const API_URL = '/api/v1/system/metrics';
const POLL_INTERVAL_MS = 10_000;
const RETRY_INTERVAL_MS = 60_000;
const BOOT_STORAGE_KEY = 'xyd_metrics_boot_ms_v1';

/**
 * Polls the backend system metrics endpoint every 10 seconds (same source as
 * the original application). When the backend is unreachable it falls back to
 * a local simulation — uptime keeps counting up live from a persisted boot
 * time, and CPU/memory follow a gentle random walk — and retries the live
 * endpoint once a minute.
 */
@Injectable({ providedIn: 'root' })
export class SystemMetricsService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly modelVersions = inject(ModelVersionStore);

  readonly metrics = signal<SystemMetrics | null>(null);
  readonly source = signal<MetricsSource>('local');
  readonly lastUpdatedAt = signal<number>(0);

  private pollTimer: number | null = null;
  private readonly bootMs = loadBootMs();
  private simulatedCpu = 14;
  private simulatedMem = 52;
  private simulatedDisk: { usedMb: number | null; totalMb: number | null } = {
    usedMb: null,
    totalMb: null,
  };

  constructor() {
    this.lastUpdatedAt.set(Date.now());
    this.metrics.set(this.buildLocalMetrics());
    this.refreshStorageEstimate();
    this.poll();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private poll(): void {
    this.http.get<SystemMetrics>(API_URL).subscribe({
      next: (metrics) => {
        this.metrics.set(metrics);
        this.source.set('live');
        this.lastUpdatedAt.set(Date.now());
        this.schedule(POLL_INTERVAL_MS);
      },
      error: () => {
        this.metrics.set(this.buildLocalMetrics());
        this.source.set('local');
        this.lastUpdatedAt.set(Date.now());
        this.refreshStorageEstimate();
        this.schedule(RETRY_INTERVAL_MS);
      },
    });
  }

  private schedule(delayMs: number): void {
    this.clearTimer();
    this.pollTimer = window.setTimeout(() => this.poll(), delayMs);
  }

  private clearTimer(): void {
    if (this.pollTimer !== null) {
      window.clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private buildLocalMetrics(): SystemMetrics {
    this.simulatedCpu = clamp(this.simulatedCpu + (Math.random() - 0.5) * 6, 3, 38);
    this.simulatedMem = clamp(this.simulatedMem + (Math.random() - 0.5) * 3, 38, 78);
    return {
      system: {
        cpu_percent: Math.round(this.simulatedCpu * 10) / 10,
        mem_percent: Math.round(this.simulatedMem * 10) / 10,
        disk_used_mb: this.simulatedDisk.usedMb,
        disk_total_mb: this.simulatedDisk.totalMb,
        uptime_s: Math.max(0, Math.floor((Date.now() - this.bootMs) / 1000)),
      },
      ingest: {
        today_count: 0,
        error_count: 0,
        last_at: null,
      },
      inference: {
        active_version: this.modelVersions.activeVersion()?.id ?? null,
        today_count: 0,
        avg_dur_ms: null,
        pass_count: 0,
        fail_count: 0,
      },
    };
  }

  private refreshStorageEstimate(): void {
    if (typeof navigator === 'undefined' || navigator.storage?.estimate === undefined) {
      return;
    }
    navigator.storage
      .estimate()
      .then((estimate) => {
        if (typeof estimate.usage !== 'number' || typeof estimate.quota !== 'number') {
          return;
        }
        this.simulatedDisk = {
          usedMb: Math.round((estimate.usage / 1048576) * 10) / 10,
          totalMb: Math.round((estimate.quota / 1048576) * 10) / 10,
        };
        if (this.source() === 'local') {
          this.metrics.set(this.buildLocalMetrics());
        }
      })
      .catch(() => undefined);
  }
}

function loadBootMs(): number {
  if (typeof localStorage === 'undefined') {
    return Date.now();
  }
  try {
    const raw = localStorage.getItem(BOOT_STORAGE_KEY);
    const parsed = raw === null ? Number.NaN : Number(raw);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= Date.now()) {
      return parsed;
    }
    const now = Date.now();
    localStorage.setItem(BOOT_STORAGE_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
