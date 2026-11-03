import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SampleResult } from '../../data-access/sample-models';
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

  readonly retry = output<void>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly isLowConfidence = (confidence: number | null) => (confidence ?? 100) < 80;
}
