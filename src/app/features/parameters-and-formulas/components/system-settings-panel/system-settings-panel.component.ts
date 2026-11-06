import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ParametersAndFormulasService } from '../../data-access/parameters-and-formulas.service';
import { SystemSettings } from '../../data-access/parameters-and-formulas.models';
import { SystemSettingsSectionComponent } from '../system-settings-section/system-settings-section.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-system-settings-panel',
  standalone: true,
  imports: [SystemSettingsSectionComponent, FormsModule],
  templateUrl: './system-settings-panel.component.html',
  styleUrl: './system-settings-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemSettingsPanelComponent {
  readonly service = inject(ParametersAndFormulasService);

  readonly form = this.service.settingsForm;
  readonly isDirty = this.service.settingsDirty;
  readonly validation = this.service.settingsValidation;
  readonly isSaving = this.service.isSavingSettings;
  readonly isLoading = this.service.settingsLoading;

  readonly errors = computed(() => this.validation().errors);
  readonly canSave = computed(() => this.isDirty() && this.validation().isValid && !this.isSaving());

  onNumberChange(field: keyof SystemSettings, event: Event): void {
    const target = event.target as HTMLInputElement;
    const val = target.value === '' ? ('' as unknown as number) : Number(target.value);
    this.service.updateSettingsFormField(field, val as any);
  }

  onBooleanChange(field: keyof SystemSettings, value: string): void {
    this.service.updateSettingsFormField(field, (value === 'true') as any);
  }

  onSave(): void {
    if (!this.canSave()) return;
    void this.service.saveSystemSettings();
  }

  onReset(): void {
    this.service.resetSettingsForm();
  }
}
