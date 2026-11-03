import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ReviewRow, ReviewSort } from '../../data-access/low-confidence-review.models';
import { LOW_CONFIDENCE_THRESHOLD } from '../../data-access/low-confidence-review.service';
import { TablePaginationComponent } from '../../../sample-search/components/table-pagination/table-pagination.component';

@Component({
  selector: 'app-review-checklist-table',
  standalone: true,
  imports: [TablePaginationComponent],
  templateUrl: './review-checklist-table.component.html',
  styleUrl: './review-checklist-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewChecklistTableComponent {
  readonly rows = input.required<ReviewRow[]>();
  readonly totalCount = input.required<number>();
  readonly currentPage = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly loading = input.required<boolean>();
  readonly errorMessage = input.required<string | null>();
  readonly sort = input.required<ReviewSort>();
  readonly selectedIds = input.required<Set<string>>();
  readonly allSelectedOnPage = input.required<boolean>();
  readonly someSelectedOnPage = input.required<boolean>();
  readonly notReviewedCount = input.required<number>();
  readonly isExporting = input.required<boolean>();

  readonly retry = output<void>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly sortChange = output<ReviewSort['field']>();
  readonly toggleSelect = output<string>();
  readonly toggleSelectAll = output<void>();
  readonly export = output<void>();
  readonly review = output<string>();

  protected readonly lowThreshold = LOW_CONFIDENCE_THRESHOLD;
  protected readonly reviewDialogOpen = signal(false);
  protected readonly reviewDialogSampleId = signal<string>('');

  protected readonly isLowConfidence = (confidence: number | null) => (confidence ?? 100) < this.lowThreshold;

  onSort(field: ReviewSort['field']) {
    this.sortChange.emit(field);
  }

  onReview(sampleId: string) {
    this.reviewDialogSampleId.set(sampleId);
    this.reviewDialogOpen.set(true);
    this.review.emit(sampleId);
  }

  closeReviewDialog() {
    this.reviewDialogOpen.set(false);
    this.reviewDialogSampleId.set('');
  }
}
