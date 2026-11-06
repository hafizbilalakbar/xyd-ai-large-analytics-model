import type {
  Alarm,
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

export const EMPTY_KPIS: readonly DashboardKpi[] = DASHBOARD_KPIS.map((kpi) => ({
  ...kpi,
  value: '—',
  delta: null,
}));

export const HOURLY_TREND: readonly HourlyTrendPoint[] = [
  { hour: '00:00', count: 80 },
  { hour: '01:00', count: 60 },
  { hour: '02:00', count: 40 },
  { hour: '03:00', count: 30 },
  { hour: '04:00', count: 50 },
  { hour: '05:00', count: 90 },
  { hour: '06:00', count: 160 },
  { hour: '07:00', count: 300 },
  { hour: '08:00', count: 520 },
  { hour: '09:00', count: 700 },
  { hour: '10:00', count: 900 },
  { hour: '11:00', count: 1120 },
  { hour: '12:00', count: 1050 },
  { hour: '13:00', count: 1250 },
  { hour: '14:00', count: 1380 },
  { hour: '15:00', count: 1480 },
  { hour: '16:00', count: 1240 },
  { hour: '17:00', count: 1000 },
  { hour: '18:00', count: 720 },
  { hour: '19:00', count: 250 },
  { hour: '20:00', count: 180 },
  { hour: '21:00', count: 120 },
  { hour: '22:00', count: 80 },
  { hour: '23:00', count: 47 },
];

export const FAILURE_MODES: readonly FailureMode[] = [
  { code: 'F01', name: 'Floating High', count: 176, tone: 'red' },
  { code: 'F07', name: 'Repeated Tightening', count: 111, tone: 'amber' },
  { code: 'F13', name: 'Hole Position Abnormal', count: 83, tone: 'violet' },
  { code: 'F03', name: 'Clamping Abnormal', count: 55, tone: 'blue' },
  { code: 'F05', name: 'Slipped Tooth', count: 37, tone: 'slate' },
];

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function alarmTime(minutesAgo: number): string {
  const date = new Date(Date.now() - minutesAgo * 60000);
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export const DASHBOARD_ALARMS: readonly Alarm[] = [
  {
    id: 9001,
    time: alarmTime(6),
    type: 'storage',
    details: 'Insufficient disk space/critical',
    read: false,
  },
  {
    id: 9002,
    time: alarmTime(28),
    type: 'model',
    details: 'Model: Loading failed',
    read: false,
  },
  {
    id: 9003,
    time: alarmTime(74),
    type: 'training',
    details: 'Training: Mission Failed',
    read: true,
  },
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
