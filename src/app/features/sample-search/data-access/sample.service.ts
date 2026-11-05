import { Injectable, signal, computed, Signal } from '@angular/core';
import { SampleFilter, SampleResult, SampleFilterOptions, SAMPLE_FILTER_DEFAULTS } from './sample-models';
import { MOCK_FILTER_OPTIONS, MOCK_RESULTS, USE_SAMPLE_MOCK } from './sample.mock';

export const LOW_CONFIDENCE_THRESHOLD = 80;

@Injectable({ providedIn: 'root' })
export class SampleService {
  readonly filters = signal<SampleFilter>({ ...SAMPLE_FILTER_DEFAULTS });
  readonly filterOptions = signal<SampleFilterOptions>(MOCK_FILTER_OPTIONS);

  private readonly _allFilteredResults = signal<SampleResult[]>([]);
  readonly allFilteredResults: Signal<SampleResult[]> = this._allFilteredResults;

  readonly results = computed(() => {
    const all = this._allFilteredResults();
    const page = this.currentPage();
    const size = this.pageSize();
    const startIdx = (page - 1) * size;
    return all.slice(startIdx, startIdx + size);
  });

  readonly totalCount = computed(() => this._allFilteredResults().length);
  readonly currentPage = signal(1);
  readonly pageSize = signal(20);
  readonly isLoading = signal(false);
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

  setFilter<K extends keyof SampleFilter>(key: K, value: SampleFilter[K]) {
    this.filters.update(f => ({ ...f, [key]: value }));
  }

  query() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.currentPage.set(1);

    setTimeout(() => {
      try {
        const data = USE_SAMPLE_MOCK ? [...MOCK_RESULTS] : [];
        const filtered = this.applyFilters(data);
        this._allFilteredResults.set(filtered);
      } catch {
        this.errorMessage.set('Failed to load data.');
      } finally {
        this.isLoading.set(false);
      }
    }, 500);
  }

  resetFilters() {
    this.filters.set({ ...SAMPLE_FILTER_DEFAULTS });
    this._allFilteredResults.set([]);
    this.currentPage.set(1);
    this.pageSize.set(20);
    this.isLoading.set(false);
    this.errorMessage.set(null);
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage() {
    const total = this.totalPages();
    if (this.currentPage() < total) {
      this.currentPage.update(p => p + 1);
    }
  }

  setPage(page: number) {
    const total = this.totalPages();
    if (page >= 1 && page <= total) {
      this.currentPage.set(page);
    }
  }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  private applyFilters(data: SampleResult[]): SampleResult[] {
    const f = this.filters();
    let filtered = [...data];

    if (f.electricBatchNumber && f.electricBatchNumber !== 'all') {
      const batch = f.electricBatchNumber.toLowerCase();
      filtered = filtered.filter(r => r.batchNumber.toLowerCase() === batch);
    }

    if (f.modelName.length > 0) {
      filtered = filtered.filter(r => f.modelName.includes(r.electricScrewdriverModel));
    }

    if (f.electricScrewdriverModel.length > 0) {
      filtered = filtered.filter(r => f.electricScrewdriverModel.includes(r.electricScrewdriverModel));
    }

    if (f.bitType.length > 0) {
      filtered = filtered.filter(r => f.bitType.includes(r.screwSpecification));
    }

    if (f.screwSpec.length > 0) {
      filtered = filtered.filter(r => f.screwSpec.includes(r.screwSpecification));
    }

    if (f.lockedItemMaterial.length > 0) {
      filtered = filtered.filter(r => f.lockedItemMaterial.includes(r.electricScrewdriverModel));
    }

    if (f.gluePeelingResistant && f.gluePeelingResistant !== 'all') {
      const expected = f.gluePeelingResistant === 'true';
      filtered = filtered.filter(r => r.corrected === expected);
    }

    if (f.resultStatus && f.resultStatus !== 'all') {
      filtered = filtered.filter(r => r.result === f.resultStatus.toUpperCase());
    }

    if (f.failureModes.length > 0) {
      filtered = filtered.filter(r => r.failureMode !== null && f.failureModes.includes(r.failureMode));
    }

    if (f.labelingCorrection && f.labelingCorrection !== 'all') {
      filtered = filtered.filter(r => r.labelingCorrection === f.labelingCorrection);
    }

    if (f.confidenceMode === 'low') {
      filtered = filtered.filter(r => (r.confidence ?? 100) < LOW_CONFIDENCE_THRESHOLD);
    } else if (f.confidenceMode === 'range') {
      filtered = filtered.filter(r => {
        const c = r.confidence ?? 0;
        return c >= f.confidenceMin && c <= f.confidenceMax;
      });
    }

    if (f.startDate) {
      const start = new Date(f.startDate);
      filtered = filtered.filter(r => new Date(r.lockingTime) >= start);
    }

    if (f.endDate) {
      const end = new Date(f.endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => new Date(r.lockingTime) <= end);
    }

    filtered.sort((a, b) => new Date(b.lockingTime).getTime() - new Date(a.lockingTime).getTime());

    return filtered;
  }
}
