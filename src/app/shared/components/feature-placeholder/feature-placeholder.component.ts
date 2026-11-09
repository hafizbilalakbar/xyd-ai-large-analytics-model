import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { PageHeaderComponent } from '../page-header/page-header.component';
import type { IconName } from '../icon/icon-paths';

@Component({
  selector: 'app-feature-placeholder',
  imports: [IconComponent, PageHeaderComponent],
  templateUrl: './feature-placeholder.component.html',
  styleUrl: './feature-placeholder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturePlaceholderComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly icon = input.required<IconName>();
}
