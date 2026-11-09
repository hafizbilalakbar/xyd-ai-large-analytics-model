import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-activate-version-dialog',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './activate-version-dialog.component.html',
  styleUrl: './activate-version-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivateVersionDialogComponent {
  readonly version = input.required<string>();
  readonly open = input.required<boolean>();
  readonly pending = input(false);

  readonly close = output<void>();
  readonly confirm = output<string>();

  readonly title = 'Confirm version activation';

  onConfirm(): void {
    if (this.pending()) {
      return;
    }
    this.confirm.emit(this.version());
  }

  onCancel(): void {
    if (this.pending()) {
      return;
    }
    this.close.emit();
  }
}
