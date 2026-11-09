import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ExecutionConfig,
  ExecutionConfigFormData,
  FailureMode,
  FailureModeFormData,
  SystemSettings,
  TabId,
  DEFAULT_EXECUTION_FORM_DATA,
  DEFAULT_SYSTEM_SETTINGS,
  buildThresholdSummary,
  formatConfigDate,
} from './parameters-and-formulas.models';
import { ParametersAndFormulasApiService } from './parameters-and-formulas-api.service';
import {
  validateExecutionConfigForm,
  validateFailureModeForm,
  validateSystemSettings,
} from './config-validators';
import { ToastService } from '../../../shared/services/toast.service';

@Injectable({ providedIn: 'root' })
export class ParametersAndFormulasService {
  private readonly api = inject(ParametersAndFormulasApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly activeTab = signal<TabId>('execution');

  readonly executionConfigs = signal<ExecutionConfig[]>([]);
  readonly configsLoading = signal<boolean>(false);
  readonly configsError = signal<string | null>(null);
  readonly configSearch = signal<string>('');
  readonly configPage = signal<number>(1);
  readonly configPageSize = signal<number>(20);

  readonly executionConfigDialogState = signal<{
    open: boolean;
    mode: 'add' | 'edit' | 'copy';
    config: ExecutionConfig | null;
    form: ExecutionConfigFormData;
    initialSnapshot: string;
  }>({
    open: false,
    mode: 'add',
    config: null,
    form: { ...DEFAULT_EXECUTION_FORM_DATA },
    initialSnapshot: JSON.stringify(DEFAULT_EXECUTION_FORM_DATA),
  });

  readonly executionFormErrors = signal<Record<string, string>>({});
  readonly isSavingConfig = signal<boolean>(false);
  readonly deleteConfigConfirm = signal<{
    open: boolean;
    config: ExecutionConfig | null;
  }>({ open: false, config: null });
  readonly discardConfigConfirm = signal<boolean>(false);

  readonly failureModes = signal<FailureMode[]>([]);
  readonly failureModesLoading = signal<boolean>(false);
  readonly failureModesError = signal<string | null>(null);
  readonly failureModeSearch = signal<string>('');
  readonly failureModeStatusFilter = signal<'all' | 'enabled' | 'disabled'>('all');
  readonly failureModeTypeFilter = signal<'all' | 'built-in' | 'custom'>('all');

  readonly failureModeDialogState = signal<{
    open: boolean;
    mode: 'add' | 'edit';
    failureMode: FailureMode | null;
    form: FailureModeFormData;
  }>({
    open: false,
    mode: 'add',
    failureMode: null,
    form: { code: '', name: '', description: '', type: 'Custom', status: 'Enabled' },
  });

  readonly failureModeFormErrors = signal<Record<string, string>>({});
  readonly isSavingFailureMode = signal<boolean>(false);
  readonly failureModeConfirm = signal<{
    open: boolean;
    type: 'disable' | 'delete';
    failureMode: FailureMode | null;
  }>({ open: false, type: 'disable', failureMode: null });

  readonly systemSettings = signal<SystemSettings>({ ...DEFAULT_SYSTEM_SETTINGS });
  readonly settingsForm = signal<SystemSettings>({ ...DEFAULT_SYSTEM_SETTINGS });
  readonly settingsLoading = signal<boolean>(false);
  readonly settingsError = signal<string | null>(null);
  readonly isSavingSettings = signal<boolean>(false);
  readonly unsavedSettingsTabConfirm = signal<{
    open: boolean;
    targetTab: TabId | null;
  }>({ open: false, targetTab: null });

  readonly filteredExecutionConfigs = computed(() => {
    const list = this.executionConfigs();
    const q = this.configSearch().trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.batchNumber.toLowerCase().includes(q) ||
        c.screwdriverModel.toLowerCase().includes(q) ||
        c.screwSpecification.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q),
    );
  });

  readonly pagedExecutionConfigs = computed(() => {
    const all = this.filteredExecutionConfigs();
    const page = this.configPage();
    const size = this.configPageSize();
    const start = (page - 1) * size;
    return all.slice(start, start + size);
  });

  readonly executionConfigTotal = computed(() => this.filteredExecutionConfigs().length);

  readonly allModesCount = computed(() => this.failureModes().length);
  readonly enabledModesCount = computed(
    () => this.failureModes().filter((m) => m.status === 'Enabled' || m.enabled).length,
  );
  readonly disabledModesCount = computed(
    () => this.failureModes().filter((m) => m.status === 'Disabled' || !m.enabled).length,
  );

  readonly filteredFailureModes = computed(() => {
    let list = this.failureModes();
    const status = this.failureModeStatusFilter();
    const type = this.failureModeTypeFilter();
    const q = this.failureModeSearch().trim().toLowerCase();

    if (status === 'enabled') {
      list = list.filter((m) => m.status === 'Enabled' || m.enabled);
    } else if (status === 'disabled') {
      list = list.filter((m) => m.status === 'Disabled' || !m.enabled);
    }

    if (type === 'built-in') {
      list = list.filter((m) => m.type === 'Built-in' || m.is_builtin);
    } else if (type === 'custom') {
      list = list.filter((m) => m.type === 'Custom' || !m.is_builtin);
    }

    if (q) {
      list = list.filter(
        (m) =>
          m.code.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q),
      );
    }

    return list;
  });

  readonly activeFailureModes = computed(() => {
    return this.failureModes().filter((m) => m.status === 'Enabled' || m.enabled);
  });

  readonly activeFailureModeOptions = computed(() => {
    return this.activeFailureModes().map((m) => ({
      key: m.code,
      label: `${m.code} ${m.name}`,
    }));
  });

  readonly settingsDirty = computed(() => {
    const current = this.settingsForm();
    const saved = this.systemSettings();
    return (
      Number(current.storage_capacity_limit_gb) !== Number(saved.storage_capacity_limit_gb) ||
      Number(current.log_retention_days) !== Number(saved.log_retention_days) ||
      Number(current.results_confidence_threshold) !== Number(saved.results_confidence_threshold) ||
      Number(current.multi_label_threshold) !== Number(saved.multi_label_threshold) ||
      Number(current.training_min_samples_per_class) !== Number(saved.training_min_samples_per_class) ||
      Boolean(current.training_strict_class_coverage) !== Boolean(saved.training_strict_class_coverage) ||
      Number(current.local_sample_cap) !== Number(saved.local_sample_cap) ||
      Number(current.dashboard_refresh_seconds) !== Number(saved.dashboard_refresh_seconds)
    );
  });

  readonly settingsValidation = computed(() => {
    return validateSystemSettings(this.settingsForm());
  });

  readonly lowConfidenceThreshold = computed(() => {
    return this.systemSettings().results_confidence_threshold;
  });

  readonly dashboardRefreshInterval = computed(() => {
    return this.systemSettings().dashboard_refresh_seconds;
  });

  constructor() {
    void this.loadExecutionConfigs();
    void this.loadFailureModes();
    void this.loadSystemSettings();
  }

  setTab(tab: TabId): void {
    if (this.activeTab() === tab) return;

    if (this.activeTab() === 'system' && this.settingsDirty()) {
      this.unsavedSettingsTabConfirm.set({ open: true, targetTab: tab });
      return;
    }

    this.activeTab.set(tab);
    void this.router.navigate([], { queryParams: { tab } });
  }

  confirmTabSwitch(): void {
    const target = this.unsavedSettingsTabConfirm().targetTab;
    this.unsavedSettingsTabConfirm.set({ open: false, targetTab: null });
    this.resetSettingsForm();
    if (target) {
      this.activeTab.set(target);
      void this.router.navigate([], { queryParams: { tab: target } });
    }
  }

  cancelTabSwitch(): void {
    this.unsavedSettingsTabConfirm.set({ open: false, targetTab: null });
  }

  async loadExecutionConfigs(): Promise<void> {
    this.configsLoading.set(true);
    this.configsError.set(null);
    try {
      const items = await this.api.getExecutionConfigs();
      this.executionConfigs.set(items);
    } catch {
      this.configsError.set('Failed to load system execution parameter history.');
    } finally {
      this.configsLoading.set(false);
    }
  }

  openAddConfigDialog(): void {
    this.executionFormErrors.set({});
    const initialForm: ExecutionConfigFormData = {
      ...DEFAULT_EXECUTION_FORM_DATA,
    };
    this.executionConfigDialogState.set({
      open: true,
      mode: 'add',
      config: null,
      form: initialForm,
      initialSnapshot: JSON.stringify(initialForm),
    });
  }

  openEditConfigDialog(config: ExecutionConfig): void {
    this.executionFormErrors.set({});
    const form: ExecutionConfigFormData = {
      batchNumber: config.batchNumber,
      screwdriverBitModel: config.process_baseline.bit_spec,
      screwSpec: config.process_baseline.screw_spec,
      electricScrewdriverModel: config.process_baseline.device_model,
      modelName: config.process_baseline.machine_model,
      lockedItemMaterial: config.process_baseline.material,
      glueResistant:
        config.process_baseline.has_thread_locker === true
          ? 'Yes'
          : config.process_baseline.has_thread_locker === false
            ? 'No'
            : 'Not set',
      toothShape:
        config.process_baseline.thread_type === 'machine'
          ? 'Machine thread'
          : config.process_baseline.thread_type === 'self_tapping'
            ? 'Self-tapping thread'
            : 'Not set',
      targetTorque: config.specs.target_torque,
      targetTorqueLowerLimit: config.specs.target_torque_LSL,
      targetTorqueUpperLimit: config.specs.target_torque_USL,
      clampingTorqueLowerLimit: config.specs.clamp_torque_LSL,
      maximumClampingAngle: config.specs.clamp_angle_max,
      minimumClampingAngle: config.specs.clamp_angle_min,
      maximumAngleThreshold: config.torque_thres.angle_failure_max,
      minimumAngleThreshold: config.torque_thres.angle_failure_min,
      fitStandardDeviationThreshold: config.torque_thres.seating_sigma_threshold,
      transThreadSpectrumThreshold: config.torque_thres.cross_thread_fft_thresh,
      normalizedIntegralThreshold: config.torque_thres.integral_spec,
      fittingPositionStandardDeviationThreshold: config.torque_thres.seating_loc_sigma_thresh,
      slippageStandardDeviationThreshold: config.torque_thres.bit_slip_sigma_thresh,
      adhesionRatioThreshold: config.torque_thres.seating_pct_threshold,
      slippagePercentageThreshold: config.torque_thres.bit_slip_pct_thresh,
      torqueStartThreshold: config.torque_thres.torque_start_thresh,
      crossThreadExtremeThreshold: config.torque_thres.cross_thread_extrema_thresh,
      crossThreadExtremeValueBacktrackingWindow: config.torque_thres.cross_thread_extrema_lookback,
      nyquistNormalizedCutoffFrequency: config.torque_thres.nyquest_freq,
    };
    this.executionConfigDialogState.set({
      open: true,
      mode: 'edit',
      config,
      form,
      initialSnapshot: JSON.stringify(form),
    });
  }

  openCopyConfigDialog(source: ExecutionConfig): void {
    this.executionFormErrors.set({});
    const form: ExecutionConfigFormData = {
      batchNumber: '',
      screwdriverBitModel: source.process_baseline.bit_spec,
      screwSpec: source.process_baseline.screw_spec,
      electricScrewdriverModel: source.process_baseline.device_model,
      modelName: source.process_baseline.machine_model,
      lockedItemMaterial: source.process_baseline.material,
      glueResistant:
        source.process_baseline.has_thread_locker === true
          ? 'Yes'
          : source.process_baseline.has_thread_locker === false
            ? 'No'
            : 'Not set',
      toothShape:
        source.process_baseline.thread_type === 'machine'
          ? 'Machine thread'
          : source.process_baseline.thread_type === 'self_tapping'
            ? 'Self-tapping thread'
            : 'Not set',
      targetTorque: source.specs.target_torque,
      targetTorqueLowerLimit: source.specs.target_torque_LSL,
      targetTorqueUpperLimit: source.specs.target_torque_USL,
      clampingTorqueLowerLimit: source.specs.clamp_torque_LSL,
      maximumClampingAngle: source.specs.clamp_angle_max,
      minimumClampingAngle: source.specs.clamp_angle_min,
      maximumAngleThreshold: source.torque_thres.angle_failure_max,
      minimumAngleThreshold: source.torque_thres.angle_failure_min,
      fitStandardDeviationThreshold: source.torque_thres.seating_sigma_threshold,
      transThreadSpectrumThreshold: source.torque_thres.cross_thread_fft_thresh,
      normalizedIntegralThreshold: source.torque_thres.integral_spec,
      fittingPositionStandardDeviationThreshold: source.torque_thres.seating_loc_sigma_thresh,
      slippageStandardDeviationThreshold: source.torque_thres.bit_slip_sigma_thresh,
      adhesionRatioThreshold: source.torque_thres.seating_pct_threshold,
      slippagePercentageThreshold: source.torque_thres.bit_slip_pct_thresh,
      torqueStartThreshold: source.torque_thres.torque_start_thresh,
      crossThreadExtremeThreshold: source.torque_thres.cross_thread_extrema_thresh,
      crossThreadExtremeValueBacktrackingWindow: source.torque_thres.cross_thread_extrema_lookback,
      nyquistNormalizedCutoffFrequency: source.torque_thres.nyquest_freq,
    };
    this.executionConfigDialogState.set({
      open: true,
      mode: 'copy',
      config: null,
      form,
      initialSnapshot: JSON.stringify(form),
    });
  }

  updateExecutionForm(field: keyof ExecutionConfigFormData, value: unknown): void {
    this.executionConfigDialogState.update((state) => ({
      ...state,
      form: { ...state.form, [field]: value },
    }));
  }

  requestCloseExecutionDialog(): void {
    const state = this.executionConfigDialogState();
    const isDirty = JSON.stringify(state.form) !== state.initialSnapshot;
    if (isDirty) {
      this.discardConfigConfirm.set(true);
    } else {
      this.closeExecutionDialog();
    }
  }

  confirmDiscardExecutionDialog(): void {
    this.discardConfigConfirm.set(false);
    this.closeExecutionDialog();
  }

  cancelDiscardExecutionDialog(): void {
    this.discardConfigConfirm.set(false);
  }

  closeExecutionDialog(): void {
    this.executionConfigDialogState.update((s) => ({ ...s, open: false }));
    this.executionFormErrors.set({});
  }

  async saveExecutionConfig(): Promise<void> {
    const state = this.executionConfigDialogState();
    const existing = this.executionConfigs().map((c) => c.batchNumber);
    const currentBatch = state.mode === 'edit' && state.config ? state.config.batchNumber : null;
    const validation = validateExecutionConfigForm(state.form, existing, currentBatch);

    if (!validation.isValid) {
      this.executionFormErrors.set(validation.errors);
      const firstField = Object.keys(validation.errors)[0];
      const el = document.getElementById(`field-${firstField}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
      return;
    }

    this.executionFormErrors.set({});
    this.isSavingConfig.set(true);

    try {
      const f = state.form;
      const batchNum = Number(f.batchNumber);
      const now = new Date();
      const updatedConfig: ExecutionConfig = {
        screwdriver_id: batchNum,
        batchNumber: String(batchNum),
        screwdriverModel: f.electricScrewdriverModel.trim(),
        screwSpecification: f.screwSpec.trim(),
        process_baseline: {
          bit_spec: f.screwdriverBitModel.trim(),
          screw_spec: f.screwSpec.trim(),
          device_model: f.electricScrewdriverModel.trim(),
          machine_model: f.modelName.trim(),
          material: f.lockedItemMaterial.trim(),
          has_thread_locker:
            f.glueResistant === 'Yes' ? true : f.glueResistant === 'No' ? false : null,
          thread_type:
            f.toothShape === 'Machine thread'
              ? 'machine'
              : f.toothShape === 'Self-tapping thread'
                ? 'self_tapping'
                : '',
        },
        specs: {
          target_torque: Number(f.targetTorque),
          target_torque_LSL: Number(f.targetTorqueLowerLimit),
          target_torque_USL: Number(f.targetTorqueUpperLimit),
          clamp_torque_LSL: Number(f.clampingTorqueLowerLimit),
          clamp_angle_max: Number(f.maximumClampingAngle),
          clamp_angle_min: Number(f.minimumClampingAngle),
        },
        torque_thres: {
          angle_failure_max: Number(f.maximumAngleThreshold),
          angle_failure_min: Number(f.minimumAngleThreshold),
          seating_sigma_threshold: Number(f.fitStandardDeviationThreshold),
          cross_thread_fft_thresh: Number(f.transThreadSpectrumThreshold),
          integral_spec: Number(f.normalizedIntegralThreshold),
          seating_loc_sigma_thresh: Number(f.fittingPositionStandardDeviationThreshold),
          bit_slip_sigma_thresh: Number(f.slippageStandardDeviationThreshold),
          seating_pct_threshold: Number(f.adhesionRatioThreshold),
          bit_slip_pct_thresh: Number(f.slippagePercentageThreshold),
          torque_start_thresh: Number(f.torqueStartThreshold),
          cross_thread_extrema_thresh: Number(f.crossThreadExtremeThreshold),
          cross_thread_extrema_lookback: Number(f.crossThreadExtremeValueBacktrackingWindow),
          nyquest_freq: Number(f.nyquistNormalizedCutoffFrequency),
        },
        summary: buildThresholdSummary(
          {
            target_torque: Number(f.targetTorque),
            target_torque_LSL: Number(f.targetTorqueLowerLimit),
            target_torque_USL: Number(f.targetTorqueUpperLimit),
            clamp_torque_LSL: Number(f.clampingTorqueLowerLimit),
            clamp_angle_max: Number(f.maximumClampingAngle),
            clamp_angle_min: Number(f.minimumClampingAngle),
          },
          {
            angle_failure_max: Number(f.maximumAngleThreshold),
            angle_failure_min: Number(f.minimumAngleThreshold),
            seating_sigma_threshold: Number(f.fitStandardDeviationThreshold),
            cross_thread_fft_thresh: Number(f.transThreadSpectrumThreshold),
            integral_spec: Number(f.normalizedIntegralThreshold),
            seating_loc_sigma_thresh: Number(f.fittingPositionStandardDeviationThreshold),
            bit_slip_sigma_thresh: Number(f.slippageStandardDeviationThreshold),
            seating_pct_threshold: Number(f.adhesionRatioThreshold),
            bit_slip_pct_thresh: Number(f.slippagePercentageThreshold),
            torque_start_thresh: Number(f.torqueStartThreshold),
            cross_thread_extrema_thresh: Number(f.crossThreadExtremeThreshold),
            cross_thread_extrema_lookback: Number(f.crossThreadExtremeValueBacktrackingWindow),
            nyquest_freq: Number(f.nyquistNormalizedCutoffFrequency),
          },
        ),
        updated_at: now.toISOString(),
        updatedAt: formatConfigDate(now),
      };

      if (state.mode === 'edit') {
        await this.api.updateExecutionConfig(updatedConfig);
      } else {
        await this.api.createExecutionConfig(updatedConfig);
      }

      await this.loadExecutionConfigs();
      this.closeExecutionDialog();
      this.toast.show('Configuration saved and applied.', 'success');
    } catch {
      this.toast.show('Failed to save configuration. Please try again.', 'error');
    } finally {
      this.isSavingConfig.set(false);
    }
  }

  requestDeleteConfig(config: ExecutionConfig): void {
    if (this.executionConfigs().length <= 1) {
      return;
    }
    this.deleteConfigConfirm.set({ open: true, config });
  }

  cancelDeleteConfig(): void {
    this.deleteConfigConfirm.set({ open: false, config: null });
  }

  async confirmDeleteConfig(): Promise<void> {
    const config = this.deleteConfigConfirm().config;
    if (!config) return;
    this.deleteConfigConfirm.set({ open: false, config: null });
    try {
      await this.api.deleteExecutionConfig(config.batchNumber);
      await this.loadExecutionConfigs();
      this.toast.show('Configuration deleted.', 'success');
    } catch {
      this.toast.show('Failed to delete configuration.', 'error');
    }
  }

  async loadFailureModes(): Promise<void> {
    this.failureModesLoading.set(true);
    this.failureModesError.set(null);
    try {
      const items = await this.api.getFailureModes();
      this.failureModes.set(items);
    } catch {
      this.failureModesError.set('Failed to load failure mode types.');
    } finally {
      this.failureModesLoading.set(false);
    }
  }

  openAddFailureModeDialog(): void {
    this.failureModeFormErrors.set({});
    const nextNum = this.failureModes().length + 1;
    const suggestedCode = `F${String(nextNum).padStart(2, '0')}`;
    this.failureModeDialogState.set({
      open: true,
      mode: 'add',
      failureMode: null,
      form: {
        code: suggestedCode,
        name: '',
        description: '',
        type: 'Custom',
        status: 'Enabled',
      },
    });
  }

  openEditFailureModeDialog(mode: FailureMode): void {
    this.failureModeFormErrors.set({});
    this.failureModeDialogState.set({
      open: true,
      mode: 'edit',
      failureMode: mode,
      form: {
        code: mode.code,
        name: mode.name,
        description: mode.description,
        type: mode.type,
        status: mode.status,
      },
    });
  }

  updateFailureModeForm(field: keyof FailureModeFormData, value: unknown): void {
    this.failureModeDialogState.update((state) => ({
      ...state,
      form: { ...state.form, [field]: value },
    }));
  }

  closeFailureModeDialog(): void {
    this.failureModeDialogState.update((s) => ({ ...s, open: false }));
    this.failureModeFormErrors.set({});
  }

  async saveFailureMode(): Promise<void> {
    const state = this.failureModeDialogState();
    const existing = this.failureModes().map((m) => m.code);
    const isEdit = state.mode === 'edit';
    const validation = validateFailureModeForm(state.form, existing, isEdit);

    if (!validation.isValid) {
      this.failureModeFormErrors.set(validation.errors);
      return;
    }

    this.failureModeFormErrors.set({});
    this.isSavingFailureMode.set(true);

    try {
      const f = state.form;
      const modeData: FailureMode = {
        code: f.code.trim().toUpperCase(),
        name: f.name.trim(),
        description: f.description.trim(),
        type: isEdit && state.failureMode ? state.failureMode.type : 'Custom',
        status: f.status,
        is_builtin: isEdit && state.failureMode ? state.failureMode.is_builtin : false,
        enabled: f.status === 'Enabled',
      };

      if (isEdit) {
        await this.api.updateFailureMode(modeData);
      } else {
        await this.api.createFailureMode(modeData);
      }

      await this.loadFailureModes();
      this.closeFailureModeDialog();
      this.toast.show('Failure mode saved.', 'success');
    } catch {
      this.toast.show('Failed to save failure mode.', 'error');
    } finally {
      this.isSavingFailureMode.set(false);
    }
  }

  toggleFailureModeStatus(mode: FailureMode): void {
    const targetStatus = mode.status === 'Enabled' || mode.enabled ? 'Disabled' : 'Enabled';
    if (targetStatus === 'Disabled') {
      this.failureModeConfirm.set({
        open: true,
        type: 'disable',
        failureMode: mode,
      });
    } else {
      void this.applyFailureModeStatus(mode.code, 'Enabled');
    }
  }

  requestDeleteFailureMode(mode: FailureMode): void {
    if (mode.type === 'Built-in' || mode.is_builtin) return;
    this.failureModeConfirm.set({
      open: true,
      type: 'delete',
      failureMode: mode,
    });
  }

  cancelFailureModeConfirm(): void {
    this.failureModeConfirm.set({ open: false, type: 'disable', failureMode: null });
  }

  async proceedFailureModeConfirm(): Promise<void> {
    const { type, failureMode } = this.failureModeConfirm();
    if (!failureMode) return;
    this.failureModeConfirm.set({ open: false, type: 'disable', failureMode: null });

    if (type === 'disable') {
      await this.applyFailureModeStatus(failureMode.code, 'Disabled');
    } else if (type === 'delete') {
      try {
        await this.api.deleteFailureMode(failureMode.code);
        await this.loadFailureModes();
        this.toast.show('Failure mode deleted.', 'success');
      } catch {
        this.toast.show('Failed to delete failure mode.', 'error');
      }
    }
  }

  private async applyFailureModeStatus(code: string, status: 'Enabled' | 'Disabled'): Promise<void> {
    try {
      await this.api.setFailureModeStatus(code, status);
      await this.loadFailureModes();
      this.toast.show(
        status === 'Enabled' ? 'Failure mode enabled.' : 'Failure mode disabled.',
        'success',
      );
    } catch {
      this.toast.show('Failed to update failure mode status.', 'error');
    }
  }

  async loadSystemSettings(): Promise<void> {
    this.settingsLoading.set(true);
    this.settingsError.set(null);
    try {
      const settings = await this.api.getSystemSettings();
      this.systemSettings.set(settings);
      this.settingsForm.set({ ...settings });
    } catch {
      this.settingsError.set('Failed to load system settings.');
    } finally {
      this.settingsLoading.set(false);
    }
  }

  updateSettingsFormField<K extends keyof SystemSettings>(field: K, value: SystemSettings[K]): void {
    this.settingsForm.update((f) => ({ ...f, [field]: value }));
  }

  resetSettingsForm(): void {
    this.settingsForm.set({ ...this.systemSettings() });
  }

  async saveSystemSettings(): Promise<void> {
    const validation = this.settingsValidation();
    if (!validation.isValid) {
      this.toast.show('Please fix the validation errors before saving.', 'error');
      return;
    }

    this.isSavingSettings.set(true);
    try {
      const saved = await this.api.saveSystemSettings(this.settingsForm());
      this.systemSettings.set(saved);
      this.settingsForm.set({ ...saved });
      this.toast.show('Settings saved.', 'success');
    } catch {
      this.toast.show('Failed to save settings.', 'error');
    } finally {
      this.isSavingSettings.set(false);
    }
  }
}
