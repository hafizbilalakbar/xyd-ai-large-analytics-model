import { Injectable, computed, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastService } from '../../../shared/services/toast.service';
import { ImportApiService } from './import-api.service';
import { ImportParserService } from './import-parser.service';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, IMPORT_FILE_EXTENSIONS } from './import-constants';
import { generateMockPlaybackItems, generateMockTrainingRows } from './data-import.mock';
import type {
  BatchOption,
  DuplicateMode,
  ImportStatus,
  ImportTab,
  PlaybackCurveItem,
  TrainingRow,
  TrainingRowStatus,
  WriteTrainingResult,
} from './data-import.models';

@Injectable()
export class DataImportService {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);
  private readonly api = inject(ImportApiService);
  private readonly parser = inject(ImportParserService);

  readonly activeTab = signal<ImportTab>('playback');
  readonly batches = signal<BatchOption[]>([]);
  readonly batchesLoading = signal(false);

  readonly playbackItems = signal<PlaybackCurveItem[]>([]);
  readonly selectedPlaybackId = signal<string | null>(null);
  readonly playbackSearch = signal('');
  readonly playbackFilter = signal<'all' | 'PASS' | 'FAIL' | 'Pending'>('all');
  readonly playbackSort = signal<'name' | 'time'>('time');
  readonly playbackPage = signal(1);
  readonly playbackPageSize = signal(20);

  readonly trainingRows = signal<TrainingRow[]>([]);
  readonly trainingSelectedIds = signal<Set<string>>(new Set());
  readonly trainingFilter = signal<'all' | TrainingRowStatus>('all');
  readonly duplicateMode = signal<DuplicateMode>('skip');
  readonly trainingPage = signal(1);
  readonly trainingPageSize = signal(20);

  readonly importStatus = signal<ImportStatus>('idle');
  readonly progressPercent = signal(0);
  readonly currentStage = signal('');
  readonly currentFileName = signal('');
  readonly importElapsedMs = signal(0);
  readonly importErrors = signal<{ fileName: string; rowIndex?: number; message: string }[]>([]);
  readonly isImporting = computed(() =>
    ['reading', 'extracting', 'detecting', 'parsing', 'validating', 'saving'].includes(this.importStatus()),
  );

  private importStartTime = 0;
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

  readonly trainingCounts = computed(() => {
    const rows = this.trainingRows();
    return {
      total: rows.length,
      valid: rows.filter((r) => r.status === 'Valid').length,
      warning: rows.filter((r) => r.status === 'Warning').length,
      error: rows.filter((r) => r.status === 'Error').length,
    };
  });

  readonly trainingSelectedCount = computed(() => this.trainingSelectedIds().size);
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
      relativeTo: this.route,
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
    this.playbackPage.set(1);
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
    this.startImport('reading');
    try {
      const result = await this.parser.parsePlayback(files, batchId);
      await new Promise((resolve) => setTimeout(resolve, 400));
      this.importStatus.set('done');
      this.playbackItems.set([...result.items]);
      this.importErrors.set([...result.errors]);
      if (result.items.length > 0) {
        this.selectedPlaybackId.set(result.items[0].id);
      }
      if (result.errors.length > 0) {
        this.toastService.show(
          `Import finished with ${result.errors.length} warnings. Download the error report.`,
          'info',
        );
      } else {
        this.toastService.show(`Import complete. ${result.items.length} curves imported.`, 'success');
      }
    } catch (error) {
      this.handleImportError(error);
    } finally {
      this.stopElapsedTimer();
    }
  }

  async importTraining(files: File[]): Promise<void> {
    this.startImport('reading');
    try {
      const result = await this.parser.parseTraining(files);
      await new Promise((resolve) => setTimeout(resolve, 400));
      this.importStatus.set('done');
      this.trainingRows.set([...result.rows]);
      this.importErrors.set([...result.errors]);
      this.trainingSelectedIds.set(new Set());
      if (result.errors.length > 0) {
        this.toastService.show(
          `Import finished with ${result.errors.length} warnings. Download the error report.`,
          'info',
        );
      } else {
        this.toastService.show('Format detected automatically.', 'info');
      }
    } catch (error) {
      this.handleImportError(error);
    } finally {
      this.stopElapsedTimer();
    }
  }

  cancelImport(): void {
    this.parser.cancel();
    this.importStatus.set('cancelled');
    this.stopElapsedTimer();
    this.toastService.show('Import cancelled.', 'info');
  }

  async writeTrainingSet(): Promise<WriteTrainingResult | null> {
    const rows = this.trainingSelectedValidRows();
    if (rows.length === 0) return null;
    this.startImport('saving');
    try {
      const result = await this.api.writeTrainingSet(rows, this.duplicateMode());
      await new Promise((resolve) => setTimeout(resolve, 400));
      this.importStatus.set('done');
      this.toastService.show(
        `${result.written} samples written to the training set.`,
        'success',
      );
      this.trainingSelectedIds.set(new Set());
      return result;
    } catch (error) {
      this.handleImportError(error);
      return null;
    } finally {
      this.stopElapsedTimer();
    }
  }

  downloadErrorReport(): void {
    this.api.downloadErrorReport(this.importErrors());
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
    this.trainingRows.set(generateMockTrainingRows());
    this.trainingSelectedIds.set(new Set());
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

  private startImport(status: ImportStatus): void {
    this.importStatus.set(status);
    this.progressPercent.set(0);
    this.currentStage.set('Preparing');
    this.currentFileName.set('');
    this.importElapsedMs.set(0);
    this.importStartTime = performance.now();
    this.stopElapsedTimer();
    this.elapsedTimer = setInterval(() => {
      this.importElapsedMs.set(Math.round(performance.now() - this.importStartTime));
      const p = this.parser.progress();
      if (p) {
        this.importStatus.set(p.status);
        this.progressPercent.set(p.percent);
        this.currentStage.set(p.stage);
        this.currentFileName.set(p.fileName);
      }
    }, 200);
  }

  private stopElapsedTimer(): void {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  }

  private handleImportError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Import failed.';
    if (message === 'cancelled') {
      this.importStatus.set('cancelled');
      return;
    }
    this.importStatus.set('failed');
    this.toastService.show('Import failed. Please check the file and try again.', 'error');
  }
}
