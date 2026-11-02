import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../../../shared/components/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-data-export',
  imports: [FeaturePlaceholderComponent],
  templateUrl: './data-export.component.html',
  styleUrl: './data-export.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataExportComponent {}
