import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FileDropzoneComponent } from '../file-dropzone/file-dropzone.component';
import { TrainingPreviewTableComponent } from '../training-preview-table/training-preview-table.component';
import type { DuplicateMode, TrainingRow, TrainingRowStatus } from '../../data-access/data-import.models';

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
  readonly totalCount = input.required<number>();
  readonly currentPage = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly selectedIds = input.required<Set<string>>();
  readonly selectedCount = input.required<number>();
  readonly filter = input<'all' | TrainingRowStatus>('all');
  readonly duplicateMode = input<DuplicateMode>('skip');
  readonly counts = input.required<{ total: number; valid: number; warning: number; error: number }>();
  readonly hasErrors = input(false);

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
}
