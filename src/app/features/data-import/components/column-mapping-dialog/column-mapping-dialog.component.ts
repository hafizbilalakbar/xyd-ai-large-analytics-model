import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import type { ColumnMapping } from '../../data-access/data-import.models';

@Component({
  selector: 'app-column-mapping-dialog',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './column-mapping-dialog.component.html',
  styleUrl: './column-mapping-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColumnMappingDialogComponent {
  readonly open = input.required<boolean>();
  readonly mappings = input.required<ColumnMapping[]>();
  readonly headers = input.required<readonly string[]>();

  readonly confirm = output<ColumnMapping[]>();
  readonly cancel = output<void>();
  readonly mappingChange = output<ColumnMapping[]>();

  onColumnChange(field: string, column: string): void {
    const next = this.mappings().map((m) =>
      m.field === field
        ? { ...m, sourceColumn: column || null, confidence: column ? m.confidence : 'Low' }
        : m,
    );
    this.mappingChange.emit(next);
  }

  onConfirm(): void {
    this.confirm.emit(this.mappings());
  }
}
