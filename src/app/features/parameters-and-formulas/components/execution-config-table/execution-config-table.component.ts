import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ParametersAndFormulasService } from '../../data-access/parameters-and-formulas.service';
import { ExecutionConfig } from '../../data-access/parameters-and-formulas.models';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-execution-config-table',
  standalone: true,
  imports: [IconComponent, FormsModule],
  templateUrl: './execution-config-table.component.html',
  styleUrl: './execution-config-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExecutionConfigTableComponent {
  readonly service = inject(ParametersAndFormulasService);

  readonly configs = this.service.pagedExecutionConfigs;
  readonly totalCount = this.service.executionConfigTotal;
  readonly allConfigsCount = computed(() => this.service.executionConfigs().length);
  readonly isLoading = this.service.configsLoading;
  readonly errorMessage = this.service.configsError;

  readonly search = this.service.configSearch;
  readonly page = this.service.configPage;
  readonly pageSize = this.service.configPageSize;

  readonly totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize()) || 1);

  onSearchChange(value: string): void {
    this.service.configSearch.set(value);
    this.service.configPage.set(1);
  }

  onCopy(config: ExecutionConfig): void {
    this.service.openCopyConfigDialog(config);
  }

  onEdit(config: ExecutionConfig): void {
    this.service.openEditConfigDialog(config);
  }

  onDelete(config: ExecutionConfig): void {
    if (this.allConfigsCount() <= 1) return;
    this.service.requestDeleteConfig(config);
  }

  onRetry(): void {
    void this.service.loadExecutionConfigs();
  }
}
