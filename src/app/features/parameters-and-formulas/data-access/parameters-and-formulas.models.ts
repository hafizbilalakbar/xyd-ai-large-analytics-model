export interface ProcessBaseline {
  bit_spec: string;
  screw_spec: string;
  device_model: string;
  machine_model: string;
  material: string;
  has_thread_locker: boolean | null;
  thread_type: string;
}

export interface FormulaSpecs {
  target_torque: number;
  target_torque_LSL: number;
  target_torque_USL: number;
  clamp_torque_LSL: number;
  clamp_angle_max: number;
  clamp_angle_min: number;
}

export interface TorqueThresholds {
  angle_failure_max: number;
  angle_failure_min: number;
  seating_sigma_threshold: number;
  cross_thread_fft_thresh: number;
  integral_spec: number;
  seating_loc_sigma_thresh: number;
  bit_slip_sigma_thresh: number;
  seating_pct_threshold: number;
  bit_slip_pct_thresh: number;
  torque_start_thresh: number;
  cross_thread_extrema_thresh: number;
  cross_thread_extrema_lookback: number;
  nyquest_freq: number;
}

export interface ExecutionConfig {
  screwdriver_id: number;
  batchNumber: string;
  screwdriverModel: string;
  screwSpecification: string;
  process_baseline: ProcessBaseline;
  specs: FormulaSpecs;
  torque_thres: TorqueThresholds;
  summary: string;
  updated_at: string;
  updatedAt: string;
}

export interface ExecutionConfigFormData {
  batchNumber: string;
  screwdriverBitModel: string;
  screwSpec: string;
  electricScrewdriverModel: string;
  modelName: string;
  lockedItemMaterial: string;
  glueResistant: 'Not set' | 'Yes' | 'No';
  toothShape: 'Not set' | 'Machine thread' | 'Self-tapping thread';
  targetTorque: number;
  targetTorqueLowerLimit: number;
  targetTorqueUpperLimit: number;
  clampingTorqueLowerLimit: number;
  maximumClampingAngle: number;
  minimumClampingAngle: number;
  maximumAngleThreshold: number;
  minimumAngleThreshold: number;
  fitStandardDeviationThreshold: number;
  transThreadSpectrumThreshold: number;
  normalizedIntegralThreshold: number;
  fittingPositionStandardDeviationThreshold: number;
  slippageStandardDeviationThreshold: number;
  adhesionRatioThreshold: number;
  slippagePercentageThreshold: number;
  torqueStartThreshold: number;
  crossThreadExtremeThreshold: number;
  crossThreadExtremeValueBacktrackingWindow: number;
  nyquistNormalizedCutoffFrequency: number;
}

export interface FailureMode {
  code: string;
  name: string;
  description: string;
  type: 'Built-in' | 'Custom';
  status: 'Enabled' | 'Disabled';
  is_builtin: boolean;
  enabled: boolean;
}

export interface FailureModeFormData {
  code: string;
  name: string;
  description: string;
  type: 'Built-in' | 'Custom';
  status: 'Enabled' | 'Disabled';
}

export interface SystemSettings {
  storage_capacity_limit_gb: number;
  log_retention_days: number;
  results_confidence_threshold: number;
  multi_label_threshold: number;
  training_min_samples_per_class: number;
  training_strict_class_coverage: boolean;
  local_sample_cap: number;
  local_model_max_kept: number;
  dashboard_refresh_seconds: number;
}

export type TabId = 'execution' | 'failure-modes' | 'system';

export function buildThresholdSummary(specs: FormulaSpecs, torqueThres: TorqueThresholds): string {
  return `Target torque ${specs.target_torque}, clamping angle ≤${specs.clamp_angle_max}°, thread threshold ${torqueThres.cross_thread_fft_thresh}`;
}

export function formatConfigDate(dateStr?: string | Date): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}/${m}/${day} ${h}:${min}:${s}`;
}

export const DEFAULT_FORMULA_SPECS: FormulaSpecs = {
  target_torque: 0.25,
  target_torque_LSL: 0.23125,
  target_torque_USL: 0.26875,
  clamp_torque_LSL: 0,
  clamp_angle_max: 300,
  clamp_angle_min: 5,
};

export const DEFAULT_TORQUE_THRESHOLDS: TorqueThresholds = {
  angle_failure_max: 1080,
  angle_failure_min: 360,
  seating_sigma_threshold: 5,
  cross_thread_fft_thresh: 3000,
  integral_spec: 0.5,
  seating_loc_sigma_thresh: 4,
  bit_slip_sigma_thresh: 12,
  seating_pct_threshold: 0.005,
  bit_slip_pct_thresh: 0.002,
  torque_start_thresh: 0,
  cross_thread_extrema_thresh: 1,
  cross_thread_extrema_lookback: 800,
  nyquest_freq: 0.5,
};

export const DEFAULT_EXECUTION_FORM_DATA: ExecutionConfigFormData = {
  batchNumber: '',
  screwdriverBitModel: '',
  screwSpec: '',
  electricScrewdriverModel: '',
  modelName: '',
  lockedItemMaterial: '',
  glueResistant: 'Not set',
  toothShape: 'Not set',
  targetTorque: 0.25,
  targetTorqueLowerLimit: 0.23125,
  targetTorqueUpperLimit: 0.26875,
  clampingTorqueLowerLimit: 0,
  maximumClampingAngle: 300,
  minimumClampingAngle: 5,
  maximumAngleThreshold: 1080,
  minimumAngleThreshold: 360,
  fitStandardDeviationThreshold: 5,
  transThreadSpectrumThreshold: 3000,
  normalizedIntegralThreshold: 0.5,
  fittingPositionStandardDeviationThreshold: 4,
  slippageStandardDeviationThreshold: 12,
  adhesionRatioThreshold: 0.005,
  slippagePercentageThreshold: 0.002,
  torqueStartThreshold: 0,
  crossThreadExtremeThreshold: 1,
  crossThreadExtremeValueBacktrackingWindow: 800,
  nyquistNormalizedCutoffFrequency: 0.5,
};

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  storage_capacity_limit_gb: 50,
  log_retention_days: 30,
  results_confidence_threshold: 0.8,
  multi_label_threshold: 0.05,
  training_min_samples_per_class: 30,
  training_strict_class_coverage: false,
  local_sample_cap: 50000,
  local_model_max_kept: 2,
  dashboard_refresh_seconds: 60,
};
