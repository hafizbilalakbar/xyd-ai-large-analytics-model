import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LowConfidenceReviewService, LOW_CONFIDENCE_THRESHOLD } from '../../data-access/low-confidence-review.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { ReviewSummaryCardsComponent } from '../../components/review-summary-cards/review-summary-cards.component';
import { ReviewFilterPanelComponent } from '../../components/review-filter-panel/review-filter-panel.component';
import { ReviewChecklistTableComponent } from '../../components/review-checklist-table/review-checklist-table.component';
import { ToastContainerComponent } from '../../../../shared/components/toast-container/toast-container.component';

@Component({
  selector: 'app-low-confidence-review-page',
  standalone: true,
  imports: [
    ReviewSummaryCardsComponent,
    ReviewFilterPanelComponent,
    ReviewChecklistTableComponent,
    ToastContainerComponent,
  ],
  templateUrl: './low-confidence-review-page.component.html',
  styleUrl: './low-confidence-review-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LowConfidenceReviewPageComponent {
  private readonly service = inject(LowConfidenceReviewService);
  private readonly toastService = inject(ToastService);

  readonly filterOptions = this.service.filterOptions;
  readonly rows = this.service.rows;
  readonly totalCount = this.service.totalCount;
  readonly currentPage = this.service.currentPage;
  readonly pageSize = this.service.pageSize;
  readonly isLoading = this.service.isLoading;
  readonly isExporting = this.service.isExporting;
  readonly errorMessage = this.service.errorMessage;
  readonly sort = this.service.sort;
  readonly selectedIds = this.service.selectedIds;
  readonly allSelectedOnPage = this.service.allSelectedOnPage;
  readonly someSelectedOnPage = this.service.someSelectedOnPage;
  readonly pendingCount = this.service.pendingCount;
  readonly reviewedCount = this.service.reviewedCount;
  readonly notReviewedCount = this.service.notReviewedCount;
  readonly completionRate = this.service.completionRate;
  readonly threshold = LOW_CONFIDENCE_THRESHOLD;

  onQuery() {
    this.service.query();
  }

  onReset() {
    this.service.resetFilters();
  }

  onSort(field: 'lockingTime' | 'confidence') {
    this.service.setSort(field);
  }

  onToggleSelect(id: string) {
    this.service.toggleSelect(id);
  }

  onToggleSelectAll() {
    this.service.toggleSelectAllOnPage();
  }

  onExport() {
    this.service.exportRows(this.toastService);
  }

  onReview(_sampleId: string) {
  }

  setPage(page: number) {
    this.service.setPage(page);
  }

  setPageSize(size: number) {
    this.service.setPageSize(size);
  }
}
