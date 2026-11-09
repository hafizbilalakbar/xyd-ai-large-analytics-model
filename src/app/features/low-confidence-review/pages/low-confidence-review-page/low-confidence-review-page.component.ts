import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LowConfidenceReviewService } from '../../data-access/low-confidence-review.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { ReviewSummaryCardsComponent } from '../../components/review-summary-cards/review-summary-cards.component';
import { ReviewFilterPanelComponent } from '../../components/review-filter-panel/review-filter-panel.component';
import { ReviewChecklistTableComponent } from '../../components/review-checklist-table/review-checklist-table.component';
import { ToastContainerComponent } from '../../../../shared/components/toast-container/toast-container.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-low-confidence-review-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
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
  readonly isSaving = this.service.isSaving;
  readonly isDeleting = this.service.isDeleting;
  readonly errorMessage = this.service.errorMessage;
  readonly sort = this.service.sort;
  readonly selectedIds = this.service.selectedIds;
  readonly allSelectedOnPage = this.service.allSelectedOnPage;
  readonly someSelectedOnPage = this.service.someSelectedOnPage;
  readonly selectedCount = this.service.selectedCount;
  readonly pendingCount = this.service.pendingCount;
  readonly reviewedCount = this.service.reviewedCount;
  readonly notReviewedCount = this.service.notReviewedCount;
  readonly completionRate = this.service.completionRate;
  readonly modalState = this.service.modalState;
  readonly threshold = this.service.threshold;

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

  onClearSelection() {
    this.service.clearSelection();
  }

  onExport() {
    this.service.exportRows(this.toastService);
  }

  onView(sampleId: string) {
    const record = this.rows().find(r => r.sampleId === sampleId) ?? null;
    this.service.openModal('view', record);
  }

  onEdit(sampleId: string) {
    const record = this.rows().find(r => r.sampleId === sampleId) ?? null;
    this.service.openModal('edit', record);
  }

  onDelete(sampleId: string) {
    if (this.modalState().type === 'delete' && this.modalState().record?.sampleId === sampleId) {
      this.service.deleteRecord(sampleId, this.toastService);
    } else {
      const record = this.rows().find(r => r.sampleId === sampleId) ?? null;
      this.service.openModal('delete', record);
    }
  }

  onBulkDelete(ids: string[]) {
    if (this.modalState().type === 'bulkDelete') {
      this.service.deleteRecords(ids, this.toastService);
    } else {
      this.service.openModal('bulkDelete', null);
    }
  }

  onUpdate(event: { sampleId: string; changes: { failureMode: string | null; corrected: boolean } }) {
    this.service.updateRecord(event.sampleId, event.changes, this.toastService);
  }

  onCloseModal() {
    this.service.closeModal();
  }

  onDiscardChanges() {
    this.service.openModal('discard', this.modalState().record);
  }

  onConfirmDelete() {
    const state = this.modalState();
    if (state.type === 'delete' && state.record) {
      this.service.deleteRecord(state.record.sampleId, this.toastService);
    } else if (state.type === 'bulkDelete') {
      const ids = Array.from(this.selectedIds());
      this.service.deleteRecords(ids, this.toastService);
    }
  }

  setPage(page: number) {
    this.service.setPage(page);
  }

  setPageSize(size: number) {
    this.service.setPageSize(size);
  }
}
