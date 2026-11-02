import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../../../shared/components/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-data-import',
  imports: [FeaturePlaceholderComponent],
  templateUrl: './data-import.component.html',
  styleUrl: './data-import.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataImportComponent {}
