import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ParametersAndFormulasService } from '../../data-access/parameters-and-formulas.service';
import { ExecutionConfigTableComponent } from '../execution-config-table/execution-config-table.component';

@Component({
  selector: 'app-execution-config-panel',
  standalone: true,
  imports: [ExecutionConfigTableComponent],
  templateUrl: './execution-config-panel.component.html',
  styleUrl: './execution-config-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExecutionConfigPanelComponent {
  readonly service = inject(ParametersAndFormulasService);

  onAddClick(): void {
    this.service.openAddConfigDialog();
  }
}
