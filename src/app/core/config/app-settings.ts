export interface AppSettings {
  readonly name: string;
  readonly shortName: string;
  readonly version: string;
  readonly statusLabel: string;
}

export const APP_SETTINGS: AppSettings = {
  name: 'XYD AI Large Model Locking Data Analysis and Learning Platform',
  shortName: 'XYD AI Analytics',
  version: 'v1.0.0',
  statusLabel: 'All systems operational',
};
