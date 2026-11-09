import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-task-delete-dialog',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './task-delete-dialog.component.html',
  styleUrl: './task-delete-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDeleteDialogComponent {
  readonly taskId = input.required<string>();
  readonly open = input.required<boolean>();
  readonly pending = input(false);
  readonly versionDeleted = input(false);
  readonly version = input<string | null>(null);

  readonly close = output<void>();
  readonly confirm = output<void>();

  readonly title = 'Delete training task?';

  onConfirm(): void {
    if (this.pending()) {
      return;
    }
    this.confirm.emit();
  }

  onCancel(): void {
    if (this.pending()) {
      return;
    }
    this.close.emit();
  }
}
