import { Injectable, inject } from '@angular/core';
import {
  ExecutionConfig,
  FailureMode,
  SystemSettings,
  buildThresholdSummary,
  formatConfigDate,
  DEFAULT_SYSTEM_SETTINGS,
} from './parameters-and-formulas.models';
import {
  USE_PARAMETERS_AND_FORMULAS_MOCK,
  MOCK_EXECUTION_CONFIGS,
  MOCK_FAILURE_MODES,
  MOCK_SYSTEM_SETTINGS,
} from './parameters-and-formulas.mock';
import { OperationLogService } from '../../../shared/services/operation-log.service';

const STORAGE_KEY_EXEC_CONFIGS = 'xyd_config_screwdriver_params';
const STORAGE_KEY_FAILURE_MODES = 'xyd_config_failure_types';
const STORAGE_KEY_SYS_SETTINGS = 'xyd_config_system_settings';

@Injectable({ providedIn: 'root' })
export class ParametersAndFormulasApiService {
  private readonly operationLog = inject(OperationLogService);

  private executionConfigs: ExecutionConfig[] = this.loadExecutionConfigs();
  private failureModes: FailureMode[] = this.loadFailureModes();
  private systemSettings: SystemSettings = this.loadSystemSettings();

  private loadExecutionConfigs(): ExecutionConfig[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_EXEC_CONFIGS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return JSON.parse(JSON.stringify(MOCK_EXECUTION_CONFIGS));
  }

