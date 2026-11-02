import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../../../shared/components/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-version-management',
  imports: [FeaturePlaceholderComponent],
  templateUrl: './version-management.component.html',
  styleUrl: './version-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VersionManagementComponent {}
