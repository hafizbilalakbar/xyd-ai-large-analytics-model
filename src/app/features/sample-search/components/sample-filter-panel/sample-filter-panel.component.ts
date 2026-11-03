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

  protected readonly canQuery = computed(() => !this.isLoading() && !this.dateError());

  onQuery() {
    if (this.dateError()) return;
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
}
