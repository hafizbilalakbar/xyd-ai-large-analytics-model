import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { ToastService } from '../../shared/services/toast.service';

export interface ImportedRow {
  sampleId: string;
  lockingTime: string;
  failureMode: string | null;
  corrected: boolean;
  confidence: number | null;
  modelVersion: string;
  originFile: string;
  _status: 'valid' | 'warning' | 'error';
  _reason?: string;
}

export interface ImportResult {
  validRows: number;
  warningRows: number;
  errorRows: number;
  totalRows: number;
  rows: ImportedRow[];
}

export interface SourceInfo {
  fileName: string;
  rowCount: number;
}

export interface PlaybackCurve {
  id: string;
  name: string;
  data: any;
  result: 'pass' | 'fail' | 'warning' | 'error';
}

@Injectable({ providedIn: 'root' })
export class DataImportService {
  private readonly toastService = inject(ToastService);
  readonly activeTab = signal<'playback' | 'training'>('training');

  // Training state
  readonly trainingRows = signal<ImportedRow[]>([]);
  readonly trainingSelection = signal<Set<string>>(new Set());
  readonly trainingFilterChip = signal<SourceInfo | null>(null);
  readonly trainingPage = signal(1);
  readonly trainingPageSize = signal(20);
  readonly trainingMapping = signal<any[]>([]);
  readonly trainingProgress = signal(false);

  // Playback state
  readonly playbackCurves = signal<PlaybackCurve[]>([]);
  readonly playbackSelection = signal<Set<string>>(new Set());
  readonly playbackPage = signal(1);
  readonly playbackPageSize = signal(20);

  // Shared
  readonly importResult = signal<ImportResult | null>(null);
  readonly sources = signal<SourceInfo[]>([]);
  readonly isLoading = signal(false);

  constructor() {
    effect(() => {
      const tab = this.activeTab();
      if (tab === 'playback') {
        this.sources.set([]);
      }
    });
  }

  getTrainingRows = computed(() => {
    const rows = this.trainingRows();
    const chip = this.trainingFilterChip();
    if (chip) {
      return rows.filter(r => r.originFile === chip.fileName);
    }
    return rows;
  });

  getTrainingPage = computed(() => this.trainingPage());
  getTrainingPageSize = computed(() => this.trainingPageSize());
  getTrainingTotal = computed(() => this.getTrainingRows().length);
  getTrainingPages = computed(() => Math.ceil(this.getTrainingTotal() / this.trainingPageSize()));
  getTrainingFrom = computed(() => {
    const total = this.getTrainingTotal();
    if (total === 0) return 0;
    return (this.trainingPage() - 1) * this.trainingPageSize() + 1;
  });
  getTrainingTo = computed(() => {
    const total = this.getTrainingTotal();
    if (total === 0) return 0;
    return Math.min(this.trainingPage() * this.trainingPageSize(), total);
  });

  getPlaybackCurves = computed(() => this.playbackCurves());
  getPlaybackPage = computed(() => this.playbackPage());
  getPlaybackPageSize = computed(() => this.playbackPageSize());
  getPlaybackTotal = computed(() => this.playbackCurves().length);
  getPlaybackPages = computed(() => Math.ceil(this.getPlaybackTotal() / this.playbackPageSize()));
  getPlaybackFrom = computed(() => {
    const total = this.getPlaybackTotal();
    if (total === 0) return 0;
    return (this.playbackPage() - 1) * this.playbackPageSize() + 1;
  });
  getPlaybackTo = computed(() => {
    const total = this.getPlaybackTotal();
    if (total === 0) return 0;
    return Math.min(this.playbackPage() * this.playbackPageSize(), total);
  });

  getSelectedCount = computed(() => {
    if (this.activeTab() === 'training') {
      return this.trainingSelection().size;
    }
    return this.playbackSelection().size;
  });

  getValidCount = computed(() => {
    const rows = this.getTrainingRows();
    return rows.filter(r => r._status === 'valid').length;
  });

  getWarningCount = computed(() => {
    const rows = this.getTrainingRows();
    return rows.filter(r => r._status === 'warning').length;
  });

  getErrorCount = computed(() => {
    const rows = this.getTrainingRows();
    return rows.filter(r => r._status === 'error').length;
  });

  getRemainingCount = computed(() => {
    const rows = this.getTrainingRows();
    return rows.filter(r => r._status !== 'error').length;
  });

  getIsImporting = computed(() => this.isLoading());

  // Actions
  setActiveTab(tab: 'playback' | 'training') {
    this.activeTab.set(tab);
  }

