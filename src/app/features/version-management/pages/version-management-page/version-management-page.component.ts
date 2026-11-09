import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { VersionManagementService } from '../../data-access/version-management.service';
import type { VersionDetails } from '../../data-access/version-management.models';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { VersionTimelineComponent } from '../../components/version-timeline/version-timeline.component';
import { AccuracyComparisonCardComponent } from '../../components/accuracy-comparison-card/accuracy-comparison-card.component';
import { VersionDetailsDialogComponent } from '../../components/version-details-dialog/version-details-dialog.component';
import { ActivateVersionDialogComponent } from '../../components/activate-version-dialog/activate-version-dialog.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ToastContainerComponent } from '../../../../shared/components/toast-container/toast-container.component';

@Component({
  selector: 'app-version-management-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    VersionTimelineComponent,
    AccuracyComparisonCardComponent,
    VersionDetailsDialogComponent,
    ActivateVersionDialogComponent,
    IconComponent,
    ToastContainerComponent,
  ],
  templateUrl: './version-management-page.component.html',
  styleUrl: './version-management-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersionManagementPageComponent implements OnInit {
  private readonly service = inject(VersionManagementService);

  readonly listState = this.service.listState;
  readonly loadError = this.service.loadError;
  readonly versions = this.service.versions;
  readonly activeVersion = this.service.activeVersion;
  readonly comparison = this.service.comparison;
  readonly classAccuracies = this.service.classAccuracies;
  readonly hasComparison = this.service.hasComparison;
  readonly isComparisonLoading = this.service.isComparisonLoading;
  readonly comparisonError = this.service.comparisonError;

  readonly details = signal<VersionDetails | null>(null);
  readonly detailsOpen = signal(false);
  readonly activateVersion = signal<string | null>(null);
  readonly activateOpen = signal(false);
  readonly activationPending = signal(false);

  readonly isLoading = computed(
    () => this.listState() === 'loading' && this.versions().length === 0,
  );
  readonly isError = computed(() => this.listState() === 'error');
  readonly showContent = computed(() => this.listState() === 'ok');

  readonly skeletonRows = [0, 1];

  ngOnInit(): void {
    void this.service.load();
  }

  retry(): void {
    void this.service.load();
  }

  retryComparison(): void {
    void this.service.retryComparison();
  }

  onActivateVersion(versionId: number): void {
    const version = this.versions().find((item) => item.versionId === versionId)?.version ?? '';
    this.activateVersion.set(version);
    this.activateOpen.set(true);
  }

  async onActivateConfirm(version: string): Promise<void> {
    this.activationPending.set(true);
    const versionId = this.versions().find((item) => item.version === version)?.versionId;
    if (versionId === undefined) {
      this.activationPending.set(false);
      return;
    }
    const activated = await this.service.activateVersion(versionId);
    this.activationPending.set(false);
    if (activated) {
      this.activateOpen.set(false);
      this.activateVersion.set(null);
    }
  }

  onActivateClose(): void {
    if (this.activationPending()) {
      return;
    }
    this.activateOpen.set(false);
    this.activateVersion.set(null);
  }

  async onDetailsVersion(versionId: number): Promise<void> {
    const details = await this.service.getVersionDetails(versionId);
    if (details === null) {
      return;
    }
    this.details.set(details);
    this.detailsOpen.set(true);
  }

  onDetailsClose(): void {
    this.detailsOpen.set(false);
    this.details.set(null);
  }
}
