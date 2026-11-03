import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LowConfidenceReviewService } from '../../data-access/low-confidence-review.service';
import { ReviewFilterOptions } from '../../data-access/low-confidence-review.models';
import { MultiSelectDropdownComponent } from '../../../sample-search/components/multi-select-dropdown/multi-select-dropdown.component';

@Component({
  selector: 'app-review-filter-panel',
  standalone: true,
  imports: [FormsModule, MultiSelectDropdownComponent],
  templateUrl: './review-filter-panel.component.html',
  styleUrl: './review-filter-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewFilterPanelComponent {
  private readonly service = inject(LowConfidenceReviewService);

  readonly filterOptions = input.required<ReviewFilterOptions>();

  readonly query = output<void>();
  readonly reset = output<void>();

  protected readonly filters = this.service.filters;
  protected readonly isLoading = this.service.isLoading;

  protected readonly dateError = computed(() => {
    const f = this.filters();
    if (f.startDate && f.endDate) {
      return new Date(f.startDate) > new Date(f.endDate);
    }
    return false;
  });

  protected readonly rangeError = computed(() => {
    const f = this.filters();
    const min = f.confidenceMin;
    const max = f.confidenceMax;
    if (min < 0 || min > 100 || max < 0 || max > 100) return true;
    return min > max;
  });

  protected readonly canQuery = computed(() => !this.isLoading() && !this.dateError() && !this.rangeError());

  onQuery() {
    if (this.dateError() || this.rangeError()) return;
    this.query.emit();
  }

  onReset() {
    this.reset.emit();
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.onQuery();
    }
  }

  setFilter<K extends keyof ReturnType<typeof this.filters>>(key: K, value: ReturnType<typeof this.filters>[K]) {
    this.service.setFilter(key, value);
    this.service.clearSelection();
  }

  setConfidenceMin(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.setFilter('confidenceMin', isNaN(value) ? 0 : value);
  }

  setConfidenceMax(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.setFilter('confidenceMax', isNaN(value) ? 80 : value);
  }
}
