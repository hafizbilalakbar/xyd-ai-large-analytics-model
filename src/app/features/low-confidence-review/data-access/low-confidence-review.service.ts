import { Injectable, signal, computed } from '@angular/core';
import { ReviewFilter, ReviewRow, ReviewFilterOptions, ReviewSort, ReviewModalState, REVIEW_FILTER_DEFAULTS, REVIEW_SORT_DEFAULT } from './low-confidence-review.models';
import { MOCK_REVIEW_FILTER_OPTIONS, MOCK_REVIEW_ROWS, USE_REVIEW_MOCK } from './low-confidence-review.mock';
import { LOW_CONFIDENCE_THRESHOLD } from '../../sample-search/data-access/sample.service';

export { LOW_CONFIDENCE_THRESHOLD };

@Injectable({ providedIn: 'root' })
export class LowConfidenceReviewService {
  readonly filters = signal<ReviewFilter>({ ...REVIEW_FILTER_DEFAULTS });
  readonly filterOptions = signal<ReviewFilterOptions>(MOCK_REVIEW_FILTER_OPTIONS);
  readonly sort = signal<ReviewSort>({ ...REVIEW_SORT_DEFAULT });
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly modalState = signal<ReviewModalState>({ type: null, record: null });
  readonly isSaving = signal(false);
  readonly isDeleting = signal(false);

  private readonly _sourceRows = signal<ReviewRow[]>(USE_REVIEW_MOCK ? [...MOCK_REVIEW_ROWS] : []);
  private readonly _allFilteredRows = signal<ReviewRow[]>([]);

  readonly rows = computed(() => {
    const all = this._allFilteredRows();
    const page = this.currentPage();
    const size = this.pageSize();
    const startIdx = (page - 1) * size;
    return all.slice(startIdx, startIdx + size);
  });

