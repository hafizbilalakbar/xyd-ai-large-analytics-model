import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-version-delete-dialog',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './version-delete-dialog.component.html',
  styleUrl: './version-delete-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersionDeleteDialogComponent {
  readonly version = input.required<string>();
  readonly open = input.required<boolean>();
  readonly pending = input(false);
  readonly taskDeleted = input(false);
  readonly taskId = input<string | null>(null);

  readonly close = output<void>();
  readonly confirm = output<void>();

  readonly title = 'Confirm version deletion';

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
