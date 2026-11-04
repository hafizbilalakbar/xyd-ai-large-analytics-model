import { zipSync, strToU8 } from 'fflate';
import * as XLSX from 'xlsx';
import { FAILURE_CODES } from './import-constants';
import type { CurvePoint, PlaybackCurveItem, TrainingRow } from './data-import.models';

export const USE_DATA_IMPORT_MOCK = true;

function generateCurvePoints(count: number): CurvePoint[] {
  const points: CurvePoint[] = [];
  for (let i = 0; i < count; i++) {
    const angle = i * 2;
    const torque = Math.sin(i * 0.1) * 2 + 3 + Math.random() * 0.2;
    points.push({ angle, torque: Math.max(0, torque) });
  }
  return points;
}

export function generateMockPlaybackZip(): File {
  const files: Record<string, Uint8Array> = {};
  for (let i = 1; i <= 30; i++) {
    const rows = [
      'Angle,Torque',
      ...generateCurvePoints(50).map((p) => `${p.angle},${p.torque.toFixed(3)}`),
    ];
    files[`curve-${String(i).padStart(3, '0')}.csv`] = strToU8(rows.join('\n'));
  }
  const zipped = zipSync(files, { level: 5 });
  return new File([zipped], 'playback-curves.zip', { type: 'application/zip' });
}

export function generateMockTrainingCsv(): File {
  const headers = ['样本编号', '锁定时间', '失效模式', '已修正', '置信度', '模型版本'];
  const rows: string[][] = [];
  for (let i = 1; i <= 50; i++) {
    rows.push([
      `XYD-20261103-${String(i).padStart(3, '0')}`,
      `2026-11-03 ${String(8 + Math.floor(i / 6)).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}`,
      i % 7 === 0 ? 'F01' : '',
      i % 3 === 0 ? '是' : '否',
      String(80 + (i % 20)),
      'V3.0',
    ]);
  }
  const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  return new File([new Blob([csv], { type: 'text/csv' })], 'training-chinese.csv', {
    type: 'text/csv',
  });
}

export function generateMockTrainingXlsx(): File {
  const rows: (string | number)[][] = [
    ['Sample ID', 'Locking Time', 'Failure Mode', 'Corrected', 'Confidence', 'Model Version'],
  ];
  for (let i = 1; i <= 20; i++) {
    rows.push([
      `XYD-20261103-${String(i).padStart(3, '0')}`,
      `2026-11-03 10:${String((i * 3) % 60).padStart(2, '0')}`,
      i % 5 === 0 ? 'F03' : '',
      i % 2 === 0 ? 'TRUE' : 'FALSE',
      75 + (i % 25),
      'V3.0',
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Training');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new File([buffer], 'training-data.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function generateMockTrainingJson(): File {
  const data = [];
  for (let i = 1; i <= 25; i++) {
    data.push({
      sampleId: `XYD-20261103-${String(i).padStart(3, '0')}`,
      lockingTime: `2026-11-03 11:${String((i * 2) % 60).padStart(2, '0')}`,
      failureMode: i % 6 === 0 ? 'F02' : null,
      corrected: i % 4 === 0,
      confidence: 70 + (i % 30),
      modelVersion: 'V3.0',
    });
  }
  const text = JSON.stringify({ data }, null, 2);
  return new File([text], 'training-data.json', { type: 'application/json' });
}

export function generateMockMessyFile(): File {
  const headers = ['Sample ID', 'Locking Time', 'Failure Mode', 'Corrected', 'Confidence', 'Model Version'];
  const rows: string[][] = [
    ['XYD-20261103-001', 'not-a-date', 'F99', 'maybe', '150', 'V3.0'],
    ['', '2026-11-03 10:30', 'F01', 'false', '85', 'V3.0'],
    ['XYD-20261103-002', '03/11/2026', '', 'true', '0.92', 'V3.0'],
  ];
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  return new File([csv], 'messy-data.csv', { type: 'text/csv' });
}

export function generateMockPlaybackItems(batchId: string): PlaybackCurveItem[] {
  const items: PlaybackCurveItem[] = [];
  for (let i = 1; i <= 30; i++) {
    const points = generateCurvePoints(50);
    const peakTorque = Math.max(...points.map((p) => p.torque));
    const finalAngle = points[points.length - 1].angle;
    const result: 'PASS' | 'FAIL' | 'Pending' = peakTorque > 2 ? 'PASS' : 'FAIL';
    items.push({
      id: `mock-${i}`,
      fileName: `curve-${String(i).padStart(3, '0')}.csv`,
      sampleId: `XYD-20261103-${String(i).padStart(3, '0')}`,
      batchId,
      lockingTime: `2026-11-03 ${String(8 + Math.floor(i / 6)).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}`,
      pointCount: points.length,
      result,
      warning: i % 10 === 0,
      warningReason: i % 10 === 0 ? 'Sparse points' : undefined,
      curve: points,
      peakTorque,
      finalAngle,
    });
  }
  return items;
}

export function generateMockTrainingRows(): TrainingRow[] {
  const rows: TrainingRow[] = [];
  for (let i = 1; i <= 50; i++) {
    const failureMode = i % 7 === 0 ? 'F01' : null;
    rows.push({
      id: `mock-row-${i}`,
      fileName: 'mock-training.csv',
      rowIndex: i,
      sampleId: `XYD-20261103-${String(i).padStart(3, '0')}`,
      lockingTime: `2026-11-03 ${String(8 + Math.floor(i / 6)).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}`,
      failureMode,
      corrected: i % 3 === 0,
      confidence: 80 + (i % 20),
      modelVersion: 'V3.0',
      status: i % 10 === 0 ? 'Warning' : 'Valid',
      reason: i % 10 === 0 ? 'Duplicate Sample ID inside file.' : '',
      edited: false,
      failureModeRaw: failureMode,
    });
  }
  return rows;
}

export { FAILURE_CODES };
