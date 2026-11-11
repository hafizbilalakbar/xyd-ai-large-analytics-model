import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ParametersAndFormulasService } from '../../data-access/parameters-and-formulas.service';
import { ExecutionConfigFormData } from '../../data-access/parameters-and-formulas.models';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-execution-config-dialog',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: './execution-config-dialog.component.html',
  styleUrl: './execution-config-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExecutionConfigDialogComponent {
  readonly service = inject(ParametersAndFormulasService);

  readonly state = this.service.executionConfigDialogState;
  readonly errors = this.service.executionFormErrors;
  readonly isSaving = this.service.isSavingConfig;

  readonly title = computed(() => {
    const s = this.state();
    if (s.mode === 'edit' && s.config) {
      return `Edit Configuration: Batch Number ${s.config.batchNumber}`;
    }
    if (s.mode === 'copy') {
      return 'Copy System Execution Parameter Configuration';
    }
    return 'Add System Execution Parameter Configuration';
  });

  readonly isBatchReadOnly = computed(() => {
    return this.state().mode === 'edit';
  });

  onFieldChange(field: keyof ExecutionConfigFormData, value: unknown): void {
    this.service.updateExecutionForm(field, value);
  }

  onNumericChange(field: keyof ExecutionConfigFormData, event: Event): void {
    const target = event.target as HTMLInputElement;
    const val = target.value === '' ? '' : Number(target.value);
    this.service.updateExecutionForm(field, val);
  }

  onSave(): void {
    void this.service.saveExecutionConfig();
  }

  onCancel(): void {
    this.service.requestCloseExecutionDialog();
  }
}
