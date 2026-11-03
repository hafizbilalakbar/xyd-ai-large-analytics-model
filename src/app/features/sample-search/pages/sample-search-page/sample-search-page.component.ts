import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SampleService } from '../../data-access/sample.service';
import { SampleFilterPanelComponent } from '../../components/sample-filter-panel/sample-filter-panel.component';
import { SampleResultsTableComponent } from '../../components/sample-results-table/sample-results-table.component';

@Component({
  selector: 'app-sample-search-page',
  standalone: true,
  imports: [SampleFilterPanelComponent, SampleResultsTableComponent],
  templateUrl: './sample-search-page.component.html',
  styleUrl: './sample-search-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SampleSearchPageComponent {
  private readonly service = inject(SampleService);

  readonly filterOptions = this.service.filterOptions;
  readonly results = this.service.results;
  readonly totalCount = this.service.totalCount;
  readonly currentPage = this.service.currentPage;
  readonly pageSize = this.service.pageSize;
  readonly isLoading = this.service.isLoading;
  readonly errorMessage = this.service.errorMessage;

  onQuery() {
    this.service.query();
  }

  onReset() {
    this.service.resetFilters();
  }

  setPage(page: number) {
    this.service.setPage(page);
  }

  setPageSize(size: number) {
    this.service.setPageSize(size);
  }
}