  private saveExecutionConfigsToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_EXEC_CONFIGS, JSON.stringify(this.executionConfigs));
    } catch {}
  }

  private loadFailureModes(): FailureMode[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_FAILURE_MODES);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return JSON.parse(JSON.stringify(MOCK_FAILURE_MODES));
  }

  private saveFailureModesToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_FAILURE_MODES, JSON.stringify(this.failureModes));
    } catch {}
  }

  private loadSystemSettings(): SystemSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SYS_SETTINGS);
      if (stored) {
        return { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {}
    return { ...DEFAULT_SYSTEM_SETTINGS, ...MOCK_SYSTEM_SETTINGS };
  }

  private saveSystemSettingsToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_SYS_SETTINGS, JSON.stringify(this.systemSettings));
    } catch {}
  }

  private logOperation(action: string, details: string): void {
    this.operationLog.add({
      operator: 'Administrator',
      format: action,
      scope: details,
      recordCount: 1,
      deleted: action.toLowerCase().includes('delete'),
    });
  }

  async getExecutionConfigs(): Promise<ExecutionConfig[]> {
    if (USE_PARAMETERS_AND_FORMULAS_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return JSON.parse(JSON.stringify(this.executionConfigs));
    }
    return [];
  }

  async createExecutionConfig(config: ExecutionConfig): Promise<ExecutionConfig> {
    if (USE_PARAMETERS_AND_FORMULAS_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const now = new Date();
      const updatedItem: ExecutionConfig = {
        ...config,
        summary: buildThresholdSummary(config.specs, config.torque_thres),
        updated_at: now.toISOString(),
        updatedAt: formatConfigDate(now),
      };
      this.executionConfigs.push(updatedItem);
      this.saveExecutionConfigsToStorage();
      this.logOperation('Create Execution Config', `Batch Number: ${config.batchNumber}`);
      return JSON.parse(JSON.stringify(updatedItem));
    }
    return config;
  }

  async updateExecutionConfig(config: ExecutionConfig): Promise<ExecutionConfig> {
    if (USE_PARAMETERS_AND_FORMULAS_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const idx = this.executionConfigs.findIndex(
        (c) => String(c.screwdriver_id) === String(config.screwdriver_id) || c.batchNumber === config.batchNumber,
      );
      const now = new Date();
      const updatedItem: ExecutionConfig = {
        ...config,
        summary: buildThresholdSummary(config.specs, config.torque_thres),
        updated_at: now.toISOString(),
        updatedAt: formatConfigDate(now),
      };
      if (idx >= 0) {
        this.executionConfigs[idx] = updatedItem;
      } else {
        this.executionConfigs.push(updatedItem);
      }
      this.saveExecutionConfigsToStorage();
      this.logOperation('Update Execution Config', `Batch Number: ${config.batchNumber}`);
      return JSON.parse(JSON.stringify(updatedItem));
    }
    return config;
  }

  async deleteExecutionConfig(batchNumber: string): Promise<void> {
    if (USE_PARAMETERS_AND_FORMULAS_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      this.executionConfigs = this.executionConfigs.filter(
        (c) => c.batchNumber !== batchNumber && String(c.screwdriver_id) !== batchNumber,
      );
      this.saveExecutionConfigsToStorage();
      this.logOperation('Delete Execution Config', `Batch Number: ${batchNumber}`);
      return;
    }
  }

  async getFailureModes(): Promise<FailureMode[]> {
    if (USE_PARAMETERS_AND_FORMULAS_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return JSON.parse(JSON.stringify(this.failureModes));
    }
    return [];
  }

  async createFailureMode(mode: FailureMode): Promise<FailureMode> {
    if (USE_PARAMETERS_AND_FORMULAS_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const newMode: FailureMode = {
        ...mode,
        type: 'Custom',
        is_builtin: false,
      };
      this.failureModes.push(newMode);
      this.saveFailureModesToStorage();
      this.logOperation('Create Failure Mode', `Code: ${mode.code}, Name: ${mode.name}`);
      return JSON.parse(JSON.stringify(newMode));
    }
    return mode;
  }

  async updateFailureMode(mode: FailureMode): Promise<FailureMode> {
    if (USE_PARAMETERS_AND_FORMULAS_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const idx = this.failureModes.findIndex((m) => m.code === mode.code);
      if (idx >= 0) {
        const existing = this.failureModes[idx];
        this.failureModes[idx] = {
          ...existing,
          description: mode.description,
          status: mode.status,
          enabled: mode.status === 'Enabled',
          name: existing.is_builtin ? existing.name : mode.name,
        };
      }
      this.saveFailureModesToStorage();
      this.logOperation('Update Failure Mode', `Code: ${mode.code}`);
      return JSON.parse(JSON.stringify(this.failureModes[idx]));
    }
    return mode;
  }

  async setFailureModeStatus(code: string, status: 'Enabled' | 'Disabled'): Promise<FailureMode> {
    if (USE_PARAMETERS_AND_FORMULAS_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const idx = this.failureModes.findIndex((m) => m.code === code);
      if (idx >= 0) {
        this.failureModes[idx].status = status;
        this.failureModes[idx].enabled = status === 'Enabled';
        this.saveFailureModesToStorage();
        this.logOperation('Toggle Failure Mode Status', `Code: ${code}, Status: ${status}`);
        return JSON.parse(JSON.stringify(this.failureModes[idx]));
      }
      throw new Error(`Failure mode ${code} not found.`);
    }
    throw new Error('Real backend connection not configured.');
  }

  async deleteFailureMode(code: string): Promise<void> {
    if (USE_PARAMETERS_AND_FORMULAS_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      this.failureModes = this.failureModes.filter((m) => m.code !== code);
      this.saveFailureModesToStorage();
      this.logOperation('Delete Failure Mode', `Code: ${code}`);
      return;
    }
  }

  async getSystemSettings(): Promise<SystemSettings> {
    if (USE_PARAMETERS_AND_FORMULAS_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return JSON.parse(JSON.stringify(this.systemSettings));
    }
    return DEFAULT_SYSTEM_SETTINGS;
  }

  async saveSystemSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    if (USE_PARAMETERS_AND_FORMULAS_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      this.systemSettings = {
        ...this.systemSettings,
        ...settings,
        local_model_max_kept: 2,
      };
      this.saveSystemSettingsToStorage();
      this.logOperation('Save System Settings', 'Updated system configuration parameters');
      return JSON.parse(JSON.stringify(this.systemSettings));
    }
    return { ...DEFAULT_SYSTEM_SETTINGS, ...settings };
  }
}
