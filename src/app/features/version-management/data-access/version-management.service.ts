import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ModelVersionStore } from '../../../shared/services/model-version.store';
import type { ModelVersionStoreVersion } from '../../../shared/services/model-version.store';
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

function toRecord(item: ApiModelVersion): ModelVersionStoreVersion {
  return {
    id: item.version,
    type: item.type as 'basic' | 'local',
    trainingDate: formatDisplayDate(item.trained_at),
    sampleSize: item.sample_count,
    accuracy: item.accuracy_macro,
    active: item.is_active,
    perClassAccuracy: item.metrics?.per_class
      ? Object.entries(item.metrics.per_class).map(([code, acc]) => ({
          code,
          name: code,
          accuracy: (acc ?? 0) * 100,
        }))
      : [],
    status: item.is_active ? 'Active' : 'Inactive',
    sourceTaskId: item.source_task_id ?? null,
  };
}

function toDetails(item: ApiModelVersion): VersionDetails {
  return {
    versionId: item.version ?? String(item.version_id ?? ''),
    version: item.version,
    type: item.type as 'basic' | 'local',
    trainedAt: formatDisplayDate(item.trained_at),
    sampleSize: item.sample_count,
    accuracy: item.accuracy_macro,
    active: item.is_active,
    evalMode: item.metrics?.eval_mode ?? null,
    trainingScope: item.training_scope ?? null,
    sourceTaskId: item.source_task_id ?? null,
  };
}

@Injectable({ providedIn: 'root' })
export class VersionManagementService {
  private readonly api = inject(VersionManagementApiService);
  private readonly store = inject(ModelVersionStore);
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
    this.store.versions().map((record) => ({
      versionId: record.id,
      version: record.id,
      type: record.type,
      trainedAt: record.trainingDate,
      sampleSize: record.sampleSize,
      accuracy: record.accuracy,
      active: record.active,
      sourceTaskId: record.sourceTaskId,
    })),
  );

  readonly activeVersion = computed(() => this.store.activeVersion()?.id ?? '—');

  readonly comparison = computed<VersionComparison>(() => {
    const sorted = sortDescending(this.versions());
    if (sorted.length < 2) {
      return { olderVersion: '', newerVersion: '', olderVersionId: '', newerVersionId: '' };
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
    return comparison.olderVersionId !== '' && comparison.newerVersionId !== '';
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
      const versions = response.items.map(toRecord);
      this.store.setVersions(versions);
      this.listState.set('ok');
      await this.refreshComparison();
    } catch {
      this.listState.set('error');
      this.loadError.set('Unable to load model versions.');
      this.classAccuracies.set([]);
      this.comparisonError.set(null);
    }
  }

  async getVersionDetails(versionId: string): Promise<VersionDetails | null> {
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

  async activateVersion(versionId: string): Promise<boolean> {
    const target = this.store.versions().find((item) => item.id === versionId);
    if (!target) {
      this.toast.show('Version not found.', 'error');
      return false;
    }
    if (target.active) {
      this.toast.show(`${target.id} is already in use.`, 'warning');
      return false;
    }

    this.toast.dismissAll();
    this.isActivating.set(true);
    try {
      await this.api.activateVersion(versionId);
      this.store.activateVersion(versionId);
      await this.refreshComparison();
      this.toast.show(`Activated ${target.id}.`, 'success');
      this.operationLog.add({
        operator: this.auth.user()?.name ?? 'Administrator',
        format: 'Activate model version',
        scope: `Version ${target.id}; result: success`,
        recordCount: 0,
        deleted: false,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error && error.message.length > 0
          ? error.message
          : `Unable to activate ${target.id}.`;
      this.toast.show(message, 'error');
      return false;
    } finally {
      this.isActivating.set(false);
    }
  }

  async deleteVersionWithTask(versionId: string): Promise<boolean> {
    const target = this.store.versions().find((item) => item.id === versionId);
    if (!target) {
      this.toast.show('Version not found.', 'error');
      return false;
    }
    if (target.active) {
      this.toast.show(`${target.id} is in use. Activate another version before deleting.`, 'warning');
      return false;
    }
    const versionCount = this.store.versions().length;
    if (versionCount <= 2) {
      this.toast.show('Cannot delete the last remaining version.', 'warning');
      return false;
    }

    const result = this.store.deleteVersionWithTask(versionId);
    if (!result.ok) {
      this.toast.show(result.reason ?? 'Unable to delete version.', 'error');
      return false;
    }

    this.toast.dismissAll();
    await this.refreshComparison();
    const extra = result.deletedTaskId ? ` (and linked task ${result.deletedTaskId})` : '';
    this.toast.show(`Deleted version ${target.id}${extra}.`, 'success');
    this.operationLog.add({
      operator: this.auth.user()?.name ?? 'Administrator',
      format: 'Delete model version',
      scope: `Version ${target.id}; result: success`,
      recordCount: 0,
      deleted: true,
    });
    return true;
  }

  canDeleteVersion(versionId: string): boolean {
    const record = this.store.versions().find((item) => item.id === versionId);
    if (!record) {
      return false;
    }
    if (record.active) {
      return false;
    }
    return this.store.versions().length > 2;
  }

  async retryComparison(): Promise<void> {
    await this.refreshComparison();
  }

  private async refreshComparison(): Promise<void> {
    const comparison = this.comparison();
    if (comparison.olderVersionId === '' || comparison.newerVersionId === '') {
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

function sortDescending(items: readonly VersionTimelineItem[]): VersionTimelineItem[] {
  return [...items].sort(
    (left, right) => versionWeight(right.version) - versionWeight(left.version),
  );
}
