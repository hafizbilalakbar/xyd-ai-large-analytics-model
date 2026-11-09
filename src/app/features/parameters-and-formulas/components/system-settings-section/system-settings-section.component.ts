import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-system-settings-section',
  standalone: true,
  templateUrl: './system-settings-section.component.html',
  styleUrl: './system-settings-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemSettingsSectionComponent {
  readonly title = input.required<string>();
}
