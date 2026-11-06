import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FailureMode } from '../../../data-access/parameters-and-formulas.models';

@Component({
  selector: 'app-failure-mode-actions',
  standalone: true,
  templateUrl: './failure-mode-actions.component.html',
  styleUrl: './failure-mode-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FailureModeActionsComponent {
  readonly mode = input.required<FailureMode>();
  readonly modeLevel = input<'Built-in' | 'Custom'>('Built-in');

  readonly onEdit = output<FailureMode>();
  readonly onStatusToggle = output<{ code: string; status: 'Enabled' | 'Disabled' }>();
  readonly onDelete = output<string>();

  constructor() {}

  emitEdit(): void {
    this.onEdit.emit(this.mode());
  }

  emitStatusToggle(): void {
    const newStatus = this.mode().status === 'Enabled' ? 'Disabled' : 'Enabled';
    this.onStatusToggle.emit({ code: this.mode().code, status: newStatus });
  }

  emitDelete(): void {
    this.onDelete.emit(this.mode().code);
  }
}