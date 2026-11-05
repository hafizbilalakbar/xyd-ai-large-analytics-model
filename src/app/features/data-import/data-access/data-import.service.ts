import { Injectable } from '@angular/core';
import { computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../../../shared/services/toast.service';
import { ImportApiService } from './import-api.service';
import { ImportParserService } from './import-parser.service';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  IMPORT_FILE_EXTENSIONS,
  ImportTab,
  ImportProgressState,
  ImportStatus,
  BatchOption,
  PlaybackCurveItem,
  TrainingRow,
  TrainingRowStatus,
  DuplicateMode,
  DuplicateTag,
  TrainingSource,
  WriteTrainingResult,
} from './data-import.models';
import { validateTrainingRow } from './import-constants';
import {
  USE_DATA_IMPORT_MOCK,
  generateMockPlaybackItems,
  generateMockTrainingRows,
} from './data-import.mock';

const EXISTING_TRAINING_ROWS: readonly TrainingRow[] = USE_DATA_IMPORT_MOCK
  ? generateMockTrainingRows()
  : [];

function idleProgress(): ImportProgressState {
  return { status: 'idle', percent: 0, stage: '', fileName: '', elapsedMs: 0 };
}

function timeValue(value: string): number {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

interface FingerprintedFile {
  readonly file: File;
  readonly fingerprint: string;
}

@Injectable({ providedIn: 'root' })
export class DataImportService {
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly api = inject(ImportApiService);
  private readonly parser = inject(ImportParserService);

  readonly activeTab = signal<ImportTab>('playback');
  readonly subtitle = computed(() => {
    const tab = this.activeTab();
    if (tab === 'training') {
      return 'Preview and import the corrected sample.';
    }
    return 'Temporarily view curves and make judgments.';
  });

  readonly batches = signal<BatchOption[]>([]);
  readonly batchesLoading = signal(false);

  readonly playbackItems = signal<PlaybackCurveItem[]>([]);
  readonly selectedPlaybackId = signal<string | null>(null);
  readonly playbackSearch = signal('');
  readonly playbackFilter = signal<'all' | 'PASS' | 'FAIL' | 'Pending'>('all');
  readonly playbackSort = signal<'name' | 'time'>('time');
  readonly playbackPage = signal(1);
  readonly playbackPageSize = signal(20);
  readonly playbackProgress = signal<ImportProgressState>(idleProgress());
  readonly playbackImportErrors = signal<{ fileName: string; rowIndex?: number; message: string }[]>([]);

  readonly trainingRows = signal<TrainingRow[]>([]);
  readonly trainingSelectedIds = signal<Set<string>>(new Set());
  readonly trainingFilter = signal<'all' | TrainingRowStatus>('all');
  readonly duplicateMode = signal<DuplicateMode>('skip');
  readonly trainingPage = signal(1);
  readonly trainingPageSize = signal(20);
  readonly trainingProgress = signal<ImportProgressState>(idleProgress());
  readonly trainingImportErrors = signal<{ fileName: string; rowIndex?: number; message: string }[]>([]);

  readonly playbackIsImporting = signal(false);
  readonly trainingIsImporting = signal(false);
  readonly isImporting = computed(() => this.playbackIsImporting() || this.trainingIsImporting());

  private playbackStartTime = 0;
  private trainingStartTime = 0;
  private elapsedTimer: ReturnType<typeof setInterval> | null = null;

  private nextTrainingRowNumber = 1;
  private importSequence = 0;

  private readonly existingTrainingSampleIds = new Set(
    EXISTING_TRAINING_ROWS.map((row) => row.sampleId.trim()).filter((id) => id.length > 0),
  );
  private readonly existingTrainingLockTimes = new Map(
    EXISTING_TRAINING_ROWS.map((row) => [row.sampleId.trim(), row.lockingTime] as const).filter(
      ([id]) => id.length > 0,
    ),
  );
  private readonly trainingFingerprints = new Map<string, string>();
  private readonly playbackFingerprints = new Map<string, Set<string>>();

  readonly selectedPlaybackItem = computed(
    () => this.playbackItems().find((item) => item.id === this.selectedPlaybackId()) ?? null,
  );

  readonly filteredPlaybackItems = computed(() => {
    let items = this.playbackItems();
    const search = this.playbackSearch().trim().toLowerCase();
    if (search) {
      items = items.filter(
        (item) =>
          item.fileName.toLowerCase().includes(search) ||
          item.sampleId.toLowerCase().includes(search),
      );
    }
    const filter = this.playbackFilter();
    if (filter !== 'all') {
      items = items.filter((item) => item.result === filter);
    }
    const sort = this.playbackSort();
    items = [...items].sort((a, b) => {
      if (sort === 'name') return a.fileName.localeCompare(b.fileName);
      return a.lockingTime.localeCompare(b.lockingTime);
    });
    return items;
  });

  readonly pagedPlaybackItems = computed(() => {
    const start = (this.playbackPage() - 1) * this.playbackPageSize();
    return this.filteredPlaybackItems().slice(start, start + this.playbackPageSize());
  });

  readonly playbackTotalCount = computed(() => this.filteredPlaybackItems().length);

  readonly playbackCounts = computed(() => {
    const items = this.playbackItems();
    return {
      total: items.length,
      pass: items.filter((item) => item.result === 'PASS').length,
      fail: items.filter((item) => item.result === 'FAIL').length,
      warning: items.filter((item) => item.warning).length,
    };
  });

  readonly filteredTrainingRows = computed(() => {
    const rows = this.trainingRows();
    const filter = this.trainingFilter();
    if (filter === 'all') return rows;
    return rows.filter((row) => row.status === filter);
  });

  readonly pagedTrainingRows = computed(() => {
    const start = (this.trainingPage() - 1) * this.trainingPageSize();
    return this.filteredTrainingRows().slice(start, start + this.trainingPageSize());
  });

  readonly trainingTotalCount = computed(() => this.filteredTrainingRows().length);
  readonly trainingRowCount = computed(() => this.trainingRows().length);

  readonly trainingCounts = computed(() => {
    const rows = this.trainingRows();
    return {
      total: rows.length,
      valid: rows.filter((row) => row.status === 'Valid').length,
      warning: rows.filter((row) => row.status === 'Warning').length,
      error: rows.filter((row) => row.status === 'Error').length,
    };
  });

  readonly trainingSources = computed<TrainingSource[]>(() => {
    const counts = new Map<string, number>();
    for (const row of this.trainingRows()) {
      counts.set(row.fileName, (counts.get(row.fileName) ?? 0) + 1);
    }
    return [...counts.entries()].map(([fileName, rowCount]) => ({ fileName, rowCount }));
  });

  readonly trainingSelectedValidRows = computed(() => {
    const selected = this.trainingSelectedIds();
    return this.trainingRows().filter((row) => row.status === 'Valid' && selected.has(row.id));
  });

  readonly trainingSelectedCount = computed(() => this.trainingSelectedValidRows().length);
  readonly canWriteTraining = computed(() => this.trainingSelectedCount() > 0);
  readonly trainingWriteCount = computed(() => this.trainingSelectedCount());

  constructor() {
    this.loadBatches();
  }

  setTab(tab: ImportTab): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  setPlaybackSearch(value: string): void {
    this.playbackSearch.set(value);
    this.playbackPage.set(1);
  }

  setPlaybackFilter(value: 'all' | 'PASS' | 'FAIL' | 'Pending'): void {
    this.playbackFilter.set(value);
    this.playbackPage.set(1);
  }

  setPlaybackSort(value: 'name' | 'time'): void {
    this.playbackSort.set(value);
    this.playbackPage.set(1);
  }

  setPlaybackPage(page: number): void {
    this.playbackPage.set(page);
  }

  setPlaybackPageSize(size: number): void {
    this.playbackPageSize.set(size);
    this.playbackPage.set(1);
  }

  selectPlayback(id: string): void {
    this.selectedPlaybackId.set(id);
  }

  selectNextPlayback(): void {
    const items = this.filteredPlaybackItems();
    const current = this.selectedPlaybackId();
    const index = items.findIndex((item) => item.id === current);
    const next = items[index + 1] ?? items[0];
    if (next) this.selectedPlaybackId.set(next.id);
  }

  selectPreviousPlayback(): void {
    const items = this.filteredPlaybackItems();
    const current = this.selectedPlaybackId();
    const index = items.findIndex((item) => item.id === current);
    const prev = items[index - 1] ?? items[items.length - 1];
    if (prev) this.selectedPlaybackId.set(prev.id);
  }

  clearPlaybackItems(): void {
    this.playbackItems.set([]);
    this.selectedPlaybackId.set(null);
    this.playbackSearch.set('');
    this.playbackFilter.set('all');
    this.playbackSort.set('time');
    this.playbackPage.set(1);
    this.playbackFingerprints.clear();
    this.playbackImportErrors.set([]);
    this.resetPlaybackImportState();
  }

  removePlaybackItem(id: string): void {
    const items = this.playbackItems();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return;
    const next = items.filter((item) => item.id !== id);
    this.playbackItems.set(next);
    if (this.selectedPlaybackId() === id) {
      const fallback = next[Math.min(index, next.length - 1)] ?? null;
      this.selectedPlaybackId.set(fallback ? fallback.id : null);
    }
    if (next.length === 0) {
      this.playbackFingerprints.clear();
      this.playbackImportErrors.set([]);
      this.resetPlaybackImportState();
    }
    this.clampPlaybackPage();
    this.toastService.show('Curve removed.', 'info');
  }

  reJudgeSelected(): void {
    const item = this.selectedPlaybackItem();
    if (!item) return;
    const peak = Math.max(...item.curve.map((point) => point.torque));
    const result = peak > 2 ? 'PASS' : 'FAIL';
    this.playbackItems.update((items) =>
      items.map((current) => (current.id === item.id ? { ...current, result } : current)),
    );
  }

  setTrainingFilter(value: 'all' | TrainingRowStatus): void {
    this.trainingFilter.set(value);
    this.trainingPage.set(1);
  }

  setTrainingPage(page: number): void {
    this.trainingPage.set(page);
  }

  setTrainingPageSize(size: number): void {
    this.trainingPageSize.set(size);
    this.trainingPage.set(1);
  }

  toggleTrainingRow(id: string): void {
    const row = this.trainingRows().find((item) => item.id === id);
    if (!row || row.status !== 'Valid') return;
    this.trainingSelectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleTrainingSelectAll(selected: boolean): void {
    const selectableIds = this.pagedTrainingRows()
      .filter((row) => row.status === 'Valid')
      .map((row) => row.id);
    this.trainingSelectedIds.update((set) => {
      const next = new Set(set);
      selectableIds.forEach((id) => {
        if (selected) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }

  clearTrainingSelection(): void {
    this.trainingSelectedIds.set(new Set());
  }

  setDuplicateMode(mode: DuplicateMode): void {
    this.duplicateMode.set(mode);
    this.applyDuplicateRules(this.trainingRows(), mode);
    this.pruneTrainingSelection();
    this.clampTrainingPage();
  }

  async importPlayback(batchId: string, files: File[]): Promise<void> {
    if (this.playbackIsImporting()) return;
    const validation = this.validateFiles(files);
    if (validation.errors.length > 0) {
      this.toastService.show(validation.errors[0], 'error');
      if (validation.valid.length === 0) return;
    }
    this.playbackImportErrors.set([]);
    this.startPlaybackImport();
    try {
      const { fresh, skipped } = await this.splitNewPlaybackFiles(batchId, validation.valid);
      if (skipped.length > 0) {
        this.toastService.show(`${skipped[0].name} is already loaded. Skipped.`, 'warning');
      }
      if (fresh.length === 0) return;

      const result = await this.parser.parsePlayback(
        fresh.map((entry) => entry.file),
        batchId,
      );
      const imported = result.items;

      this.playbackImportErrors.set([...result.errors]);

      if (imported.length > 0) {
        const merged = [...this.playbackItems(), ...imported];
        this.playbackItems.set(merged);
        this.playbackFilter.set('all');
        this.playbackSearch.set('');
        this.playbackPage.set(1);
        this.selectedPlaybackId.set(imported[0].id);
        const batchFingerprints = this.playbackFingerprints.get(batchId) ?? new Set<string>();
        fresh.forEach((entry) => batchFingerprints.add(entry.fingerprint));
        this.playbackFingerprints.set(batchId, batchFingerprints);
      }

      this.playbackProgress.set({
        status: 'done',
        percent: 100,
        stage: 'Import complete',
        fileName: fresh[fresh.length - 1]?.file.name ?? '',
        elapsedMs: Math.round(performance.now() - this.playbackStartTime),
      });

      if (imported.length === 0) {
        this.toastService.show(
          `Import failed. ${result.errors[0]?.message ?? 'No curve data found in the selected file.'}`,
          'error',
        );
      } else if (result.errors.length > 0) {
        this.toastService.show(
          `${imported.length} curves imported, ${result.errors.length} file(s) failed. Download the error report.`,
          'warning',
        );
      } else {
        this.toastService.show(`Import complete. ${imported.length} curves imported.`, 'success');
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (error) {
      this.handleImportError(error, 'playback');
    } finally {
      this.stopElapsedTimer();
      this.resetPlaybackImportState();
    }
  }

  async importTraining(files: File[]): Promise<void> {
    if (this.trainingIsImporting()) return;
    const validation = this.validateFiles(files);
    if (validation.errors.length > 0) {
      this.toastService.show(validation.errors[0], 'error');
      if (validation.valid.length === 0) return;
    }
    this.trainingImportErrors.set([]);
    this.startTrainingImport();
    try {
      const { fresh, skipped } = await this.splitNewTrainingFiles(validation.valid);
      if (skipped.length > 0) {
        this.toastService.show(`${skipped[0].name} is already loaded. Skipped.`, 'warning');
      }
      if (fresh.length === 0) return;

      const result = await this.parser.parseTraining(fresh.map((entry) => entry.file));
      const sequence = this.importSequence++;
      const incoming: TrainingRow[] = result.rows.map((row) => ({
        ...row,
        id: `${row.id}-${sequence}`,
        rowIndex: this.nextTrainingRowNumber++,
        edited: false,
      }));

      const merged = [...this.trainingRows(), ...incoming];
      this.applyDuplicateRules(merged, this.duplicateMode());
      this.trainingImportErrors.set([...result.errors]);
      this.trainingPage.set(1);

      if (incoming.length > 0) {
        fresh.forEach((entry) => this.trainingFingerprints.set(entry.fingerprint, entry.file.name));
      }

      if (incoming.length === 0) {
        this.toastService.show(
          `Import failed. ${result.errors[0]?.message ?? 'No rows found in the selected file.'}`,
          'error',
        );
      } else if (result.errors.length > 0) {
        this.toastService.show(
          `${incoming.length} rows imported, ${result.errors.length} file(s) failed. Download the error report.`,
          'warning',
        );
      } else {
        this.toastService.show(
          `Import complete. ${incoming.length} rows loaded. Review them, then write to the training set.`,
          'success',
        );
      }
    } catch (error) {
      this.handleImportError(error, 'training');
    } finally {
      this.stopElapsedTimer();
      this.resetTrainingImportState();
    }
  }

  cancelImport(): void {
    this.parser.cancel();
    this.stopElapsedTimer();
    this.playbackIsImporting.set(false);
    this.trainingIsImporting.set(false);
    this.playbackProgress.set(idleProgress());
    this.trainingProgress.set(idleProgress());
    this.toastService.show('Import cancelled.', 'info');
  }

  async writeTrainingSet(): Promise<WriteTrainingResult | null> {
    const rows = this.trainingSelectedValidRows();
    if (rows.length === 0) return null;
    this.startTrainingImport('saving');
    try {
      const prepared = this.prepareRowsForWrite(rows);
      const result = await this.api.writeTrainingSet(prepared, this.duplicateMode());
      if (this.duplicateMode() === 'rename') {
        const renamed = new Map(prepared.map((row, index) => [rows[index].id, row.sampleId] as const));
        const updated = this.trainingRows().map((row) => {
          const sampleId = renamed.get(row.id);
          return sampleId ? { ...row, sampleId } : row;
        });
        this.applyDuplicateRules(updated, this.duplicateMode());
      }
      this.trainingSelectedIds.set(new Set());
      this.toastService.show(`${result.written} samples written to the training set.`, 'success');
      return result;
    } catch (error) {
      this.handleImportError(error, 'training');
      return null;
    } finally {
      this.stopElapsedTimer();
      this.resetTrainingImportState();
    }
  }

  downloadErrorReport(tab: ImportTab): void {
    if (tab === 'training') {
      const rowErrors = this.trainingRows()
        .filter((row) => row.status === 'Error')
        .map((row) => ({
          fileName: row.fileName,
          rowIndex: row.rowIndex,
          message: row.reason || 'Invalid row.',
        }));
      this.api.downloadErrorReport([...this.trainingImportErrors(), ...rowErrors]);
      return;
    }
    this.api.downloadErrorReport(this.playbackImportErrors());
  }

  downloadTemplate(): void {
    this.api.downloadTemplate();
  }

  downloadPlaybackTemplate(): void {
    this.api.downloadPlaybackTemplate();
  }

  validateFiles(files: File[]): { valid: File[]; errors: string[] } {
    const valid: File[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!IMPORT_FILE_EXTENSIONS.includes(ext)) {
        errors.push(`${file.name}: Unsupported file type.`);
      } else if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`${file.name}: File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
      } else if (file.size === 0) {
        errors.push(`${file.name}: Empty file.`);
      } else {
        valid.push(file);
      }
    }
    return { valid, errors };
  }

  loadMockPlayback(batchId: string): void {
    this.playbackItems.set(generateMockPlaybackItems(batchId));
    this.selectedPlaybackId.set(this.playbackItems()[0]?.id ?? null);
  }

  loadMockTraining(): void {
    const rows = generateMockTrainingRows().map((row) => ({
      ...row,
      fileName: 'mock-training.csv',
      failureModeRaw: row.failureMode,
      edited: false,
    }));
    this.nextTrainingRowNumber = rows.length + 1;
    this.applyDuplicateRules(rows, this.duplicateMode());
    this.trainingSelectedIds.set(new Set());
  }

  removeRow(id: string): void {
    const rows = this.trainingRows();
    if (!rows.some((row) => row.id === id)) return;
    this.applyDuplicateRules(
      rows.filter((row) => row.id !== id),
      this.duplicateMode(),
    );
    this.trainingSelectedIds.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    this.pruneTrainingSelection();
    this.clampTrainingPage();
    if (this.trainingRows().length === 0) {
      this.trainingFingerprints.clear();
      this.trainingImportErrors.set([]);
      this.resetTrainingImportState();
    }
    this.toastService.show('Row removed.', 'info');
  }

  removeRows(ids: string[]): void {
    if (ids.length === 0) return;
    const removed = new Set(ids);
    this.applyDuplicateRules(
      this.trainingRows().filter((row) => !removed.has(row.id)),
      this.duplicateMode(),
    );
    this.trainingSelectedIds.update((set) => {
      const next = new Set(set);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    this.pruneTrainingSelection();
    this.clampTrainingPage();
    if (this.trainingRows().length === 0) {
      this.trainingFingerprints.clear();
      this.trainingImportErrors.set([]);
      this.resetTrainingImportState();
    }
    this.toastService.show(`${ids.length} ${ids.length === 1 ? 'row' : 'rows'} removed.`, 'info');
  }

  clearAll(): void {
    this.trainingRows.set([]);
    this.trainingSelectedIds.set(new Set());
    this.trainingImportErrors.set([]);
    this.trainingFilter.set('all');
    this.trainingPage.set(1);
    this.trainingFingerprints.clear();
    this.resetTrainingImportState();
    this.toastService.show('All rows cleared.', 'info');
  }

  updateRow(id: string, changes: Partial<TrainingRow>): void {
    const rows = this.trainingRows();
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) return;
    const previous = rows[index];
    const updated: TrainingRow = {
      ...previous,
      ...changes,
      id: previous.id,
      fileName: previous.fileName,
      rowIndex: previous.rowIndex,
      edited: true,
    };
    const next = [...rows];
    next[index] = updated;
    this.applyDuplicateRules(next, this.duplicateMode());
    this.pruneTrainingSelection();
    this.toastService.show('Row updated.', 'info');
  }

  removeSource(fileName: string): void {
    const rows = this.trainingRows();
    const removedIds = rows.filter((row) => row.fileName === fileName).map((row) => row.id);
    if (removedIds.length === 0) return;
    const removed = new Set(removedIds);
    this.applyDuplicateRules(
      rows.filter((row) => !removed.has(row.id)),
      this.duplicateMode(),
    );
    this.trainingSelectedIds.update((set) => {
      const next = new Set(set);
      removedIds.forEach((id) => next.delete(id));
      return next;
    });
    for (const [fingerprint, name] of [...this.trainingFingerprints.entries()]) {
      if (name === fileName) this.trainingFingerprints.delete(fingerprint);
    }
    this.pruneTrainingSelection();
    this.clampTrainingPage();
    if (this.trainingRows().length === 0) {
      this.trainingFingerprints.clear();
      this.trainingImportErrors.set([]);
      this.resetTrainingImportState();
    }
    this.toastService.show(
      `${removedIds.length} ${removedIds.length === 1 ? 'row' : 'rows'} removed.`,
      'info',
    );
  }

  private applyDuplicateRules(rows: TrainingRow[], mode: DuplicateMode): void {
    const bases = rows.map((row) => this.validateBaseRow(row));
    const marked = rows.map((row, index) => ({
      ...row,
      status: bases[index].status,
      reason: bases[index].reason,
      duplicateTag: undefined as DuplicateTag | undefined,
    }));

    const groups = new Map<string, number[]>();
    rows.forEach((row, index) => {
      const sampleId = row.sampleId.trim();
      if (!sampleId) return;
      const indexes = groups.get(sampleId) ?? [];
      indexes.push(index);
      groups.set(sampleId, indexes);
    });

    for (const [sampleId, indexes] of groups) {
      const matchesExisting = this.existingTrainingSampleIds.has(sampleId);
      const existingTime = this.existingTrainingLockTimes.get(sampleId) ?? '';

      if (mode === 'skip' || mode === 'error') {
        indexes.forEach((index, position) => {
          if (position === 0 && !matchesExisting) return;
          if (mode === 'error') {
            this.mark(marked, index, 'Error', 'Duplicate Sample ID');
          } else if (marked[index].status !== 'Error') {
            this.mark(marked, index, 'Warning', 'Duplicate Sample ID');
          }
        });
        continue;
      }

      if (mode === 'rename') {
        indexes.forEach((index, position) => {
          if (position === 0 && !matchesExisting) return;
          if (marked[index].status === 'Error') return;
          this.mark(marked, index, 'Valid', 'Will be renamed', 'rename');
        });
        continue;
      }

      if (mode === 'overwrite') {
        if (indexes.length === 1) {
          const index = indexes[0];
          if (matchesExisting && marked[index].status !== 'Error') {
            this.mark(marked, index, 'Valid', 'Will overwrite', 'overwrite');
          }
          continue;
        }
        indexes.slice(0, -1).forEach((index) => {
          if (marked[index].status === 'Error') return;
          this.mark(marked, index, 'Warning', 'Replaced by a later row');
        });
        const last = indexes[indexes.length - 1];
        if (marked[last].status !== 'Error') {
          if (matchesExisting) {
            this.mark(marked, last, 'Valid', 'Will overwrite', 'overwrite');
          } else {
            this.mark(marked, last, 'Valid', '');
          }
        }
        continue;
      }

      if (indexes.length === 1 && !matchesExisting) {
        continue;
      }

      let latestIndex = indexes[0];
      indexes.forEach((index) => {
        if (timeValue(rows[index].lockingTime) >= timeValue(rows[latestIndex].lockingTime)) {
          latestIndex = index;
        }
      });
      const existingIsNewer = matchesExisting && timeValue(existingTime) > timeValue(rows[latestIndex].lockingTime);
      indexes.forEach((index) => {
        if (marked[index].status === 'Error') return;
        if (index === latestIndex && !existingIsNewer) {
          this.mark(marked, index, 'Valid', '');
        } else {
          this.mark(marked, index, 'Warning', 'Older copy');
        }
      });
    }

    this.trainingRows.set(marked);
  }

  private mark(
    rows: TrainingRow[],
    index: number,
    status: TrainingRowStatus,
    reason: string,
    tag?: DuplicateTag,
  ): void {
    rows[index] = { ...rows[index], status, reason, duplicateTag: tag };
  }

  private validateBaseRow(
    row: TrainingRow,
  ): ReturnType<typeof validateTrainingRow> {
    return validateTrainingRow(
      {
        sampleId: row.sampleId,
        lockingTime: row.lockingTime,
        failureMode: row.failureMode,
        confidence: row.confidence,
        modelVersion: row.modelVersion,
      },
      [],
      row.id,
    );
  }

  private prepareRowsForWrite(rows: TrainingRow[]): TrainingRow[] {
    if (this.duplicateMode() !== 'rename') return rows;
    const used = new Set<string>([
      ...this.existingTrainingSampleIds,
      ...this.trainingRows().map((row) => row.sampleId.trim()).filter((id) => id.length > 0),
    ]);
    return rows.map((row) => {
      if (row.duplicateTag !== 'rename') return row;
      const base = row.sampleId.trim();
      let suffix = 2;
      let candidate = `${base}-${suffix}`;
      while (used.has(candidate)) {
        suffix += 1;
        candidate = `${base}-${suffix}`;
      }
      used.add(candidate);
      return { ...row, sampleId: candidate };
    });
  }

  private pruneTrainingSelection(): void {
    const validIds = new Set(
      this.trainingRows().filter((row) => row.status === 'Valid').map((row) => row.id),
    );
    this.trainingSelectedIds.update(
      (set) => new Set([...set].filter((id) => validIds.has(id))),
    );
  }

  private async splitNewTrainingFiles(
    files: File[],
  ): Promise<{ fresh: FingerprintedFile[]; skipped: File[] }> {
    const fresh: FingerprintedFile[] = [];
    const skipped: File[] = [];
    const seen = new Set<string>();
    for (const file of files) {
      const fingerprint = await this.fingerprintFile(file);
      if (seen.has(fingerprint) || this.trainingFingerprints.has(fingerprint)) {
        skipped.push(file);
      } else {
        seen.add(fingerprint);
        fresh.push({ file, fingerprint });
      }
    }
    return { fresh, skipped };
  }

  private async splitNewPlaybackFiles(
    batchId: string,
    files: File[],
  ): Promise<{ fresh: FingerprintedFile[]; skipped: File[] }> {
    const fresh: FingerprintedFile[] = [];
    const skipped: File[] = [];
    const seen = new Set<string>();
    const loaded = this.playbackFingerprints.get(batchId) ?? new Set<string>();
    for (const file of files) {
      const fingerprint = await this.fingerprintFile(file);
      if (seen.has(fingerprint) || loaded.has(fingerprint)) {
        skipped.push(file);
      } else {
        seen.add(fingerprint);
        fresh.push({ file, fingerprint });
      }
    }
    return { fresh, skipped };
  }

  private async fingerprintFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    let hash = String(buffer.byteLength);
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
      hash = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    }
    return `${file.name}|${file.size}|${file.lastModified}|${hash}`;
  }

  private clampTrainingPage(): void {
    const total = this.filteredTrainingRows().length;
    const size = this.trainingPageSize();
    const maxPage = Math.max(1, Math.ceil(total / size));
    if (this.trainingPage() > maxPage) {
      this.trainingPage.set(maxPage);
    }
  }

  private clampPlaybackPage(): void {
    const total = this.filteredPlaybackItems().length;
    const size = this.playbackPageSize();
    const maxPage = Math.max(1, Math.ceil(total / size));
    if (this.playbackPage() > maxPage) {
      this.playbackPage.set(maxPage);
    }
  }

  private async loadBatches(): Promise<void> {
    this.batchesLoading.set(true);
    try {
      const data = await this.api.getBatches();
      this.batches.set(data);
    } finally {
      this.batchesLoading.set(false);
    }
  }

  private startPlaybackImport(status: ImportStatus = 'reading'): void {
    this.playbackIsImporting.set(true);
    this.playbackProgress.set({ status, percent: 0, stage: 'Preparing', fileName: '', elapsedMs: 0 });
    this.playbackStartTime = performance.now();
    this.startElapsedTimer('playback');
  }

  private startTrainingImport(status: ImportStatus = 'reading'): void {
    this.trainingIsImporting.set(true);
    this.trainingProgress.set({ status, percent: 0, stage: 'Preparing', fileName: '', elapsedMs: 0 });
    this.trainingStartTime = performance.now();
    this.startElapsedTimer('training');
  }

  private startElapsedTimer(tab: ImportTab): void {
    this.stopElapsedTimer();
    this.elapsedTimer = setInterval(() => {
      const progress = this.parser.progress();
      const elapsed = Math.round(
        performance.now() - (tab === 'playback' ? this.playbackStartTime : this.trainingStartTime),
      );
      if (tab === 'playback') {
        const current = this.playbackProgress();
        this.playbackProgress.set({
          ...current,
          elapsedMs: elapsed,
          status: progress ? progress.status : current.status,
          percent: progress ? progress.percent : current.percent,
          stage: progress ? progress.stage : current.stage,
          fileName: progress ? progress.fileName : current.fileName,
        });
      } else {
        const current = this.trainingProgress();
        this.trainingProgress.set({
          ...current,
          elapsedMs: elapsed,
          status: progress ? progress.status : current.status,
          percent: progress ? progress.percent : current.percent,
          stage: progress ? progress.stage : current.stage,
          fileName: progress ? progress.fileName : current.fileName,
        });
      }
    }, 200);
  }

  private stopElapsedTimer(): void {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  }

  private resetPlaybackImportState(): void {
    this.playbackIsImporting.set(false);
    this.playbackProgress.set(idleProgress());
  }

  private resetTrainingImportState(): void {
    this.trainingIsImporting.set(false);
    this.trainingProgress.set(idleProgress());
  }

  private handleImportError(error: unknown, tab: ImportTab): void {
    const message = error instanceof Error ? error.message : 'Import failed.';
    if (message === 'cancelled') {
      if (tab === 'playback') this.playbackProgress.set(idleProgress());
      else this.trainingProgress.set(idleProgress());
      return;
    }
    this.toastService.show(`Import failed. ${message}`, 'error');
  }
}
