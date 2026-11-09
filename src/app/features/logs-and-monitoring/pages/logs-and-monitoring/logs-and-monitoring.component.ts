import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../../../shared/components/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-logs-and-monitoring',
  imports: [FeaturePlaceholderComponent],
  templateUrl: './logs-and-monitoring.component.html',
  styleUrl: './logs-and-monitoring.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsAndMonitoringComponent {}
