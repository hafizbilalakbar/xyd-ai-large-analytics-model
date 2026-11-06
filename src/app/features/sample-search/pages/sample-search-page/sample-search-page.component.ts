import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { SampleService } from '../../data-access/sample.service';
import { SampleFilterPanelComponent } from '../../components/sample-filter-panel/sample-filter-panel.component';
import { SampleResultsTableComponent } from '../../components/sample-results-table/sample-results-table.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-sample-search-page',
  standalone: true,
  imports: [SampleFilterPanelComponent, SampleResultsTableComponent, PageHeaderComponent],
  templateUrl: './sample-search-page.component.html',
  styleUrl: './sample-search-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SampleSearchPageComponent implements OnInit {
  private readonly service = inject(SampleService);
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  readonly filterOptions = this.service.filterOptions;
  readonly results = this.service.results;
  readonly totalCount = this.service.totalCount;
  readonly currentPage = this.service.currentPage;
  readonly pageSize = this.service.pageSize;
  readonly searchText = this.service.searchText;
  readonly isLoading = this.service.isLoading;
  readonly errorMessage = this.service.errorMessage;

  ngOnInit(): void {
    this.service.query();
  }

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

  setSearchText(value: string): void {
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
    }
    this.searchDebounce = setTimeout(() => {
      this.searchDebounce = null;
      this.service.setSearchText(value);
    }, 250);
  }

  clearSearchText(): void {
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = null;
    }
    this.service.setSearchText('');
  }
}
