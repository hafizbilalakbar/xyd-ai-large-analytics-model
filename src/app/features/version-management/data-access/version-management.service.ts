import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ModelVersionService } from '../../../shared/services/model-version.service';
import type { ModelVersionRecord } from '../../../shared/services/model-version.service';
import { OperationLogService } from '../../../shared/services/operation-log.service';
import { ToastService } from '../../../shared/services/toast.service';
import { VersionManagementApiService } from './version-management-api.service';
import type {
  ApiModelVersion,
  ClassAccuracy,
  VersionComparison,
  VersionDetails,
  VersionTimelineItem,
} from './version-management.models';

export type VersionListState = 'loading' | 'ok' | 'error';

function versionWeight(version: string): number {
  const match = /^V(\d+)\.(\d+)$/.exec(version);
  if (match === null) {
    return 0;
  }
  return Number(match[1]) * 1000 + Number(match[2]);
}

function formatDisplayDate(value: string | null): string | null {
  if (value === null || value.length === 0) {
    return null;
  }
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function toRecord(item: ApiModelVersion): ModelVersionRecord {
  return {
    versionId: item.version_id,
    version: item.version,
    type: item.type,
    trainedAt: formatDisplayDate(item.trained_at),
    sampleCount: item.sample_count,
    accuracy: item.accuracy_macro,
    active: item.is_active,
    metrics:
      item.metrics === undefined || item.metrics === null
        ? null
        : {
            accuracyMacro: item.metrics.accuracy_macro,
            accuracyWeighted: item.metrics.accuracy_weighted,
            perClass: { ...item.metrics.per_class },
            byCombo:
              item.metrics.by_combo === null ? null : { ...item.metrics.by_combo },
            sampleCount: item.metrics.sample_count,
            droppedCount: item.metrics.dropped_count,
            evalMode: item.metrics.eval_mode,
            isPlaceholder: item.metrics.is_placeholder,
          },
    parentVersionId: item.parent_version_id ?? null,
    trainingScope: item.training_scope ?? null,
  };
}

function toDetails(item: ApiModelVersion): VersionDetails {
  return {
    versionId: item.version_id,
    version: item.version,
    type: item.type,
    trainedAt: formatDisplayDate(item.trained_at),
    sampleSize: item.sample_count,
    accuracy: item.accuracy_macro,
    active: item.is_active,
    evalMode: item.metrics?.eval_mode ?? null,
    trainingScope: item.training_scope ?? null,
  };
}

@Injectable({ providedIn: 'root' })
export class VersionManagementService {
  private readonly api = inject(VersionManagementApiService);
  private readonly modelVersion = inject(ModelVersionService);
  private readonly operationLog = inject(OperationLogService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly listState = signal<VersionListState>('loading');
  readonly loadError = signal<string | null>(null);
  readonly classAccuracies = signal<readonly ClassAccuracy[]>([]);
  readonly comparisonError = signal<string | null>(null);
  readonly isComparisonLoading = signal(false);
  readonly isActivating = signal(false);
  readonly isDetailsLoading = signal(false);

  readonly versions = computed<readonly VersionTimelineItem[]>(() =>
    this.modelVersion.versions().map((record) => ({
      versionId: record.versionId,
      version: record.version,
      type: record.type,
      trainedAt: record.trainedAt,
      sampleSize: record.sampleCount,
      accuracy: record.accuracy,
      active: record.active,
    })),
  );

  readonly activeVersion = computed(() => this.modelVersion.activeVersionLabel());

  readonly comparison = computed<VersionComparison>(() => {
    const sorted = [...this.versions()].sort(
      (left, right) => versionWeight(left.version) - versionWeight(right.version),
    );
    if (sorted.length < 2) {
      return { olderVersion: '', newerVersion: '', olderVersionId: 0, newerVersionId: 0 };
    }
    const active = sorted.find((item) => item.active);
    let older: VersionTimelineItem;
    let newer: VersionTimelineItem;
    if (active) {
      newer = active;
      const others = sorted.filter((item) => item.versionId !== active.versionId);
      older = others.length > 0 ? others[others.length - 1] : sorted[0];
    } else {
      older = sorted[sorted.length - 2];
      newer = sorted[sorted.length - 1];
    }
    return {
      olderVersion: older.version,
      newerVersion: newer.version,
      olderVersionId: older.versionId,
      newerVersionId: newer.versionId,
    };
  });

  readonly hasComparison = computed(() => {
    const comparison = this.comparison();
    return comparison.olderVersionId !== 0 && comparison.newerVersionId !== 0;
  });

  private readonly comparisonSignature = computed(() => {
    const comparison = this.comparison();
    return `${comparison.olderVersionId}:${comparison.newerVersionId}`;
  });

  private lastComparisonSignature = '';

  constructor() {
    effect(() => {
      const signature = this.comparisonSignature();
      const state = this.listState();
      if (signature === this.lastComparisonSignature) {
        return;
      }
      this.lastComparisonSignature = signature;
      if (state === 'ok') {
        void this.refreshComparison();
      }
    });
  }

  async load(): Promise<void> {
    this.listState.set('loading');
    this.loadError.set(null);
    try {
      const response = await this.api.getVersions();
      this.modelVersion.syncVersions(response.items.map(toRecord));
      this.listState.set('ok');
      await this.refreshComparison();
    } catch {
      this.listState.set('error');
      this.loadError.set('Unable to load model versions.');
      this.classAccuracies.set([]);
      this.comparisonError.set(null);
    }
  }

  async getVersionDetails(versionId: number): Promise<VersionDetails | null> {
    this.isDetailsLoading.set(true);
    try {
      const item = await this.api.getVersionDetails(versionId);
      return toDetails(item);
    } catch {
      this.toast.show('Unable to load version details.', 'error');
      return null;
    } finally {
      this.isDetailsLoading.set(false);
    }
  }

  async activateVersion(versionId: number): Promise<boolean> {
    const target = this.modelVersion.findById(versionId);
    if (target === null) {
      this.toast.show('Version not found.', 'error');
      return false;
    }
    if (target.active) {
      this.toast.show(`${target.version} is already in use.`, 'warning');
      return false;
    }
    if (this.modelVersion.trainingInProgress()) {
      this.toast.show('A training task is running. Try again after it finishes.', 'warning');
      return false;
    }

    this.toast.dismissAll();
    this.isActivating.set(true);
    try {
      const response = await this.api.activateVersion(versionId);
      this.modelVersion.setActiveVersionById(response.version_id);
      await this.refreshComparison();
      this.toast.show(
        `Activated ${response.version} (${response.duration_ms} ms).`,
        'success',
      );
      this.operationLog.add({
        operator: this.auth.user()?.name ?? 'Administrator',
        format: 'Activate model version',
        scope: `Version ${response.version}; result: success`,
        recordCount: 0,
        deleted: false,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error && error.message.length > 0
          ? error.message
          : `Unable to activate ${target.version}.`;
      this.toast.show(message, 'error');
      return false;
    } finally {
      this.isActivating.set(false);
    }
  }

  async retryComparison(): Promise<void> {
    await this.refreshComparison();
  }

  private async refreshComparison(): Promise<void> {
    const comparison = this.comparison();
    if (comparison.olderVersionId === 0 || comparison.newerVersionId === 0) {
      this.classAccuracies.set([]);
      this.comparisonError.set(null);
      return;
    }
    this.isComparisonLoading.set(true);
    this.comparisonError.set(null);
    try {
      const response = await this.api.getClassAccuracy(
        comparison.olderVersionId,
        comparison.newerVersionId,
      );
      this.classAccuracies.set(response.classAccuracies);
    } catch {
      this.classAccuracies.set([]);
      this.comparisonError.set('Failed to load class accuracy data.');
    } finally {
      this.isComparisonLoading.set(false);
    }
  }
}
