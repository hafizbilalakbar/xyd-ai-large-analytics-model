import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  input,
  output,
} from '@angular/core';
import { FileDropzoneComponent } from '../file-dropzone/file-dropzone.component';
import { TrainingPreviewTableComponent } from '../training-preview-table/training-preview-table.component';
import type {
  DuplicateMode,
  TrainingRow,
  TrainingRowStatus,
  TrainingSource,
} from '../../data-access/data-import.models';
import { IMPORT_FILE_EXTENSIONS } from '../../data-access/import-constants';

@Component({
  selector: 'app-training-import-panel',
  standalone: true,
  imports: [FileDropzoneComponent, TrainingPreviewTableComponent],
  templateUrl: './training-import-panel.component.html',
  styleUrl: './training-import-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingImportPanelComponent {
  readonly rows = input.required<TrainingRow[]>();
  readonly rowCount = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly currentPage = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly selectedIds = input.required<Set<string>>();
  readonly selectedCount = input.required<number>();
  readonly filter = input<'all' | TrainingRowStatus>('all');
  readonly duplicateMode = input<DuplicateMode>('skip');
  readonly counts = input.required<{ total: number; valid: number; warning: number; error: number }>();
  readonly sources = input<TrainingSource[]>([]);
  readonly hasErrors = input(false);
  readonly acceptedFileTypes = input<string>(IMPORT_FILE_EXTENSIONS.join(','));

  readonly fileDrop = output<File[]>();
  readonly filterChange = output<'all' | TrainingRowStatus>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly toggleRow = output<string>();
  readonly toggleSelectAll = output<boolean>();
  readonly duplicateModeChange = output<DuplicateMode>();
  readonly writeClick = output<void>();
  readonly downloadErrors = output<void>();
  readonly downloadTemplate = output<void>();
  readonly removeRow = output<string>();
  readonly editRow = output<string>();
  readonly removeSource = output<string>();
  readonly clearSelection = output<void>();
  readonly removeSelected = output<void>();
  readonly clearAll = output<void>();
  readonly cancelImport = output<void>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  onSelectFile(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (files.length > 0) {
      this.fileDrop.emit(files);
    }
  }

  onDuplicateModeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as DuplicateMode;
    this.duplicateModeChange.emit(value);
  }

  onTrainingRemoveRow(id: string): void {
    this.removeRow.emit(id);
  }

  onTrainingEditRow(id: string): void {
    this.editRow.emit(id);
  }

  onRemoveSource(fileName: string): void {
    this.removeSource.emit(fileName);
  }

  onClearAll(): void {
    this.clearAll.emit();
  }
}
