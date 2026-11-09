import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ParametersAndFormulasService } from '../../data-access/parameters-and-formulas.service';
import { TabId } from '../../data-access/parameters-and-formulas.models';
import { ConfigTabsComponent } from '../../components/config-tabs/config-tabs.component';
import { ExecutionConfigPanelComponent } from '../../components/execution-config-panel/execution-config-panel.component';
import { ExecutionConfigDialogComponent } from '../../components/execution-config-dialog/execution-config-dialog.component';
import { FailureModePanelComponent } from '../../components/failure-mode-panel/failure-mode-panel.component';
import { FailureModeDialogComponent } from '../../components/failure-mode-dialog/failure-mode-dialog.component';
import { SystemSettingsPanelComponent } from '../../components/system-settings-panel/system-settings-panel.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ToastContainerComponent } from '../../../../shared/components/toast-container/toast-container.component';

@Component({
  selector: 'app-parameters-and-formulas-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    ConfigTabsComponent,
    ExecutionConfigPanelComponent,
    ExecutionConfigDialogComponent,
    FailureModePanelComponent,
    FailureModeDialogComponent,
    SystemSettingsPanelComponent,
    ConfirmDialogComponent,
    ToastContainerComponent,
  ],
  templateUrl: './parameters-and-formulas-page.component.html',
  styleUrl: './parameters-and-formulas-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParametersAndFormulasPageComponent implements OnInit {
  readonly service = inject(ParametersAndFormulasService);
  private readonly route = inject(ActivatedRoute);

  readonly activeTab = this.service.activeTab;
  readonly deleteConfigConfirm = this.service.deleteConfigConfirm;
  readonly discardConfigConfirm = this.service.discardConfigConfirm;
  readonly failureModeConfirm = this.service.failureModeConfirm;
  readonly unsavedSettingsTabConfirm = this.service.unsavedSettingsTabConfirm;

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const tab = params['tab'];
      if (tab === 'execution' || tab === 'failure-modes' || tab === 'system') {
        this.service.setTab(tab as TabId);
      }
    });
  }

  onTabChange(tab: TabId): void {
    this.service.setTab(tab);
  }

  onConfirmDeleteConfig(): void {
    void this.service.confirmDeleteConfig();
  }

  onCancelDeleteConfig(): void {
    this.service.cancelDeleteConfig();
  }

  onConfirmDiscardConfig(): void {
    this.service.confirmDiscardExecutionDialog();
  }

  onCancelDiscardConfig(): void {
    this.service.cancelDiscardExecutionDialog();
  }

  onConfirmFailureMode(): void {
    void this.service.proceedFailureModeConfirm();
  }

  onCancelFailureMode(): void {
    this.service.cancelFailureModeConfirm();
  }

  onConfirmTabSwitch(): void {
    this.service.confirmTabSwitch();
  }

  onCancelTabSwitch(): void {
    this.service.cancelTabSwitch();
  }
}
