import { ChangeDetectionStrategy, Component, computed, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { zipSync, strToU8 } from 'fflate';
import { SampleService } from '../../../sample-search/data-access/sample.service';
import { SampleResult } from '../../../sample-search/data-access/sample-models';
import { MOCK_RESULTS } from '../../../sample-search/data-access/sample.mock';
import { MultiSelectDropdownComponent } from '../../../sample-search/components/multi-select-dropdown/multi-select-dropdown.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { OperationLogService } from '../../../../shared/services/operation-log.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ToastContainerComponent } from '../../../../shared/components/toast-container/toast-container.component';

const EXPORT_COLUMNS = ['Serial Number', 'Sample number', 'Locking time', 'Electric screwdriver model', 'Screw specifications', 'result', 'Failure Mode', 'Confidence', 'Model version'];

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function zipFileName(): string {
  const now = new Date();
  return `XYD_Export_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.zip`;
}

function csvEscape(value: unknown): string {
  const s = String(value == null ? '' : value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

@Component({
  selector: 'app-data-export',
  standalone: true,
  imports: [FormsModule, MultiSelectDropdownComponent, ConfirmDialogComponent, PageHeaderComponent, IconComponent, ToastContainerComponent],
  templateUrl: './data-export.component.html',
  styleUrl: './data-export.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataExportComponent {
  private readonly service = inject(SampleService);
  private readonly authService = inject(AuthService);
  private readonly logService = inject(OperationLogService);
  private readonly toast = inject(ToastService);

  readonly filters = this.service.filters;
  readonly results = this.service.results;
  readonly totalCount = this.service.totalCount;
  readonly currentPage = this.service.currentPage;
  readonly pageSize = this.service.pageSize;
  readonly from = this.service.from;
  readonly to = this.service.to;
  readonly totalPages = this.service.totalPages;
  readonly isLoading = this.service.isLoading;
  readonly errorMessage = this.service.errorMessage;
  readonly filterOptions = this.service.filterOptions;
  readonly allRecords = this.service.allFilteredResults;

  readonly exportFormat = signal<'both' | 'csv' | 'json'>('both');
  readonly archiveMode = signal(false);
  readonly showArchiveConfirm = signal(false);
  readonly showDeleteConfirm = signal(false);
  readonly deleteConfirmText = signal('');
  readonly exporting = signal(false);
  readonly progress = signal(0);
  readonly cancelFlag = signal(false);
  readonly exportStarted = signal(false);
  readonly showExportResult = signal(false);
  readonly exportResult = signal<{ count: number; format: string; fileName: string; size: number } | null>(null);
  readonly filtersChanged = signal(false);

  readonly pageSizes = [20, 50, 100];

  readonly dateError = computed(() => {
    const f = this.filters();
    if (f.startDate && f.endDate) {
      return new Date(f.startDate) > new Date(f.endDate);
    }
    return false;
  });

  readonly canQuery = computed(() => !this.isLoading() && !this.dateError());
  readonly exportDisabled = computed(() => this.isLoading() || this.exporting() || (this.filtersChanged() && this.totalCount() > 0));
  readonly estimatedCount = computed(() => this.totalCount());
  readonly operator = computed(() => this.authService.user()?.name ?? 'Administrator');

  readonly archiveMessage = `Currently in archive export mode: Clicking this button will prompt for a second confirmation. Successfully exported samples will be permanently deleted from your local machine. Turning off the "Archive Export" switch will revert the button to the normal "Export" mode, without deleting the original samples.`;

  readonly labelingOptions = computed(() => this.service.filterOptions().labelingCorrectionOptions);
  readonly pages = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  readonly archiveConfirmMessage = computed(() => {
    const count = this.totalCount();
    return `Will export ${count} sample(s) and pack them into a ZIP. After successful export, these ${count} sample(s) will be permanently deleted from your local machine and cannot be recovered. This operation cannot be undone and will be recorded in the operation log.`;
  });

  readonly exportResultMessage = computed(() => {
    const r = this.exportResult();
    if (!r) {
      return '';
    }
    return `Exported ${r.count} record(s) as ${r.format.toUpperCase()}. File: ${r.fileName} (${r.size} bytes).`;
  });

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.exporting()) {
      event.preventDefault();
    }
  }

  setFilter<K extends keyof ReturnType<typeof this.filters>>(key: K, value: ReturnType<typeof this.filters>[K]): void {
    this.filtersChanged.set(true);
    this.service.setFilter(key, value);
  }

  setExportFormat(value: string): void {
    this.exportFormat.set(value as 'both' | 'csv' | 'json');
  }

  setPageSize(value: string): void {
    this.service.setPageSize(Number(value));
  }

  onQuery(): void {
    if (this.dateError() || this.isLoading()) {
      return;
    }
    this.filtersChanged.set(false);
    this.service.query();
  }

  onReset(): void {
    this.filtersChanged.set(false);
    this.exportFormat.set('both');
    this.service.resetFilters();
  }

  onExport(): void {
    if (this.exportStarted()) {
      return;
    }
    if (this.archiveMode()) {
      this.showArchiveConfirm.set(true);
      return;
    }
    this.startExport(false);
  }

  onArchiveConfirm(confirm: boolean): void {
    this.showArchiveConfirm.set(false);
    if (confirm) {
      this.showDeleteConfirm.set(true);
      this.deleteConfirmText.set('');
    }
  }

  onDeleteInput(event: Event): void {
    this.deleteConfirmText.set((event.target as HTMLInputElement).value);
  }

  onDeleteConfirm(confirm: boolean): void {
    this.showDeleteConfirm.set(false);
    if (confirm) {
      this.startExport(true);
    }
  }

  onCancelExport(): void {
    this.cancelFlag.set(true);
  }

  onToggleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleArchive();
    }
  }

  toggleArchive(): void {
    this.archiveMode.update((m) => !m);
  }

  private startExport(deleted: boolean): void {
    if (this.exportStarted()) {
      return;
    }
    this.exportStarted.set(true);
    this.performExport(deleted).finally(() => {
      this.exportStarted.set(false);
    });
  }

  private async performExport(deleted: boolean): Promise<void> {
    const records = this.allRecords();
    if (records.length === 0) {
      this.toast.show('No data to export. Please run a query first.', 'warning');
      this.exportStarted.set(false);
      return;
    }
    this.exporting.set(true);
    this.progress.set(0);
    this.cancelFlag.set(false);
    try {
      const format = this.exportFormat();
      const csvLines: string[] = [EXPORT_COLUMNS.join(',')];
      const chunkSize = 50;
      let processed = 0;
      for (let i = 0; i < records.length; i += chunkSize) {
        if (this.cancelFlag()) {
          this.exporting.set(false);
          this.progress.set(0);
          this.exportStarted.set(false);
          this.toast.show('Export cancelled.', 'info');
          return;
        }
        const chunk = records.slice(i, i + chunkSize);
        for (const r of chunk) {
          csvLines.push(this.recordToCsv(r));
        }
        processed = Math.min(records.length, i + chunkSize);
        this.progress.set(Math.round((processed / records.length) * 90));
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (this.cancelFlag()) {
        this.exporting.set(false);
        this.progress.set(0);
        this.exportStarted.set(false);
        this.toast.show('Export cancelled.', 'info');
        return;
      }
      const files: Record<string, Uint8Array> = {};
      const csvContent = '\uFEFF' + csvLines.join('\n');
      if (format === 'both' || format === 'csv') {
        files['samples.csv'] = strToU8(csvContent);
      }
      if (format === 'both' || format === 'json') {
        files['samples.json'] = strToU8(JSON.stringify(records, null, 2));
      }
      const zip = zipSync(files);
      const blob = new Blob([zip], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = zipFileName();
      anchor.click();
      URL.revokeObjectURL(url);
      this.progress.set(100);
      const fileName = zipFileName();
      const size = blob.size;
      if (deleted) {
        this.deleteSamples(records, format, fileName, size);
      } else {
        this.finishExport(records.length, format, fileName, size, false);
      }
    } catch {
      this.exporting.set(false);
      this.progress.set(0);
      this.exportStarted.set(false);
      this.toast.show('Export failed.', 'error');
    }
  }

  private recordToCsv(r: SampleResult): string {
    return [
      r.serialNo,
      csvEscape(r.sampleId),
      r.lockingTime,
      csvEscape(r.electricScrewdriverModel),
      csvEscape(r.screwSpecification),
      r.result,
      csvEscape(r.failureMode ?? ''),
      r.confidence == null ? '' : String(r.confidence),
      csvEscape(r.modelVersion),
    ].join(',');
  }

  private deleteSamples(records: SampleResult[], format: 'both' | 'csv' | 'json', fileName: string, size: number): void {
    const ids = new Set(records.map((r) => r.sampleId));
    const remaining = MOCK_RESULTS.filter((r: SampleResult) => !ids.has(r.sampleId));
    MOCK_RESULTS.splice(0, MOCK_RESULTS.length, ...remaining);
    this.service.query();
    this.finishExport(records.length, format, fileName, size, true);
  }

  private finishExport(recordCount: number, format: 'both' | 'csv' | 'json', fileName: string, size: number, deleted: boolean): void {
    this.exporting.set(false);
    this.progress.set(0);
    this.exportStarted.set(false);
    const scope = this.scopeText();
    this.logService.add({ operator: this.operator(), format, scope, recordCount, deleted });
    this.exportResult.set({ count: recordCount, format, fileName, size });
    this.showExportResult.set(true);
  }

  private scopeText(): string {
    const f = this.filters();
    const parts: string[] = [];
    if (f.electricBatchNumber && f.electricBatchNumber !== 'all') parts.push(`batch=${f.electricBatchNumber}`);
    if (f.resultStatus && f.resultStatus !== 'all') parts.push(`status=${f.resultStatus}`);
    if (f.failureModes.length) parts.push(`failureModes=${f.failureModes.join(',')}`);
    if (f.labelingCorrection && f.labelingCorrection !== 'all') parts.push(`labeling=${f.labelingCorrection}`);
    if (f.startDate) parts.push(`start=${f.startDate}`);
    if (f.endDate) parts.push(`end=${f.endDate}`);
    return parts.length ? parts.join('; ') : 'all';
  }

  closeExportResult(): void {
    this.showExportResult.set(false);
    this.exportResult.set(null);
  }

  prevPage(): void {
    this.service.prevPage();
  }

  nextPage(): void {
    this.service.nextPage();
  }

  goPage(page: number): void {
    this.service.setPage(page);
  }
}
