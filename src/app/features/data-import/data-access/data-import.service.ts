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
  TrainingSource,
  WriteTrainingResult,
} from './data-import.models';
import { validateTrainingRow } from './import-constants';
import { generateMockPlaybackItems, generateMockTrainingRows } from './data-import.mock';

const BUSY_STATUSES: readonly ImportStatus[] = [
  'reading',
  'extracting',
  'detecting',
  'parsing',
  'validating',
  'saving',
];

function idleProgress(): ImportProgressState {
  return { status: 'idle', percent: 0, stage: '', fileName: '', elapsedMs: 0 };
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

  readonly playbackIsImporting = computed(() => BUSY_STATUSES.includes(this.playbackProgress().status));
  readonly trainingIsImporting = computed(() => BUSY_STATUSES.includes(this.trainingProgress().status));
  readonly isImporting = computed(() => this.playbackIsImporting() || this.trainingIsImporting());

  private playbackStartTime = 0;
  private trainingStartTime = 0;
  private elapsedTimer: ReturnType<typeof setInterval> | null = null;

  readonly selectedPlaybackItem = computed(() =>
    this.playbackItems().find((item) => item.id === this.selectedPlaybackId()) ?? null,
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
      pass: items.filter((i) => i.result === 'PASS').length,
      fail: items.filter((i) => i.result === 'FAIL').length,
      warning: items.filter((i) => i.warning).length,
    };
  });

  readonly filteredTrainingRows = computed(() => {
    let rows = this.trainingRows();
    const filter = this.trainingFilter();
    if (filter !== 'all') {
      rows = rows.filter((row) => row.status === filter);
    }
    return rows;
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
      valid: rows.filter((r) => r.status === 'Valid').length,
      warning: rows.filter((r) => r.status === 'Warning').length,
      error: rows.filter((r) => r.status === 'Error').length,
    };
  });

  readonly trainingSources = computed<TrainingSource[]>(() => {
    const counts = new Map<string, number>();
    for (const row of this.trainingRows()) {
      counts.set(row.fileName, (counts.get(row.fileName) ?? 0) + 1);
    }
    return [...counts.entries()].map(([fileName, rowCount]) => ({ fileName, rowCount }));
  });

  readonly trainingSelectedCount = computed(() => this.trainingSelectedValidRows().length);

  readonly trainingSelectedValidRows = computed(() =>
    this.trainingRows().filter((row) => row.status !== 'Error' && this.trainingSelectedIds().has(row.id)),
  );

  readonly canWriteTraining = computed(() => this.trainingSelectedCount() > 0);

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
    const index = items.findIndex((i) => i.id === current);
    const next = items[index + 1] ?? items[0];
    if (next) this.selectedPlaybackId.set(next.id);
  }

  selectPreviousPlayback(): void {
    const items = this.filteredPlaybackItems();
    const current = this.selectedPlaybackId();
    const index = items.findIndex((i) => i.id === current);
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
    this.playbackImportErrors.set([]);
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
    this.clampPlaybackPage();
    this.toastService.show('Curve removed.', 'info');
  }

  reJudgeSelected(): void {
    const item = this.selectedPlaybackItem();
    if (!item) return;
    const peak = Math.max(...item.curve.map((p) => p.torque));
    const result = peak > 2 ? 'PASS' : 'FAIL';
    this.playbackItems.update((items) =>
      items.map((i) => (i.id === item.id ? { ...i, result } : i)),
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
    const row = this.trainingRows().find((r) => r.id === id);
    if (!row || row.status === 'Error') return;
    this.trainingSelectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleTrainingSelectAll(selected: boolean): void {
    const validIds = this.filteredTrainingRows()
      .filter((r) => r.status !== 'Error')
      .map((r) => r.id);
    this.trainingSelectedIds.update((set) => {
      const next = new Set(set);
      validIds.forEach((id) => {
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
  }

  async importPlayback(batchId: string, files: File[]): Promise<void> {
    this.startPlaybackImport();
    try {
      const result = await this.parser.parsePlayback(files, batchId);
      await new Promise((resolve) => setTimeout(resolve, 400));
      const totalItems = result.items.length;
      const totalErrors = result.errors.length;
      const totalWarnings = result.items.filter((i) => i.warning).length;

      // Show progress done state
      this.playbackProgress.set({ ...this.playbackProgress(), status: 'done', percent: 100, stage: 'Import complete' });

      if (totalItems === 0 && totalErrors > 0) {
        // Nothing imported, show error with reason from first error
        this.playbackItems.set([]);
        this.playbackImportErrors.set([...result.errors]);
        this.playbackPage.set(1);
        this.toastService.show(
          `Import failed. ${result.errors[0]?.message || 'Import failed. Please check the file and try again.'}`,
          'error',
        );
      } else if (totalItems > 0 && totalErrors > 0) {
        // Some curves imported, some with warnings/errors
        this.playbackItems.set([...result.items]);
        this.playbackImportErrors.set([...result.errors]);
        this.playbackPage.set(1);
        this.toastService.show(
          `${totalItems} curves imported, ${totalErrors} file(s) failed. Download the error report.`,
          'warning',
        );
      } else if (totalItems > 0 && totalErrors === 0 && totalWarnings === 0) {
        // All good
        this.playbackItems.set([...result.items]);
        this.playbackImportErrors.set([]);
        this.playbackPage.set(1);
        this.toastService.show(`Import complete. ${totalItems} curves imported.`, 'success');
      } else if (totalItems > 0 && totalWarnings > 0 && totalErrors === 0) {
        // Some warnings
        this.playbackItems.set([...result.items]);
        this.playbackImportErrors.set([...result.errors]);
        this.playbackPage.set(1);
        this.toastService.show(
          `${totalItems} curves imported, ${totalWarnings} warning(s). Review the highlighted rows.`,
          'info',
        );
      } else {
        // Fallback
        this.playbackItems.set([...result.items]);
        this.playbackImportErrors.set([...result.errors]);
        this.playbackPage.set(1);
        this.toastService.show('Import completed.', 'info');
      }
    } catch (error) {
      this.handleImportError(error, 'playback');
    } finally {
      this.stopElapsedTimer();
    }
  }

  async importTraining(files: File[]): Promise<void> {
    this.startTrainingImport();
    try {
      const result = await this.parser.parseTraining(files);
      await new Promise((resolve) => setTimeout(resolve, 400));
      this.trainingProgress.set({ ...this.trainingProgress(), status: 'done', percent: 100, stage: 'Import complete' });

      const existing = this.trainingRows();
      const startIndex = existing.length + 1;
      const incoming = result.rows.map((row, i) => ({
        ...row,
        edited: false,
        rowIndex: startIndex + i,
      }));
      const merged = this.revalidate([...existing, ...incoming]);
      this.trainingRows.set(merged);
      this.trainingImportErrors.set([...result.errors]);
      this.trainingPage.set(1);
      const totalErrors = result.errors.length;
      const totalWarnings = merged.filter((r) => r.status === 'Warning').length;
      const totalValid = merged.filter((r) => r.status === 'Valid').length;

      if (incoming.length === 0 && totalErrors > 0) {
        // Nothing imported, show error with reason
        this.trainingImportErrors.set([...result.errors]);
        this.toastService.show(
          `Import failed. ${result.errors[0]?.message || 'Import failed. Please check the file and try again.'}`,
          'error',
        );
      } else if (totalErrors > 0) {
        // Some errors
        this.toastService.show(
          `${totalValid} rows imported, ${totalErrors} file(s) failed. Download the error report.`,
          'warning',
        );
      } else if (totalWarnings > 0) {
        // Some warnings
        this.toastService.show(
          `${totalValid} rows imported, ${totalWarnings} warning(s). Review the highlighted rows.`,
          'info',
        );
      } else {
        // All good
        this.toastService.show(`Import complete. ${incoming.length} rows loaded. Review them, then write to the training set.`, 'success');
      }
    } catch (error) {
      this.handleImportError(error, 'training');
    } finally {
      this.stopElapsedTimer();
    }
  }

  cancelImport(): void {
    this.parser.cancel();
    this.playbackProgress.update((state) => ({ ...state, status: 'cancelled' }));
    this.trainingProgress.update((state) => ({ ...state, status: 'cancelled' }));
    this.stopElapsedTimer();
    this.toastService.show('Import cancelled.', 'info');
  }

  async writeTrainingSet(): Promise<WriteTrainingResult | null> {
    const rows = this.trainingSelectedValidRows();
    if (rows.length === 0) return null;
    this.startTrainingImport('saving');
    try {
      const result = await this.api.writeTrainingSet(rows, this.duplicateMode());
      await new Promise((resolve) => setTimeout(resolve, 400));
      this.trainingProgress.set({ ...this.trainingProgress(), status: 'done', percent: 100, stage: 'Import complete' });
      this.toastService.show(`${result.written} samples written to the training set.`, 'success');
      this.trainingSelectedIds.set(new Set());
      return result;
    } catch (error) {
      this.handleImportError(error, 'training');
      return null;
    } finally {
      this.stopElapsedTimer();
    }
  }

  downloadErrorReport(tab: ImportTab): void {
    const errors = tab === 'training' ? this.trainingImportErrors() : this.playbackImportErrors();
    this.api.downloadErrorReport(errors);
  }

  downloadTemplate(): void {
    this.api.downloadTemplate();
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
    const rows = this.revalidate(
      generateMockTrainingRows().map((row) => ({ ...row, fileName: 'mock-training.csv', failureModeRaw: row.failureMode, edited: false })),
    );
    this.trainingRows.set(rows);
    this.trainingSelectedIds.set(new Set());
  }

  removeRow(id: string): void {
    const rows = this.trainingRows();
    if (!rows.some((row) => row.id === id)) return;
    this.trainingRows.set(this.revalidate(rows.filter((row) => row.id !== id)));
    this.trainingSelectedIds.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    this.clampTrainingPage();
    this.toastService.show('Row removed.', 'info');
  }

  removeRows(ids: string[]): void {
    if (ids.length === 0) return;
    const removed = new Set(ids);
    const rows = this.trainingRows();
    this.trainingRows.set(this.revalidate(rows.filter((row) => !removed.has(row.id))));
    this.trainingSelectedIds.update((set) => {
      const next = new Set(set);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    this.clampTrainingPage();
    this.toastService.show(`${ids.length} ${ids.length === 1 ? 'row' : 'rows'} removed.`, 'info');
  }

  clearAll(): void {
    this.trainingRows.set([]);
    this.trainingSelectedIds.set(new Set());
    this.trainingImportErrors.set([]);
    this.trainingFilter.set('all');
    this.trainingPage.set(1);
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
    this.trainingRows.set(this.revalidate(next));
    if (previous.status === 'Error' && updated.status !== 'Error') {
      this.trainingSelectedIds.update((set) => {
        const nextSet = new Set(set);
        nextSet.add(id);
        return nextSet;
      });
    }
    this.toastService.show('Row updated.', 'info');
  }

  removeSource(fileName: string): void {
    const rows = this.trainingRows();
    const removedIds = rows.filter((row) => row.fileName === fileName).map((row) => row.id);
    if (removedIds.length === 0) return;
    const removed = new Set(removedIds);
    this.trainingRows.set(this.revalidate(rows.filter((row) => !removed.has(row.id))));
    this.trainingSelectedIds.update((set) => {
      const next = new Set(set);
      removedIds.forEach((id) => next.delete(id));
      return next;
    });
    this.clampTrainingPage();
    this.toastService.show(`${removedIds.length} ${removedIds.length === 1 ? 'row' : 'rows'} removed.`, 'info');
  }

  private revalidate(rows: TrainingRow[]): TrainingRow[] {
    return rows.map((row) => {
      const validation = validateTrainingRow(row, rows, row.id);
      if (row.status === validation.status && row.reason === validation.reason) return row;
      return { ...row, status: validation.status, reason: validation.reason };
    });
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
    this.playbackProgress.set({ status, percent: 0, stage: 'Preparing', fileName: '', elapsedMs: 0 });
    this.playbackStartTime = performance.now();
    this.startElapsedTimer('playback');
  }

  private startTrainingImport(status: ImportStatus = 'reading'): void {
    this.trainingProgress.set({ status, percent: 0, stage: 'Preparing', fileName: '', elapsedMs: 0 });
    this.trainingStartTime = performance.now();
    this.startElapsedTimer('training');
  }

  private startElapsedTimer(tab: ImportTab): void {
    this.stopElapsedTimer();
    this.elapsedTimer = setInterval(() => {
      const progress = this.parser.progress();
      const elapsed = Math.round(performance.now() - (tab === 'playback' ? this.playbackStartTime : this.trainingStartTime));
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

  private handleImportError(error: unknown, tab: ImportTab): void {
    const message = error instanceof Error ? error.message : 'Import failed.';
    if (message === 'cancelled') {
      if (tab === 'playback') {
        this.playbackProgress.update((state) => ({ ...state, status: 'cancelled' }));
      } else {
        this.trainingProgress.update((state) => ({ ...state, status: 'cancelled' }));
      }
      return;
    }
    if (tab === 'playback') {
      this.playbackProgress.update((state) => ({ ...state, status: 'failed' }));
    } else {
      this.trainingProgress.update((state) => ({ ...state, status: 'failed' }));
    }
    this.toastService.show('Import failed. Please check the file and try again.', 'error');
  }
}