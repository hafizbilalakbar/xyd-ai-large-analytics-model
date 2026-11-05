import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ImportProgressComponent } from '../import-progress/import-progress.component';
import type { BatchOption } from '../../data-access/data-import.models';
import { MAX_FILE_SIZE_MB, IMPORT_FILE_EXTENSIONS } from '../../data-access/import-constants';

const CURVE_FILE_ERROR =
  'This file does not contain curve data (angle and torque columns). Use a curve file or a ZIP of curve files.';

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
    return `${this.selectedFiles().length} files`;
  });
  protected readonly canConfirm = computed(() => {
    if (!this.selectedBatchId()) return false;
    if (this.selectedFiles().length === 0) return false;
    if (this.validationError()) return false;
    return this.selectedFiles().every((file) => this.isValidFile(file));
  });

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.reset();
      }
    });
  }

  onBatchChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedBatchId.set(value);
    this.validationError.set('');
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    void this.setFiles(files);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files) {
      void this.setFiles(Array.from(files));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onSelectFile(): void {
    this.fileInput?.nativeElement.click();
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

  removeFile(): void {
    this.selectedFiles.set([]);
    this.validationError.set('');
    this.importInProgress.set(false);
  }

  private async setFiles(files: File[]): Promise<void> {
    const valid = files.filter((file) => this.isValidFile(file));
    const invalid = files.filter((file) => !this.isValidFile(file));
    if (invalid.length > 0) {
      if (invalid.some((file) => file.size > MAX_FILE_SIZE_MB * 1024 * 1024)) {
        this.validationError.set('File is too large. Maximum size is 100 MB.');
      } else if (
        invalid.some(
          (file) =>
            !IMPORT_FILE_EXTENSIONS.includes(
              file.name.slice(file.name.lastIndexOf('.')).toLowerCase(),
            ),
        )
      ) {
        this.validationError.set('Unsupported file type.');
      } else {
        this.validationError.set('Invalid file.');
      }
      this.selectedFiles.set([]);
      return;
    }
    if (valid.length === 0) {
      this.selectedFiles.set([]);
      return;
    }
    const hasCurveData = await Promise.all(valid.map((file) => this.validateCurveData(file)));
    if (hasCurveData.some((value) => !value)) {
      this.selectedFiles.set([]);
      this.validationError.set(CURVE_FILE_ERROR);
      return;
    }
    this.validationError.set('');
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
    if (ext === '.zip' || ext === '.xlsx' || ext === '.xls') return true;
    const text = await this.readText(file.slice(0, 8000));
    if (!text) return false;
    if (ext === '.json') {
      const lower = text.toLowerCase();
      return /angle|deg|degree|角度/.test(lower) && /torque|扭矩|扭力/.test(lower);
    }
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length < 2) return false;
    const header = (lines.find((line) => !line.startsWith('#')) ?? lines[0]).toLowerCase();
    return /angle|deg|degree|角度/.test(header) && /torque|扭矩|扭力|n·m|n\.m|nm/.test(header);
  }

  private readText(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsText(blob);
    });
  }

  private reset(): void {
    this.selectedBatchId.set('');
    this.selectedFiles.set([]);
    this.validationError.set('');
    this.importInProgress.set(false);
  }
}
