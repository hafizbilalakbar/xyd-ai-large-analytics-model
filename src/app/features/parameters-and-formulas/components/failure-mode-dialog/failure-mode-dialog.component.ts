import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ParametersAndFormulasService } from '../../data-access/parameters-and-formulas.service';
import { FailureModeFormData } from '../../data-access/parameters-and-formulas.models';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-failure-mode-dialog',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: './failure-mode-dialog.component.html',
  styleUrl: './failure-mode-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FailureModeDialogComponent {
  readonly service = inject(ParametersAndFormulasService);

  readonly state = this.service.failureModeDialogState;
  readonly errors = this.service.failureModeFormErrors;
  readonly isSaving = this.service.isSavingFailureMode;

  readonly isEdit = computed(() => this.state().mode === 'edit');
  readonly isBuiltin = computed(() => {
    const mode = this.state().failureMode;
    return !!(mode && (mode.type === 'Built-in' || mode.is_builtin));
  });

  readonly failureModeType = computed(() => {
    const mode = this.state().failureMode;
    if (this.state().mode === 'edit' && mode) {
      return mode.type;
    }
    return 'Custom';
  });

  readonly title = computed(() => {
    const s = this.state();
    if (s.mode === 'edit' && s.failureMode) {
      return `Edit Failure Mode: ${s.failureMode.code}`;
    }
    return 'Add Failure Mode';
  });

  onFieldChange(field: keyof FailureModeFormData, value: unknown): void {
    this.service.updateFailureModeForm(field, value);
  }

  onSave(): void {
    void this.service.saveFailureMode();
  }

  onCancel(): void {
    this.service.closeFailureModeDialog();
  }
}
