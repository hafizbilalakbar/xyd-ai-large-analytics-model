import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReviewRow, ReviewSort, ReviewModalState, ReviewEditForm } from '../../data-access/low-confidence-review.models';
import { LOW_CONFIDENCE_THRESHOLD } from '../../data-access/low-confidence-review.service';
import { TablePaginationComponent } from '../../../sample-search/components/table-pagination/table-pagination.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-review-checklist-table',
  standalone: true,
  imports: [FormsModule, TablePaginationComponent, ModalComponent, ConfirmDialogComponent],
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
  readonly selectedCount = input.required<number>();
  readonly notReviewedCount = input.required<number>();
  readonly isExporting = input.required<boolean>();
  readonly modalState = input.required<ReviewModalState>();
  readonly isSaving = input.required<boolean>();
  readonly isDeleting = input.required<boolean>();
  readonly failureModeOptions = input.required<{ key: string; label: string }[]>();

  readonly retry = output<void>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly sortChange = output<ReviewSort['field']>();
  readonly toggleSelect = output<string>();
  readonly toggleSelectAll = output<void>();
  readonly clearSelection = output<void>();
  readonly export = output<void>();
  readonly view = output<string>();
  readonly edit = output<string>();
  readonly delete = output<string>();
  readonly bulkDelete = output<void>();
  readonly update = output<{ sampleId: string; changes: { failureMode: string | null; corrected: boolean } }>();
  readonly closeModal = output<void>();
  readonly discardChanges = output<void>();

  protected readonly lowThreshold = LOW_CONFIDENCE_THRESHOLD;

  protected readonly editForm = signal<ReviewEditForm>({
    sampleId: '',
    failureMode: null,
    corrected: false,
    modelVersion: '',
  });

  protected readonly originalEditForm = signal<ReviewEditForm | null>(null);
  protected readonly editTouched = signal(false);

  protected readonly isEditDirty = computed(() => {
    const original = this.originalEditForm();
    if (!original) return false;
    const current = this.editForm();
    return current.failureMode !== original.failureMode || current.corrected !== original.corrected;
  });

  protected readonly editValid = computed(() => {
    const form = this.editForm();
    return form.failureMode !== null && form.failureMode !== '';
  });

  protected readonly deleteTargetIds = computed(() => {
    const state = this.modalState();
    if (state.type === 'delete' && state.record) {
      return [state.record.sampleId];
    }
    if (state.type === 'bulkDelete') {
      return Array.from(this.selectedIds());
    }
    return [];
  });

  protected readonly bulkDeleteMessage = computed(() => {
    const ids = this.deleteTargetIds();
    const visible = ids.slice(0, 5).join(', ');
    const remaining = ids.length - 5;
    let text = `The selected samples will be deleted. This cannot be undone.`;
    if (ids.length > 0) {
      text = `Sample IDs: ${visible}${remaining > 0 ? ` and ${remaining} more` : ''}. ${text}`;
    }
    return text;
  });

  constructor() {
    effect(() => {
      const state = this.modalState();
      if (state.type === 'edit' && state.record) {
        const form = {
          sampleId: state.record.sampleId,
          failureMode: state.record.failureMode,
          corrected: state.record.corrected,
          modelVersion: state.record.modelVersion,
        };
        this.editForm.set(form);
        this.originalEditForm.set({ ...form });
        this.editTouched.set(false);
      }
    });
  }

  protected readonly isLowConfidence = (confidence: number | null) => (confidence ?? 100) < this.lowThreshold;

  onSort(field: ReviewSort['field']) {
    this.sortChange.emit(field);
  }

  onView(sampleId: string) {
    this.view.emit(sampleId);
  }

  onEdit(sampleId: string) {
    this.edit.emit(sampleId);
  }

  onDelete(sampleId: string) {
    this.delete.emit(sampleId);
  }

  onBulkDelete() {
    this.bulkDelete.emit();
  }

  onCloseModal() {
    if (this.modalState().type === 'edit' && this.isEditDirty()) {
      this.discardChanges.emit();
    } else {
      this.closeModal.emit();
    }
  }

  onConfirmDiscard() {
    this.closeModal.emit();
  }

  onKeepEditing() {
    const record = this.modalState().record;
    if (record) {
      this.edit.emit(record.sampleId);
    }
  }

  onSaveEdit() {
    this.editTouched.set(true);
    if (!this.editValid()) return;
    const form = this.editForm();
    this.update.emit({
      sampleId: form.sampleId,
      changes: {
        failureMode: form.failureMode,
        corrected: form.corrected,
      },
    });
  }

  onConfirmDelete() {
    const state = this.modalState();
    if (state.type === 'delete' && state.record) {
      this.delete.emit(state.record.sampleId);
    } else if (state.type === 'bulkDelete') {
      this.bulkDelete.emit();
    }
  }

  setFailureMode(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.editForm.update(f => ({ ...f, failureMode: value || null }));
  }

  setCorrected(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.editForm.update(f => ({ ...f, corrected: value === 'true' }));
  }

  trackBySerialNo(_: number, row: ReviewRow) {
    return row.serialNo;
  }
}
