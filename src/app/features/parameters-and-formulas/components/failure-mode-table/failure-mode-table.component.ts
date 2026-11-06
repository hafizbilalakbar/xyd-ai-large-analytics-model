import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ParametersAndFormulasService } from '../../data-access/parameters-and-formulas.service';
import { FailureMode } from '../../data-access/parameters-and-formulas.models';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-failure-mode-table',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './failure-mode-table.component.html',
  styleUrl: './failure-mode-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FailureModeTableComponent {
  readonly service = inject(ParametersAndFormulasService);

  readonly modes = this.service.filteredFailureModes;
  readonly isLoading = this.service.failureModesLoading;
  readonly errorMessage = this.service.failureModesError;

  onEdit(mode: FailureMode): void {
    this.service.openEditFailureModeDialog(mode);
  }

  onToggleStatus(mode: FailureMode): void {
    this.service.toggleFailureModeStatus(mode);
  }

  onDelete(mode: FailureMode): void {
    this.service.requestDeleteFailureMode(mode);
  }

  onRetry(): void {
    void this.service.loadFailureModes();
  }
}
