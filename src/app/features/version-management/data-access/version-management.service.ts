import { Injectable, computed, inject, signal } from '@angular/core';
import { VersionManagementApiService } from './version-management-api.service';
import { ModelVersionService } from '../../../shared/services/model-version.service';
import { OperationLogService } from '../../../shared/services/operation-log.service';
import { ToastService } from '../../../shared/services/toast.service';
import type {
  ClassAccuracy,
  GetClassAccuracyResponse,
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

@Injectable({ providedIn: 'root' })
export class VersionManagementService {
  private readonly api = inject(VersionManagementApiService);
  private readonly modelVersion = inject(ModelVersionService);
  private readonly operationLog = inject(OperationLogService);
  private readonly toast = inject(ToastService);

  readonly listState = signal<VersionListState>('loading');
  readonly loadError = signal<string | null>(null);
  readonly versions = signal<readonly VersionTimelineItem[]>([]);
  readonly classAccuracies = signal<readonly ClassAccuracy[]>([]);

  readonly activeVersion = computed(
    () => this.versions().find((version) => version.active)?.version ?? '—',
  );

  readonly comparison = computed<VersionComparison>(() => {
    const versions = [...this.versions()].sort(
      (left, right) => versionWeight(right.version) - versionWeight(left.version),
    );
    if (versions.length === 0) {
      return { olderVersion: '', newerVersion: '' };
    }
    const activeIndex = versions.findIndex((version) => version.active);
    const newerIndex = activeIndex >= 0 ? activeIndex : 0;
    const newerVersion = versions[newerIndex].version;
    const olderVersion =
      versions[newerIndex + 1]?.version ??
      versions.find((version) => version.version !== newerVersion)?.version ??
      '';
    return { olderVersion, newerVersion };
  });

  readonly hasComparison = computed(() => {
    const comparison = this.comparison();
    return comparison.olderVersion.length > 0 && comparison.newerVersion.length > 0;
  });

  async load(): Promise<void> {
    this.listState.set('loading');
    this.loadError.set(null);
    try {
      const response = await this.api.getVersions();
      const versions = [...response.versions].sort(
        (left, right) => versionWeight(right.version) - versionWeight(left.version),
      );
      this.versions.set(versions);
      const active = versions.find((version) => version.active) ?? null;
      this.modelVersion.ensureVersions(
        versions.map((version) => ({
          version: version.version,
          type: version.type,
          trainedAt: version.trainedAt,
          sampleCount: version.sampleSize,
          active: version.version === active?.version,
        })),
      );
      if (active !== null) {
        this.modelVersion.setActiveVersion(active.version);
      }
      await this.refreshComparison();
      this.listState.set('ok');
    } catch {
      this.versions.set([]);
      this.classAccuracies.set([]);
      this.loadError.set('Unable to load model versions.');
      this.listState.set('error');
    }
  }

  async getVersionDetails(version: string): Promise<VersionDetails | null> {
    try {
      return await this.api.getVersionDetails(version);
    } catch {
      this.toast.show(`Unable to load details for ${version}.`, 'error');
      return null;
    }
  }

  async activateVersion(version: string): Promise<boolean> {
    this.toast.dismissAll();
    try {
      const response = await this.api.activateVersion(version);
      if (!response.success) {
        throw new Error('Activation failed.');
      }
      this.versions.update((versions) =>
        versions.map((item) => ({
          ...item,
          active: item.version === response.activatedVersion,
        })),
      );
      this.modelVersion.setActiveVersion(response.activatedVersion);
      await this.refreshComparison();
      this.toast.show(
        `Activated ${response.activatedVersion} (${response.durationMs} ms).`,
        'success',
      );
      this.operationLog.add({
        operator: 'Administrator',
        format: 'Activate model version',
        scope: `Version ${response.activatedVersion}`,
        recordCount: 0,
        deleted: false,
      });
      return true;
    } catch {
      this.toast.show(`Unable to activate ${version}.`, 'error');
      return false;
    }
  }

  private async refreshComparison(): Promise<void> {
    const comparison = this.comparison();
    if (comparison.olderVersion.length === 0 || comparison.newerVersion.length === 0) {
      this.classAccuracies.set([]);
      return;
    }
    try {
      const response: GetClassAccuracyResponse = await this.api.getClassAccuracy(
        comparison.olderVersion,
        comparison.newerVersion,
      );
      this.classAccuracies.set(response.classAccuracies);
    } catch {
      this.classAccuracies.set([]);
    }
  }
}
