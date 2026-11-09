import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../../../shared/components/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-sample-search',
  imports: [FeaturePlaceholderComponent],
  templateUrl: './sample-search.component.html',
  styleUrl: './sample-search.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SampleSearchComponent {}
