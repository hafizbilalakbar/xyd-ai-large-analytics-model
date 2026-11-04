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
  readonly progressPercent = input(0);
  readonly currentStage = input('');
  readonly currentFileName = input('');
  readonly importElapsedMs = input(0);
  readonly importStatus = input('reading');

  readonly confirm = output<{ batchId: string; files: File[] }>();
  readonly cancel = output<void>();
  readonly cancelImport = output<void>();
  readonly downloadTemplate = output<void>();

  readonly selectedBatchId = signal<string>('');
  readonly selectedFiles = signal<File[]>([]);
  readonly validationError = signal<string>('');

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
  protected readonly canConfirm = computed(() => {
    if (!this.selectedBatchId()) return false;
    if (this.selectedFiles().length === 0) return false;
    return this.selectedFiles().every((f) => this.isValidFile(f));
  });

  onBatchChange(event: Event): void {
    this.selectedBatchId.set((event.target as HTMLSelectElement).value);
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
    this.confirm.emit({ batchId: this.selectedBatchId(), files: this.selectedFiles() });
  }

  onClose(): void {
    if (this.isImporting()) return;
    this.reset();
    this.cancel.emit();
  }

  private setFiles(files: File[]): void {
    const valid = files.filter((f) => this.isValidFile(f));
    const invalid = files.filter((f) => !this.isValidFile(f));
    if (invalid.length > 0) {
      this.validationError.set('Unsupported file type or file too large.');
    } else {
      this.validationError.set('');
    }
    this.selectedFiles.set(valid);
  }

  private isValidFile(file: File): boolean {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!IMPORT_FILE_EXTENSIONS.includes(ext)) return false;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) return false;
    if (file.size === 0) return false;
    return true;
  }

  private reset(): void {
    this.selectedBatchId.set('');
    this.selectedFiles.set([]);
    this.validationError.set('');
  }
}