  loadFile(file: File, isPlayback = false) {
    this.isLoading.set(true);
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = e.target.result;
      if (isPlayback) {
        this.handlePlaybackData(data);
      } else {
        this.handleTrainingData(data, file.name);
      }
      this.isLoading.set(false);
    };
    reader.onerror = () => {
      this.isLoading.set(false);
      this.showToast('Failed to read file', 'error');
    };
    reader.readAsText(file);
  }

  private handleTrainingData(csv: string, fileName: string) {
    const lines = csv.split('\n').filter((l: string) => l.trim());
    if (lines.length < 2) {
      this.showToast('File has no data', 'error');
      this.trainingRows.set([]);
      this.sources.update(sources => [...sources, { fileName, rowCount: 0 }]);
      return;
    }

    const rows: ImportedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v: string) => v.trim());
      const row: ImportedRow = {
        sampleId: values[0] || '',
        lockingTime: values[1] || '',
        failureMode: values[2] || null,
        corrected: values[3] === 'true',
        confidence: values[4] ? Number(values[4]) : null,
        modelVersion: values[5] || '',
        originFile: fileName,
        _status: 'valid',
        _reason: undefined,
      };
      rows.push(row);
    }

    this.sources.update(sources => [...sources, { fileName, rowCount: rows.length }]);
    this.trainingRows.set(rows);
    this.showToast(`Imported ${rows.length} rows from ${fileName}`, 'info');
  }

  private handlePlaybackData(csv: string) {
    const lines = csv.split('\n').filter((l: string) => l.trim());
    const curves: PlaybackCurve[] = [];

    for (let i = 0; i < lines.length; i++) {
      const values = lines[i].split(',').map((v: string) => v.trim());
      if (values.length >= 3) {
        curves.push({
          id: values[0] || `curve-${i}`,
          name: values[1] || `Curve ${i}`,
          data: values.slice(2),
          result: 'pass',
        });
      }
    }

    this.playbackCurves.set(curves);
    this.showToast(`Loaded ${curves.length} curves`, 'info');
  }

  removeRow(rowId: string) {
    if (this.activeTab() === 'training') {
      this.trainingRows.update(rows => rows.filter(r => r.sampleId !== rowId));
      this.trainingSelection.update(selection => {
        const newSelection = new Set(selection);
        newSelection.delete(rowId);
        return newSelection;
      });
    } else {
      this.playbackCurves.update(curves => curves.filter(c => c.id !== rowId));
      this.playbackSelection.update(selection => {
        const newSelection = new Set(selection);
        newSelection.delete(rowId);
        return newSelection;
      });
    }
    this.showToast('Row removed', 'success');
  }

  removeRows(rowIds: string[]) {
    if (this.activeTab() === 'training') {
      this.trainingRows.update(rows => rows.filter(r => !rowIds.includes(r.sampleId)));
      this.trainingSelection.update(selection => {
        const newSelection = new Set(selection);
        rowIds.forEach(id => newSelection.delete(id));
        return newSelection;
      });
    } else {
      this.playbackCurves.update(curves => curves.filter(c => !rowIds.includes(c.id)));
      this.playbackSelection.update(selection => {
        const newSelection = new Set(selection);
        rowIds.forEach(id => newSelection.delete(id));
        return newSelection;
      });
    }
    this.showToast(`${rowIds.length} rows removed`, 'success');
  }

  clearAll() {
    if (this.activeTab() === 'training') {
      this.trainingRows.set([]);
      this.trainingSelection.set(new Set());
      this.trainingFilterChip.set(null);
    } else {
      this.playbackCurves.set([]);
      this.playbackSelection.set(new Set());
    }
    this.showToast('All data cleared', 'info');
  }

  updateRow(rowId: string, changes: Partial<ImportedRow>) {
    if (this.activeTab() === 'training') {
      this.trainingRows.update(rows =>
        rows.map(r => (r.sampleId === rowId ? { ...r, ...changes } : r))
      );
      this.showToast('Row updated', 'success');
    }
  }

  removeSource(fileName: string) {
    this.sources.update(sources => sources.filter(s => s.fileName !== fileName));
    this.trainingRows.update(rows =>
      rows.filter(r => r.originFile !== fileName)
    );
    this.trainingSelection.update(selection => {
      const newSelection = new Set(selection);
      return newSelection;
    });
    this.showToast(`Removed ${fileName}`, 'info');
  }

  importFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.csv,.tsv,.txt,.xlsx,.xls,.json';
    input.multiple = true;

    input.onchange = (e: any) => {
      const files = e.target.files;
      if (!files || files.length === 0) {
        this.isLoading.set(false);
        return;
      }
      this.isLoading.set(true);

      const reader = new FileReader();
      const file = files[0];
      reader.onload = (e: any) => {
        const data = e.target.result;
        const lines = data.split('\n').filter((l: string) => l.trim());
        if (lines.length < 2) {
          this.isLoading.set(false);
          return;
        }

        const rows: ImportedRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v: string) => v.trim());
          const row: ImportedRow = {
            sampleId: values[0] || '',
            lockingTime: values[1] || '',
            failureMode: values[2] || null,
            corrected: values[3] === 'true',
            confidence: values[4] ? Number(values[4]) : null,
            modelVersion: values[5] || '',
            originFile: file.name,
            _status: 'valid',
            _reason: undefined,
          };
          rows.push(row);
        }

        const existingRows = this.getTrainingRows();
        const mergedRows = [...existingRows, ...rows];
        this.trainingRows.set(mergedRows);

        this.sources.update(sources => [
          ...sources,
          { fileName: file.name, rowCount: rows.length },
        ]);

        this.isLoading.set(false);
        this.showToast(`Imported ${rows.length} rows from ${file.name}`, 'success');
      };
      reader.readAsText(file);
    };

    input.click();
  }

  showToast(message: string, type: 'success' | 'info' | 'error') {
    const typeMap: any = { success: 'success', info: 'info', error: 'error' };
    this.toastService.show(message, typeMap[type]);
  }
}