  readonly totalCount = computed(() => this._allFilteredRows().length);
  readonly currentPage = signal(1);
  readonly pageSize = signal(20);
  readonly isLoading = signal(false);
  readonly isExporting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly from = computed(() => {
    const total = this.totalCount();
    if (total === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  readonly to = computed(() => {
    const total = this.totalCount();
    if (total === 0) return 0;
    return Math.min(this.currentPage() * this.pageSize(), total);
  });

  readonly totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize()));

  readonly pendingCount = computed(() => this._allFilteredRows().filter(r => !r.corrected).length);
  readonly reviewedCount = computed(() => this._allFilteredRows().filter(r => r.corrected).length);

  readonly completionRate = computed(() => {
    const total = this.totalCount();
    if (total === 0) return 0;
    return Math.round((this.reviewedCount() / total) * 100);
  });

  readonly allSelectedOnPage = computed(() => {
    const pageRows = this.rows();
    if (pageRows.length === 0) return false;
    const selected = this.selectedIds();
    return pageRows.every(r => selected.has(r.sampleId));
  });

  readonly someSelectedOnPage = computed(() => {
    const pageRows = this.rows();
    const selected = this.selectedIds();
    return pageRows.some(r => selected.has(r.sampleId)) && !this.allSelectedOnPage();
  });

  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly notReviewedCount = computed(() => this.pendingCount());

  constructor() {
    if (USE_REVIEW_MOCK) {
      this.query();
    }
  }

  setFilter<K extends keyof ReviewFilter>(key: K, value: ReviewFilter[K]) {
    this.filters.update(f => ({ ...f, [key]: value }));
  }

  setSort(field: ReviewSort['field']) {
    this.sort.update(s => {
      if (s.field === field) {
        return { field, direction: s.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
    this.currentPage.set(1);
    this.clearSelection();
  }

  toggleSelect(id: string) {
    this.selectedIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleSelectAllOnPage() {
    const pageRows = this.rows();
    const allSelected = this.allSelectedOnPage();
    this.selectedIds.update(set => {
      const next = new Set(set);
      pageRows.forEach(r => {
        if (allSelected) next.delete(r.sampleId);
        else next.add(r.sampleId);
      });
      return next;
    });
  }

  clearSelection() {
    this.selectedIds.set(new Set());
  }

  openModal(type: ReviewModalState['type'], record: ReviewRow | null = null) {
    this.modalState.set({ type, record });
  }

  closeModal() {
    this.modalState.set({ type: null, record: null });
  }

  query() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.currentPage.set(1);
    this.clearSelection();

    setTimeout(() => {
      try {
        const data = [...this._sourceRows()];
        const filtered = this.applyFilters(data);
        const sorted = this.applySort(filtered);
        this._allFilteredRows.set(sorted);
      } catch {
        this.errorMessage.set('Failed to load data.');
      } finally {
        this.isLoading.set(false);
      }
    }, 500);
  }

  resetFilters() {
    this.filters.set({ ...REVIEW_FILTER_DEFAULTS });
    this.sort.set({ ...REVIEW_SORT_DEFAULT });
    this.currentPage.set(1);
    this.pageSize.set(20);
    this.isLoading.set(false);
    this.errorMessage.set(null);
    this.clearSelection();
    this.query();
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.clearSelection();
    }
  }

  nextPage() {
    const total = this.totalPages();
    if (this.currentPage() < total) {
      this.currentPage.update(p => p + 1);
      this.clearSelection();
    }
  }

  setPage(page: number) {
    const total = this.totalPages();
    if (page >= 1 && page <= total) {
      this.currentPage.set(page);
      this.clearSelection();
    }
  }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.clearSelection();
  }

  updateRecord(sampleId: string, changes: { failureMode?: string | null; corrected?: boolean }, toast: { show: (msg: string, type: 'info' | 'success' | 'error') => void }) {
    this.isSaving.set(true);

    setTimeout(() => {
      try {
        this._sourceRows.update(rows => {
          return rows.map(r => r.sampleId === sampleId ? { ...r, ...changes } : r);
        });

        this.recomputeFilteredRows();
        this.selectedIds.update(set => {
          const next = new Set(set);
          next.delete(sampleId);
          return next;
        });
        this.closeModal();
        toast.show('Sample updated.', 'success');
      } catch {
        toast.show('Update failed. Please try again.', 'error');
      } finally {
        this.isSaving.set(false);
      }
    }, 600);
  }

  deleteRecord(sampleId: string, toast: { show: (msg: string, type: 'info' | 'success' | 'error') => void }) {
    this.isDeleting.set(true);

    setTimeout(() => {
      try {
        this._sourceRows.update(rows => rows.filter(r => r.sampleId !== sampleId));
        this.recomputeFilteredRows();
        this.selectedIds.update(set => {
          const next = new Set(set);
          next.delete(sampleId);
          return next;
        });
        this.correctPageIfNeeded();
        this.closeModal();
        toast.show('Sample deleted.', 'success');
      } catch {
        toast.show('Delete failed. Please try again.', 'error');
      } finally {
        this.isDeleting.set(false);
      }
    }, 600);
  }

  deleteRecords(sampleIds: string[], toast: { show: (msg: string, type: 'info' | 'success' | 'error') => void }) {
    this.isDeleting.set(true);

    setTimeout(() => {
      try {
        const idSet = new Set(sampleIds);
        this._sourceRows.update(rows => rows.filter(r => !idSet.has(r.sampleId)));
        this.recomputeFilteredRows();
        this.clearSelection();
        this.correctPageIfNeeded();
        this.closeModal();
        toast.show(`${sampleIds.length} samples deleted.`, 'success');
      } catch {
        toast.show('Delete failed. Please try again.', 'error');
      } finally {
        this.isDeleting.set(false);
      }
    }, 600);
  }

  exportRows(toast: { show: (msg: string, type: 'info' | 'success' | 'error') => void }) {
    const all = this._allFilteredRows();
    const selected = this.selectedIds();
    const hasSelection = selected.size > 0;

    if (all.length === 0) {
      toast.show('There are currently no unverified samples under the current screening.', 'info');
      return;
    }

    this.isExporting.set(true);

    setTimeout(() => {
      try {
        const rowsToExport = hasSelection
          ? all.filter(r => selected.has(r.sampleId))
          : all;

        const headers = ['Serial No.', 'Sample ID', 'Locking Time', 'Major Failure Mode', 'Confidence', 'Corrected', 'Model Version'];
        const csvRows = rowsToExport.map(r => [
          r.serialNo,
          r.sampleId,
          r.lockingTime,
          r.failureMode ?? '',
          r.confidence ?? '',
          r.corrected ? 'Yes' : 'No',
          r.modelVersion,
        ]);

        const csvContent = [headers, ...csvRows]
          .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\r\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        link.href = url;
        link.download = `low-confidence-review_${timestamp}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.show(`Export complete. ${rowsToExport.length} items exported.`, 'success');
      } catch {
        toast.show('Export failed. Please try again.', 'error');
      } finally {
        this.isExporting.set(false);
      }
    }, 800);
  }

  private recomputeFilteredRows() {
    const data = [...this._sourceRows()];
    const filtered = this.applyFilters(data);
    const sorted = this.applySort(filtered);
    this._allFilteredRows.set(sorted);
  }

  private correctPageIfNeeded() {
    const totalPages = this.totalPages();
    if (this.currentPage() > totalPages && totalPages > 0) {
      this.currentPage.set(totalPages);
    } else if (totalPages === 0) {
      this.currentPage.set(1);
    }
  }

  private applyFilters(data: ReviewRow[]): ReviewRow[] {
    const f = this.filters();
    let filtered = [...data];

    if (f.correctedStatus && f.correctedStatus !== 'all') {
      const expected = f.correctedStatus === 'corrected';
      filtered = filtered.filter(r => r.corrected === expected);
    }

    if (f.failureModes.length > 0) {
      filtered = filtered.filter(r => r.failureMode !== null && f.failureModes.includes(r.failureMode));
    }

    filtered = filtered.filter(r => {
      const c = r.confidence ?? 0;
      return c >= f.confidenceMin && c <= f.confidenceMax;
    });

    if (f.startDate) {
      const start = new Date(f.startDate);
      filtered = filtered.filter(r => new Date(r.lockingTime) >= start);
    }

    if (f.endDate) {
      const end = new Date(f.endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => new Date(r.lockingTime) <= end);
    }

    return filtered;
  }

  private applySort(data: ReviewRow[]): ReviewRow[] {
    const s = this.sort();
    const dir = s.direction === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      if (s.field === 'confidence') {
        const av = a.confidence ?? 0;
        const bv = b.confidence ?? 0;
        return (av - bv) * dir;
      }
      return (new Date(a.lockingTime).getTime() - new Date(b.lockingTime).getTime()) * dir;
    });
  }
}
