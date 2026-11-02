import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../../../shared/components/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-training-tasks',
  imports: [FeaturePlaceholderComponent],
  templateUrl: './training-tasks.component.html',
  styleUrl: './training-tasks.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingTasksComponent {}
