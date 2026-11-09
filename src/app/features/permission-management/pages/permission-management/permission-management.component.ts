import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../../../shared/components/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-permission-management',
  imports: [FeaturePlaceholderComponent],
  templateUrl: './permission-management.component.html',
  styleUrl: './permission-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionManagementComponent {}
