import { ExecutionConfigFormData, FailureModeFormData, SystemSettings } from './parameters-and-formulas.models';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateExecutionConfigForm(
  form: ExecutionConfigFormData,
  existingBatchNumbers: string[] = [],
  currentBatchNumber: string | null = null,
): ValidationResult {
  const errors: Record<string, string> = {};

  const batch = String(form.batchNumber ?? '').trim();
  if (!batch) {
    errors['batchNumber'] = 'Batch number is required.';
  } else if (!/^\d+$/.test(batch)) {
    errors['batchNumber'] = 'Batch number must be a valid positive integer.';
  } else if (batch !== currentBatchNumber && existingBatchNumbers.includes(batch)) {
    errors['batchNumber'] = `Batch number ${batch} already exists.`;
  }

  if (!String(form.screwdriverBitModel ?? '').trim()) {
    errors['screwdriverBitModel'] = 'Screwdriver bit model is required.';
  }
  if (!String(form.screwSpec ?? '').trim()) {
    errors['screwSpec'] = 'Screw specification is required.';
  }
  if (!String(form.electricScrewdriverModel ?? '').trim()) {
    errors['electricScrewdriverModel'] = 'Electric screwdriver model is required.';
  }
  if (!String(form.modelName ?? '').trim()) {
    errors['modelName'] = 'Model name is required.';
  }
  if (!String(form.lockedItemMaterial ?? '').trim()) {
    errors['lockedItemMaterial'] = 'Locked item material is required.';
  }

  const numericFields: Array<{ key: keyof ExecutionConfigFormData; label: string }> = [
    { key: 'targetTorque', label: 'Target torque' },
    { key: 'targetTorqueLowerLimit', label: 'Target torque lower limit' },
    { key: 'targetTorqueUpperLimit', label: 'Target torque upper limit' },
    { key: 'clampingTorqueLowerLimit', label: 'Clamping torque lower limit' },
    { key: 'maximumClampingAngle', label: 'Maximum clamping angle' },
    { key: 'minimumClampingAngle', label: 'Minimum clamping angle' },
    { key: 'maximumAngleThreshold', label: 'Maximum angle threshold' },
    { key: 'minimumAngleThreshold', label: 'Minimum angle threshold' },
    { key: 'fitStandardDeviationThreshold', label: 'Fit standard deviation threshold' },
    { key: 'transThreadSpectrumThreshold', label: 'Trans-thread spectrum threshold' },
    { key: 'normalizedIntegralThreshold', label: 'Normalized integral threshold' },
    { key: 'fittingPositionStandardDeviationThreshold', label: 'Fitting position standard deviation threshold' },
    { key: 'slippageStandardDeviationThreshold', label: 'Slippage standard deviation threshold' },
    { key: 'adhesionRatioThreshold', label: 'Adhesion ratio threshold' },
    { key: 'slippagePercentageThreshold', label: 'Slippage percentage threshold' },
    { key: 'torqueStartThreshold', label: 'Torque start threshold' },
    { key: 'crossThreadExtremeThreshold', label: 'Cross-thread extreme threshold' },
    { key: 'crossThreadExtremeValueBacktrackingWindow', label: 'Cross-thread extreme value backtracking window' },
    { key: 'nyquistNormalizedCutoffFrequency', label: 'Nyquist normalized cutoff frequency' },
  ];

  for (const { key, label } of numericFields) {
    const val = form[key];
    if (val === null || val === undefined || val === ('' as unknown) || isNaN(Number(val))) {
      errors[key] = `${label} must be a valid number.`;
    }
  }

  const lsl = Number(form.targetTorqueLowerLimit);
  const usl = Number(form.targetTorqueUpperLimit);
  const target = Number(form.targetTorque);

  if (!isNaN(lsl) && !isNaN(usl) && lsl > usl) {
    errors['targetTorqueLowerLimit'] = 'Target torque lower limit cannot be greater than upper limit.';
  } else if (!isNaN(lsl) && !isNaN(usl) && !isNaN(target) && (target < lsl || target > usl)) {
    errors['targetTorque'] = 'Target torque must be between lower and upper limits.';
  }

  const minClamp = Number(form.minimumClampingAngle);
  const maxClamp = Number(form.maximumClampingAngle);
  if (!isNaN(minClamp) && !isNaN(maxClamp) && minClamp > maxClamp) {
    errors['minimumClampingAngle'] = 'Minimum clamping angle cannot exceed maximum clamping angle.';
  }

  const minAngle = Number(form.minimumAngleThreshold);
  const maxAngle = Number(form.maximumAngleThreshold);
  if (!isNaN(minAngle) && !isNaN(maxAngle) && minAngle > maxAngle) {
    errors['minimumAngleThreshold'] = 'Minimum angle threshold cannot exceed maximum angle threshold.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateFailureModeForm(
  form: FailureModeFormData,
  existingCodes: string[] = [],
  isEdit = false,
): ValidationResult {
  const errors: Record<string, string> = {};

  const code = String(form.code ?? '').trim();
  if (!code) {
    errors['code'] = 'Code is required.';
  } else if (!/^F\d{2,}$/i.test(code)) {
    errors['code'] = 'Code format should be F followed by numbers (e.g. F14).';
  } else if (!isEdit && existingCodes.map((c) => c.toUpperCase()).includes(code.toUpperCase())) {
    errors['code'] = `Code ${code} already exists.`;
  }

  const name = String(form.name ?? '').trim();
  if (!name) {
    errors['name'] = 'Name is required.';
  }

  const desc = String(form.description ?? '').trim();
  if (!desc) {
    errors['description'] = 'Description is required.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateSystemSettings(settings: SystemSettings): ValidationResult {
  const errors: Record<string, string> = {};

  const storage = Number(settings.storage_capacity_limit_gb);
  if (isNaN(storage) || storage <= 0) {
    errors['storage_capacity_limit_gb'] = 'Storage capacity must be greater than 0.';
  }

  const retention = Number(settings.log_retention_days);
  if (isNaN(retention) || retention < 1) {
    errors['log_retention_days'] = 'Log retention days must be at least 1.';
  }

  const conf = Number(settings.results_confidence_threshold);
  if (isNaN(conf) || conf < 0 || conf > 1) {
    errors['results_confidence_threshold'] = 'Confidence threshold must be between 0 and 1.';
  }

  const multi = Number(settings.multi_label_threshold);
  if (isNaN(multi) || multi < 0 || multi > 1) {
    errors['multi_label_threshold'] = 'Multi-class threshold must be between 0 and 1.';
  }

  const minSamples = Number(settings.training_min_samples_per_class);
  if (isNaN(minSamples) || minSamples < 1) {
    errors['training_min_samples_per_class'] = 'Minimum samples per class must be at least 1.';
  }

  const cap = Number(settings.local_sample_cap);
  if (isNaN(cap) || cap < 1) {
    errors['local_sample_cap'] = 'Local sample size limit must be at least 1.';
  }

  const refresh = Number(settings.dashboard_refresh_seconds);
  if (isNaN(refresh) || (refresh !== 0 && (refresh < 10 || refresh > 3600))) {
    errors['dashboard_refresh_seconds'] = 'Enter 0 to turn off, or between 10 and 3600.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
