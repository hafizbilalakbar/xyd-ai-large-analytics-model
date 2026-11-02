import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FeaturePlaceholderComponent } from '../../../../shared/components/feature-placeholder/feature-placeholder.component';

@Component({
  selector: 'app-parameters-and-formulas',
  imports: [FeaturePlaceholderComponent],
  templateUrl: './parameters-and-formulas.component.html',
  styleUrl: './parameters-and-formulas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParametersAndFormulasComponent {}
