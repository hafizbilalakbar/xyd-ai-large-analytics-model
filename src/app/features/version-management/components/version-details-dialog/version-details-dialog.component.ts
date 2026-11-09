import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import type { VersionDetails } from '../../data-access/version-management.models';

@Component({
  selector: 'app-version-details-dialog',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './version-details-dialog.component.html',
  styleUrl: './version-details-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersionDetailsDialogComponent {
  readonly version = input<VersionDetails | null>(null);
  readonly open = input.required<boolean>();
  readonly close = output<void>();

  readonly title = computed(() => {
    const version = this.version();
    return version === null ? 'Version details' : `Version details: ${version.version}`;
  });

  readonly typeText = computed(() => {
    const version = this.version();
    if (version === null) {
      return '—';
    }
    return version.type === 'base' ? 'Basic Model' : 'Local Model';
  });

  readonly accuracyText = computed(() => {
    const version = this.version();
    return version === null || version.accuracy === null
      ? '—'
      : `${version.accuracy.toFixed(1)}%`;
  });

  readonly evalModeText = computed(() => {
    const version = this.version();
    if (version === null || version.evalMode === null) {
      return '—';
    }
    return version.evalMode === 'cv5'
      ? 'Grouped rotation validation (5 groups)'
      : 'Training data self-test (for reference only)';
  });

  readonly trainingScopeText = computed(() => this.version()?.trainingScope ?? '—');
}
