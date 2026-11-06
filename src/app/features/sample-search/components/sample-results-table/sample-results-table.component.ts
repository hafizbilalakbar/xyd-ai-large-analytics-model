import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SampleResult } from '../../data-access/sample-models';
import { LOW_CONFIDENCE_THRESHOLD } from '../../data-access/sample.service';
import { TablePaginationComponent } from '../table-pagination/table-pagination.component';

@Component({
  selector: 'app-sample-results-table',
  standalone: true,
  imports: [TablePaginationComponent],
  templateUrl: './sample-results-table.component.html',
  styleUrl: './sample-results-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SampleResultsTableComponent {
  readonly results = input.required<SampleResult[]>();
  readonly totalCount = input.required<number>();
  readonly currentPage = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly loading = input.required<boolean>();
  readonly errorMessage = input.required<string | null>();
  readonly searchText = input.required<string>();

  readonly retry = output<void>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly searchChange = output<string>();
  readonly searchClear = output<void>();

  protected isLowConfidence(confidence: number | null): boolean {
    return (confidence ?? 100) < LOW_CONFIDENCE_THRESHOLD;
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchChange.emit(value);
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.searchClear.emit();
    }
  }

  protected clearSearch(): void {
    this.searchClear.emit();
  }
}