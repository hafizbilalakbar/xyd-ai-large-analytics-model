import type { IconName } from '../../shared/components/icon/icon-paths';

export interface NavigationItem {
  readonly label: string;
  readonly route: string;
  readonly icon: IconName;
}

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { label: 'Homepage Overview', route: '/dashboard', icon: 'home' },
  { label: 'Real-time Lock Monitoring', route: '/realtime-monitoring', icon: 'activity' },
  { label: 'Sample Query', route: '/sample-search', icon: 'search' },
  { label: 'Low Confidence Review', route: '/low-confidence-review', icon: 'eye' },
  { label: 'Data Import', route: '/data-import', icon: 'download' },
  { label: 'Data Export', route: '/data-export', icon: 'upload' },
  {
    label: 'Parameter & Formula Configuration',
    route: '/parameters-and-formulas',
    icon: 'sliders',
  },
  { label: 'Training Task Management', route: '/training-tasks', icon: 'cpu' },
  { label: 'Version Management', route: '/version-management', icon: 'layers' },
  { label: 'Logs & Monitoring', route: '/logs-and-monitoring', icon: 'terminal' },
  { label: 'Permission Management', route: '/permission-management', icon: 'shield' },
];
