import { ChangeDetectionStrategy, Component, input, output, computed } from '@angular/core';
import { TablePaginationComponent } from '../../../sample-search/components/table-pagination/table-pagination.component';
import type { TrainingRow, TrainingRowStatus } from '../../data-access/data-import.models';

@Component({
  selector: 'app-training-preview-table',
  standalone: true,
  imports: [TablePaginationComponent],
  templateUrl: './training-preview-table.component.html',
  styleUrl: './training-preview-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingPreviewTableComponent {
  readonly rows = input.required<TrainingRow[]>();
  readonly totalCount = input.required<number>();
  readonly currentPage = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly selectedIds = input.required<Set<string>>();
  readonly filter = input<'all' | TrainingRowStatus>('all');

  readonly trainingCounts = computed(() => {
    const rows = this.rows();
    return {
      total: rows.length,
      valid: rows.filter((r) => r.status === 'Valid').length,
      warning: rows.filter((r) => r.status === 'Warning').length,
      error: rows.filter((r) => r.status === 'Error').length,
    };
  });

  readonly trainingSelectedValidRows = computed(() =>
    this.rows().filter((row) => row.status !== 'Error' && this.selectedIds().has(row.id)),
  );

  readonly filterChange = output<'all' | TrainingRowStatus>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly toggleRow = output<string>();
  readonly toggleSelectAll = output<boolean>();
  readonly removeRow = output<string>();
  readonly editRow = output<string>();
  readonly clearSelection = output<void>();
  readonly removeSelected = output<void>();

  protected readonly filters: { key: 'all' | TrainingRowStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'Valid', label: 'Valid' },
    { key: 'Warning', label: 'Warning' },
    { key: 'Error', label: 'Error' },
  ];

  onHeaderCheckboxChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleSelectAll.emit(checked);
  }

  protected readonly allSelected = computed(() => this.rows().length > 0 && this.rows().every((row) => this.selectedIds().has(row.id)));

  protected readonly someSelected = computed(() => this.rows().some((row) => this.selectedIds().has(row.id)) && !this.allSelected());
}