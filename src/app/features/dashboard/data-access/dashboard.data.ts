import type {
  DashboardKpi,
  FailureMode,
  HourlyTrendPoint,
  SystemWarning,
} from './dashboard.models';

export const DASHBOARD_KPIS: readonly DashboardKpi[] = [
  {
    label: 'Total Locked Items Today',
    value: '12,847',
    icon: 'layers',
    tone: 'primary',
    delta: '+8.4%',
    deltaDirection: 'up',
    deltaTone: 'positive',
  },
  {
    label: 'PASS Rate',
    value: '96.4%',
    icon: 'check',
    tone: 'success',
    delta: '+0.6%',
    deltaDirection: 'up',
    deltaTone: 'positive',
  },
  {
    label: 'FAIL Count',
    value: '462',
    icon: 'alert',
    tone: 'danger',
    delta: '-3.1%',
    deltaDirection: 'down',
    deltaTone: 'positive',
  },
  {
    label: 'Low Confidence Count',
    value: '128',
    icon: 'activity',
    tone: 'warning',
    delta: '+2.2%',
    deltaDirection: 'up',
    deltaTone: 'negative',
  },
];

export const HOURLY_TREND: readonly HourlyTrendPoint[] = [
  { hour: '08:00', count: 680 },
  { hour: '09:00', count: 910 },
  { hour: '10:00', count: 1150 },
  { hour: '11:00', count: 1360 },
  { hour: '12:00', count: 1240 },
  { hour: '13:00', count: 1480 },
  { hour: '14:00', count: 1610 },
  { hour: '15:00', count: 1740 },
  { hour: '16:00', count: 1490 },
  { hour: '17:00', count: 1187 },
];

export const FAILURE_MODES: readonly FailureMode[] = [
  { label: 'Dimensional Deviation', count: 176, tone: 'blue' },
  { label: 'Surface Defect', count: 111, tone: 'amber' },
  { label: 'Material Anomaly', count: 83, tone: 'red' },
  { label: 'Assembly Mismatch', count: 55, tone: 'violet' },
  { label: 'Other', count: 37, tone: 'slate' },
];

export const SYSTEM_WARNINGS: readonly SystemWarning[] = [
  {
    id: 1,
    time: '17:42',
    level: 'Critical',
    service: 'Inference Engine',
    message: 'Model response latency exceeded 850 ms for 5 consecutive minutes.',
    status: 'Investigating',
  },
  {
    id: 2,
    time: '17:18',
    level: 'Warning',
    service: 'Data Ingest',
    message: 'Batch XYD-2026-1102-041 contains 37 unreadable samples.',
    status: 'Open',
  },
  {
    id: 3,
    time: '16:56',
    level: 'Warning',
    service: 'Confidence Service',
    message: 'Low confidence ratio exceeded the 2.0% threshold.',
    status: 'Investigating',
  },
  {
    id: 4,
    time: '16:24',
    level: 'Info',
    service: 'Version Service',
    message: 'Model version v2.4.1 deployed to the production channel.',
    status: 'Resolved',
  },
  {
    id: 5,
    time: '15:47',
    level: 'Warning',
    service: 'Data Export',
    message: 'Scheduled export completed with 4 skipped records.',
    status: 'Resolved',
  },
];
