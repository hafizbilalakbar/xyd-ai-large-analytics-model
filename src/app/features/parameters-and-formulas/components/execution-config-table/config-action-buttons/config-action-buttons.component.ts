import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-config-action-buttons',
  standalone: true,
  templateUrl: './config-action-buttons.component.html',
  styleUrl: './config-action-buttons.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigActionButtonsComponent {
  readonly batchNumber = input.required<string>();
  readonly mode = input<'view' | 'edit'>('view');
  readonly isOnly = input<boolean>(false);

  readonly onEdit = output<string>();
  readonly onDelete = output<string>();
  readonly onCopy = output<string>();

  emitEdit(): void {
    this.onEdit.emit(this.batchNumber());
  }

  emitDelete(): void {
    this.onDelete.emit(this.batchNumber());
  }

  emitCopy(): void {
    this.onCopy.emit(this.batchNumber());
  }
}