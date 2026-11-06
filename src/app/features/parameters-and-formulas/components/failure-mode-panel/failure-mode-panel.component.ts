import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ParametersAndFormulasService } from '../../data-access/parameters-and-formulas.service';
import { FailureModeTableComponent } from '../failure-mode-table/failure-mode-table.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-failure-mode-panel',
  standalone: true,
  imports: [FailureModeTableComponent, IconComponent, FormsModule],
  templateUrl: './failure-mode-panel.component.html',
  styleUrl: './failure-mode-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FailureModePanelComponent {
  readonly service = inject(ParametersAndFormulasService);

  readonly search = this.service.failureModeSearch;
  readonly statusFilter = this.service.failureModeStatusFilter;
  readonly typeFilter = this.service.failureModeTypeFilter;

  readonly allCount = this.service.allModesCount;
  readonly enabledCount = this.service.enabledModesCount;
  readonly disabledCount = this.service.disabledModesCount;

  onSearchChange(value: string): void {
    this.service.failureModeSearch.set(value);
  }

  setStatusFilter(status: 'all' | 'enabled' | 'disabled'): void {
    this.service.failureModeStatusFilter.set(status);
  }

  onTypeFilterChange(type: 'all' | 'built-in' | 'custom'): void {
    this.service.failureModeTypeFilter.set(type);
  }

  onAddClick(): void {
    this.service.openAddFailureModeDialog();
  }
}
