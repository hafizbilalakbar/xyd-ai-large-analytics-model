import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SampleService } from '../../data-access/sample.service';
import { SampleFilterOptions } from '../../data-access/sample-models';
import { MultiSelectDropdownComponent } from '../multi-select-dropdown/multi-select-dropdown.component';

@Component({
  selector: 'app-sample-filter-panel',
  standalone: true,
  imports: [FormsModule, MultiSelectDropdownComponent],
  templateUrl: './sample-filter-panel.component.html',
  styleUrl: './sample-filter-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SampleFilterPanelComponent {
  private readonly service = inject(SampleService);

  readonly filterOptions = input.required<SampleFilterOptions>();

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
    if (f.confidenceMode !== 'range') return false;
    const min = f.confidenceMin;
    const max = f.confidenceMax;
    if (min < 0 || min > 100 || max < 0 || max > 100) return true;
    return min > max;
  });

  protected readonly canQuery = computed(() => !this.isLoading() && !this.dateError() && !this.rangeError());

  protected readonly showConfidenceRange = computed(() => this.filters().confidenceMode === 'range');

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
  }

  setConfidenceMin(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.setFilter('confidenceMin', isNaN(value) ? 0 : value);
  }

  setConfidenceMax(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.setFilter('confidenceMax', isNaN(value) ? 100 : value);
  }
}
