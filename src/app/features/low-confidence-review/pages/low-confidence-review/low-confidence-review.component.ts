import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../../../shared/components/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-low-confidence-review',
  imports: [FeaturePlaceholderComponent],
  templateUrl: './low-confidence-review.component.html',
  styleUrl: './low-confidence-review.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LowConfidenceReviewComponent {}
