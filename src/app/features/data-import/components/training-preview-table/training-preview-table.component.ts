import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
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
  readonly selectedCount = input.required<number>();
  readonly filter = input<'all' | TrainingRowStatus>('all');
  readonly counts = input.required<{
    total: number;
    valid: number;
    warning: number;
    error: number;
  }>();

  readonly filterChange = output<'all' | TrainingRowStatus>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly toggleRow = output<string>();
  readonly toggleSelectAll = output<boolean>();
  readonly removeRow = output<string>();
  readonly editRow = output<string>();
  readonly clearSelection = output<void>();
  readonly removeSelected = output<void>();

  protected readonly filterChips = computed(() => {
    const counts = this.counts();
    return [
      { key: 'all' as const, label: 'All', count: counts.total },
      { key: 'Valid' as const, label: 'Valid', count: counts.valid },
      { key: 'Warning' as const, label: 'Warning', count: counts.warning },
      { key: 'Error' as const, label: 'Error', count: counts.error },
    ];
  });

  protected readonly selectablePageIds = computed(() =>
    this.rows().filter((row) => row.status === 'Valid').map((row) => row.id),
  );

  protected readonly allSelected = computed(() => {
    const ids = this.selectablePageIds();
    return ids.length > 0 && ids.every((id) => this.selectedIds().has(id));
  });

  protected readonly someSelected = computed(() => {
    const ids = this.selectablePageIds();
    return ids.some((id) => this.selectedIds().has(id)) && !this.allSelected();
  });

  protected readonly headerCheckboxDisabled = computed(() => this.selectablePageIds().length === 0);

  onHeaderCheckboxChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleSelectAll.emit(checked);
  }

  formatLockingTime(value: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
}
