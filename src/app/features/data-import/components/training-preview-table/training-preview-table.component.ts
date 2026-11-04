import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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

  readonly filterChange = output<'all' | TrainingRowStatus>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly toggleRow = output<string>();
  readonly toggleSelectAll = output<boolean>();
  readonly removeRow = output<string>();
  readonly editRow = output<string>();

  protected readonly filters: { key: 'all' | TrainingRowStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'Valid', label: 'Valid' },
    { key: 'Warning', label: 'Warning' },
    { key: 'Error', label: 'Error' },
  ];

  protected readonly allSelected = () => {
    const valid = this.rows().filter((r) => r.status !== 'Error');
    return valid.length > 0 && valid.every((r) => this.selectedIds().has(r.id));
  };

  protected readonly someSelected = () => {
    const valid = this.rows().filter((r) => r.status !== 'Error');
    const selectedCount = valid.filter((r) => this.selectedIds().has(r.id)).length;
    return selectedCount > 0 && selectedCount < valid.length;
  };

  onHeaderCheckboxChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleSelectAll.emit(checked);
  }
}
