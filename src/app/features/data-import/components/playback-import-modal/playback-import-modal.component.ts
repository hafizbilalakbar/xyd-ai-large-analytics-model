import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ImportProgressComponent } from '../import-progress/import-progress.component';
import type { BatchOption } from '../../data-access/data-import.models';
import { MAX_FILE_SIZE_MB, IMPORT_FILE_EXTENSIONS } from '../../data-access/import-constants';

@Component({
  selector: 'app-playback-import-modal',
  standalone: true,
  imports: [ModalComponent, ImportProgressComponent],
  templateUrl: './playback-import-modal.component.html',
  styleUrl: './playback-import-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaybackImportModalComponent {
  readonly open = input.required<boolean>();
  readonly batches = input.required<BatchOption[]>();
  readonly isImporting = input(false);
  readonly progressPercent = input.required<number>();
  readonly currentStage = input.required<string>();
  readonly currentFileName = input.required<string>();
  readonly importElapsedMs = input.required<number>();
  readonly importStatus = input.required<string>();

  readonly confirm = output<{ batchId: string; files: File[] }>();
  readonly cancel = output<void>();
  readonly cancelImport = output<void>();
  readonly downloadTemplate = output<void>();

  readonly selectedBatchId = signal<string>('');
  readonly selectedFiles = signal<File[]>([]);
  readonly validationError = signal<string>('');
  readonly importInProgress = signal<boolean>(false);

  protected readonly acceptedTypes = IMPORT_FILE_EXTENSIONS.join(',');
  protected readonly maxSizeText = `${MAX_FILE_SIZE_MB}`;
  protected readonly hasBatches = computed(() => this.batches().length > 0);
  protected readonly fileName = computed(() =>
    this.selectedFiles().length === 0
      ? 'No file selected.'
      : this.selectedFiles().length === 1
        ? this.selectedFiles()[0].name
        : `${this.selectedFiles().length} files selected`,
  );
  protected readonly fileSize = computed(() => {
    if (this.selectedFiles().length === 0) return '';
    if (this.selectedFiles().length === 1) {
      const size = this.selectedFiles()[0].size;
      if (size < 1024) return `${size} bytes`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${this.selectedFiles().length} files selected`;
  });
  protected readonly canConfirm = computed(() => {
    if (!this.selectedBatchId()) return false;
    if (this.selectedFiles().length === 0) return false;
    if (this.validationError()) return false;
    return this.selectedFiles().every((f) => this.isValidFile(f));
  });

  onBatchChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedBatchId.set(value);
    this.validationError.set('');
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    this.setFiles(files);
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files) this.setFiles(Array.from(files));
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onConfirm(): void {
    if (!this.canConfirm()) return;
    this.validationError.set('');
    this.importInProgress.set(true);
    this.confirm.emit({ batchId: this.selectedBatchId(), files: this.selectedFiles() });
  }

  onClose(): void {
    if (this.isImporting()) return;
    if (this.importInProgress() && !confirm('Discard changes?')) return;
    this.reset();
    this.cancel.emit();
  }

  private setFiles(files: File[]): void {
    const valid = files.filter((f) => this.isValidFile(f));
    const invalid = files.filter((f) => !this.isValidFile(f));
    if (invalid.length > 0) {
      if (invalid.some((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024)) {
        this.validationError.set('File is too large. Maximum size is 100 MB.');
      } else if (invalid.some((f) => !IMPORT_FILE_EXTENSIONS.includes(f.name.slice(f.name.lastIndexOf('.')).toLowerCase()))) {
        this.validationError.set('Unsupported file type.');
      } else {
        this.validationError.set('Invalid file.');
      }
    } else {
      this.validationError.set('');
    }
    this.selectedFiles.set(valid);
  }

  private isValidFile(file: File): boolean {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (file.size === 0) return false;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) return false;
    if (!IMPORT_FILE_EXTENSIONS.includes(ext)) return false;
    return true;
  }

  private async validateCurveData(file: File): Promise<boolean> {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (ext === '.zip') {
      return false; // ZIP validation deferred to import parser
    }

    // Check first 50 lines for angle and torque columns
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter((line: string) => line.trim().length > 0);
        if (lines.length < 2) {
          resolve(false);
          return;
        }
        const headerLine = lines[0];
        const headers = headerLine.split(/[,\t;]/).map((h: string) => h.trim().toLowerCase().replace(/[\s_\-]/g, ''));
        const hasAngle = headers.some((h: string) => h.includes('angle') || h.includes('deg') || h.includes('degree') || h.includes('角度'));
        const hasTorque = headers.some((h: string) => h.includes('torque') || h.includes('nm') || h.includes('n.m') || h.includes('扭矩') || h.includes('扭力'));
        resolve(hasAngle && hasTorque);
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file.slice(0, 5000));
    });
  }

  async onFilesValidated(files: File[]): Promise<void> {
    if (files.length === 0) return;
    const firstFile = files[0];
    const hasData = await this.validateCurveData(firstFile);
    if (!hasData) {
      this.validationError.set('This file does not contain curve data (angle and torque columns). Use a curve file or a ZIP of curve files.');
    } else {
      this.validationError.set('');
    }
  }

  removeFile(): void {
    this.selectedFiles.set([]);
    this.validationError.set('');
  }

  private reset(): void {
    this.selectedBatchId.set('');
    this.selectedFiles.set([]);
    this.validationError.set('');
    this.importInProgress.set(false);
  }
}