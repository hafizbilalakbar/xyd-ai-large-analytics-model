import { unzipSync } from 'fflate';
import * as XLSX from 'xlsx';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_ZIP_ENTRIES,
  IMPORT_FILE_EXTENSIONS,
  FAILURE_CODES,
  validateTrainingRow,
} from './import-constants';
import type {
  CurvePoint,
  FileParseError,
  FileParseResult,
  ImportProgress,
  PlaybackCurveItem,
  PlaybackImportResult,
  TrainingImportResult,
  TrainingRow,
  WorkerRequest,
} from './data-import.models';

let cancelled = false;
let rowIdCounter = 0;
let curveIdCounter = 0;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  cancelled = false;
  const request = event.data;
  if (request.type === 'cancel') {
    cancelled = true;
    return;
  }
  if (request.type === 'parsePlayback') {
    handlePlayback(request.files, request.batchId)
      .then((result) => self.postMessage({ type: 'playbackResult', result }))
      .catch((error) => self.postMessage({ type: 'error', message: error.message }));
  } else if (request.type === 'parseTraining') {
    handleTraining(request.files)
      .then((result) => self.postMessage({ type: 'trainingResult', result }))
      .catch((error) => self.postMessage({ type: 'error', message: error.message }));
  }
};

function sendProgress(progress: ImportProgress): void {
  self.postMessage({ type: 'progress', progress });
}

async function handlePlayback(files: readonly File[], batchId: string): Promise<PlaybackImportResult> {
  const startTime = performance.now();
  const allItems: PlaybackCurveItem[] = [];
  const allErrors: FileParseError[] = [];
  const totalFiles = files.length;

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    if (cancelled) throw new Error('cancelled');
    const file = files[fileIndex];
    sendProgress({
      status: 'reading',
      percent: Math.round((fileIndex / totalFiles) * 100),
      stage: `Reading file ${fileIndex + 1} of ${totalFiles}`,
      fileName: file.name,
      elapsedMs: Math.round(performance.now() - startTime),
    });

    const fileResults = await parsePlaybackFile(file, batchId, startTime);
    allItems.push(...fileResults.curves);
    allErrors.push(...fileResults.errors);
  }

  sendProgress({
    status: 'done',
    percent: 100,
    stage: 'Import complete',
    fileName: files[files.length - 1]?.name ?? '',
    elapsedMs: Math.round(performance.now() - startTime),
  });

  return { items: allItems, errors: allErrors };
}

async function handleTraining(files: readonly File[]): Promise<TrainingImportResult> {
  const startTime = performance.now();
  const allRows: TrainingRow[] = [];
  const allErrors: FileParseError[] = [];
  const totalFiles = files.length;

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    if (cancelled) throw new Error('cancelled');
    const file = files[fileIndex];
    sendProgress({
      status: 'reading',
      percent: Math.round((fileIndex / totalFiles) * 100),
      stage: `Reading file ${fileIndex + 1} of ${totalFiles}`,
      fileName: file.name,
      elapsedMs: Math.round(performance.now() - startTime),
    });

    const fileResults = await parseTrainingFile(file, startTime);
    allRows.push(...fileResults.rows);
    allErrors.push(...fileResults.errors);
  }

  sendProgress({
    status: 'done',
    percent: 100,
    stage: 'Import complete',
    fileName: files[files.length - 1]?.name ?? '',
    elapsedMs: Math.round(performance.now() - startTime),
  });

  return { rows: allRows, errors: allErrors };
}

async function parsePlaybackFile(
  file: File,
  batchId: string,
  startTime: number,
): Promise<FileParseResult> {
  const curves: PlaybackCurveItem[] = [];
  const errors: FileParseError[] = [];
  const ext = getExtension(file.name);

  if (file.size > MAX_FILE_SIZE_BYTES) {
    errors.push({ fileName: file.name, message: 'File is too large.' });
    return { fileName: file.name, curves, rows: [], errors };
  }

  if (ext === '.zip') {
    const entries = await readZip(file, startTime);
    for (const entry of entries) {
      if (cancelled) throw new Error('cancelled');
      if (!isSupportedExtension(entry.name)) continue;
      const inner = await parseSinglePlaybackFile(entry.name, entry.buffer, batchId);
      curves.push(...inner.curves);
      errors.push(...inner.errors);
    }
  } else {
    const buffer = await file.arrayBuffer();
    const inner = await parseSinglePlaybackFile(file.name, buffer, batchId);
    curves.push(...inner.curves);
    errors.push(...inner.errors);
  }

  return { fileName: file.name, curves, rows: [], errors };
}

async function parseTrainingFile(file: File, startTime: number): Promise<FileParseResult> {
  const rows: TrainingRow[] = [];
  const errors: FileParseError[] = [];
  const ext = getExtension(file.name);

  if (file.size > MAX_FILE_SIZE_BYTES) {
    errors.push({ fileName: file.name, message: 'File is too large.' });
    return { fileName: file.name, curves: [], rows, errors };
  }

  if (ext === '.zip') {
    const entries = await readZip(file, startTime);
    for (const entry of entries) {
      if (cancelled) throw new Error('cancelled');
      if (!isSupportedExtension(entry.name)) continue;
      const inner = await parseSingleTrainingFile(entry.name, entry.buffer);
      rows.push(...inner.rows);
      errors.push(...inner.errors);
    }
  } else {
    const buffer = await file.arrayBuffer();
    const inner = await parseSingleTrainingFile(file.name, buffer);
    rows.push(...inner.rows);
    errors.push(...inner.errors);
  }

  return { fileName: file.name, curves: [], rows, errors };
}

async function parseSinglePlaybackFile(
  fileName: string,
  buffer: ArrayBuffer,
  batchId: string,
): Promise<FileParseResult> {
  const curves: PlaybackCurveItem[] = [];
  const errors: FileParseError[] = [];

  try {
    const { text: _text, delimiter: _delimiter, headers, rows } = await extractTextRows(fileName, buffer);
    const headerLower = headers.map((h) => h.toLowerCase().trim());
    const angleIdx = findColumnIndex(headerLower, ['angle', 'deg', 'degree', '角度']);
    const torqueIdx = findColumnIndex(headerLower, ['torque', 'nm', '扭矩', '扭力']);
    const timeIdx = findColumnIndex(headerLower, ['time', 'elapsed', 'ms', '时间']);
    const sampleIdx = findColumnIndex(headerLower, ['sample', 'sampleid', '样本编号', '样品编号']);
    const lockingIdx = findColumnIndex(headerLower, ['lockingtime', 'locktime', '时间', 'timestamp']);

    if (angleIdx < 0 && timeIdx < 0) {
      errors.push({ fileName, message: 'Could not find angle or time column.' });
      return { fileName, curves, rows: [], errors };
    }
    if (torqueIdx < 0) {
      errors.push({ fileName, message: 'Could not find torque column.' });
      return { fileName, curves, rows: [], errors };
    }

    const points: CurvePoint[] = rows
      .map((row) => {
        const angleRaw = angleIdx >= 0 ? row[angleIdx] : row[timeIdx];
        const torqueRaw = row[torqueIdx];
        const angle = parseFloat(angleRaw ?? '');
        const torque = parseFloat(torqueRaw ?? '');
        if (!Number.isFinite(angle) || !Number.isFinite(torque)) return null;
        return { angle, torque };
      })
      .filter((p): p is CurvePoint => p !== null);

    if (points.length === 0) {
      errors.push({ fileName, message: 'No valid curve points found.' });
      return { fileName, curves, rows: [], errors };
    }

    points.sort((a, b) => a.angle - b.angle);

    const sampleId = sampleIdx >= 0 && rows[0]?.[sampleIdx]
      ? rows[0][sampleIdx]
      : extractSampleIdFromName(fileName);
    const lockingTime = lockingIdx >= 0 && rows[0]?.[lockingIdx]
      ? parseDateToIso(rows[0][lockingIdx]) ?? new Date().toISOString()
      : new Date().toISOString();
    const peakTorque = Math.max(...points.map((p) => p.torque));
    const finalAngle = points[points.length - 1].angle;
    const result = judgeCurve(points);

    curves.push({
      id: `${fileName}-${curveIdCounter++}`,
      fileName,
      sampleId,
      batchId,
      lockingTime,
      pointCount: points.length,
      result,
      warning: false,
      curve: points,
      peakTorque,
      finalAngle,
    });
  } catch (error) {
    errors.push({ fileName, message: error instanceof Error ? error.message : 'Parse error.' });
  }

  return { fileName, curves, rows: [], errors };
}

async function parseSingleTrainingFile(fileName: string, buffer: ArrayBuffer): Promise<FileParseResult> {
  const rows: TrainingRow[] = [];
  const errors: FileParseError[] = [];

  try {
    const { headers, rows: dataRows } = await extractTextRows(fileName, buffer);
    const headerLower = headers.map((h) => h.toLowerCase().trim());

    const sampleIdx = findColumnIndex(headerLower, ['sampleid', 'sample id', '样本编号', '样品编号', 'sample']);
    const timeIdx = findColumnIndex(headerLower, ['lockingtime', 'lock time', '时间', 'timestamp', 'datetime']);
    const failureIdx = findColumnIndex(headerLower, ['failuremode', 'failure mode', '失效模式', '缺陷模式', 'failure']);
    const correctedIdx = findColumnIndex(headerLower, ['corrected', '已修正', '修正']);
    const confidenceIdx = findColumnIndex(headerLower, ['confidence', '置信度', '置信']);
    const versionIdx = findColumnIndex(headerLower, ['modelversion', 'model version', '模型版本', 'version']);

    if (sampleIdx < 0) {
      errors.push({ fileName, message: 'Could not find Sample ID column.' });
      return { fileName, curves: [], rows, errors };
    }

    for (let i = 0; i < dataRows.length; i++) {
      if (cancelled) throw new Error('cancelled');
      const row = dataRows[i];
      const sampleId = row[sampleIdx]?.trim() ?? '';
      const lockingTime = timeIdx >= 0 ? parseDateToIso(row[timeIdx]) ?? '' : '';
      const failureModeRaw = failureIdx >= 0 ? row[failureIdx]?.trim() ?? '' : '';
      const failureMode = failureModeRaw ? normalizeFailureCode(failureModeRaw) : null;
      const corrected = correctedIdx >= 0 ? parseCorrected(row[correctedIdx]) : false;
      const confidence = confidenceIdx >= 0 ? parseConfidence(row[confidenceIdx]) : null;
      const modelVersion = versionIdx >= 0 ? row[versionIdx]?.trim() ?? 'V3.0' : 'V3.0';

      const provisional: TrainingRow = {
        id: `${fileName}-${rowIdCounter++}`,
        fileName,
        rowIndex: i + 1,
        sampleId,
        lockingTime,
        failureMode,
        failureModeRaw: failureModeRaw ? failureModeRaw : null,
        corrected,
        confidence: confidence ?? 0,
        modelVersion,
        status: 'Valid',
        reason: '',
        edited: false,
      };

      const validation = validateTrainingRow(provisional, rows, provisional.id);

      rows.push({ ...provisional, status: validation.status, reason: validation.reason });
    }
  } catch (error) {
    errors.push({ fileName, message: error instanceof Error ? error.message : 'Parse error.' });
  }

  return { fileName, curves: [], rows, errors };
}

async function extractTextRows(
  fileName: string,
  buffer: ArrayBuffer,
): Promise<{ text: string; delimiter: string; headers: string[]; rows: string[][] }> {
  const ext = getExtension(fileName);

  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
    const nonEmpty = json.filter((row) => row.some((cell) => String(cell).trim().length > 0));
    const headers = nonEmpty[0]?.map((h) => String(h).trim()) ?? [];
    const rows = nonEmpty.slice(1).map((row) => row.map((cell) => String(cell).trim()));
    return { text: '', delimiter: ',', headers, rows };
  }

  const text = await decodeText(buffer);
  if (ext === '.json') {
    const parsed = JSON.parse(text) as unknown;
    let array: unknown[] = [];
    if (Array.isArray(parsed)) {
      array = parsed;
    } else if (parsed && typeof parsed === 'object') {
      for (const key of ['data', 'rows', 'items']) {
        const value = (parsed as Record<string, unknown>)[key];
        if (Array.isArray(value)) {
          array = value;
          break;
        }
      }
    }
    const headers = array.length > 0 && typeof array[0] === 'object' ? Object.keys(array[0] as object) : [];
    const rows = array.map((item) => headers.map((h) => String((item as Record<string, unknown>)[h] ?? '')));
    return { text, delimiter: ',', headers, rows };
  }

  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headerIndex = findHeaderRow(lines, delimiter);
  const headers = splitLine(lines[headerIndex] ?? '', delimiter);
  const rows = lines.slice(headerIndex + 1).map((line) => splitLine(line, delimiter));
  return { text, delimiter, headers, rows };
}

async function readZip(file: File, startTime: number): Promise<{ name: string; buffer: ArrayBuffer }[]> {
  const buffer = await file.arrayBuffer();
  const unzipped = unzipSync(new Uint8Array(buffer));
  const entries: { name: string; buffer: ArrayBuffer }[] = [];
  const names = Object.keys(unzipped);

  if (names.length > MAX_ZIP_ENTRIES) {
    throw new Error('Too many files in ZIP.');
  }

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (name.startsWith('__MACOSX') || name.includes('.DS_Store') || name.includes('Thumbs.db')) continue;
    if (!isSupportedExtension(name)) continue;
    const data = unzipped[name];
    if (!data) continue;
    sendProgress({
      status: 'extracting',
      percent: Math.round((i / names.length) * 50),
      stage: `Extracting file ${i + 1} of ${names.length}`,
      fileName: name,
      elapsedMs: Math.round(performance.now() - startTime),
    });
    entries.push({ name, buffer: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) });
  }
  return entries;
}

function judgeCurve(points: CurvePoint[]): 'PASS' | 'FAIL' | 'Pending' {
  if (points.length === 0) return 'Pending';
  const peak = Math.max(...points.map((p) => p.torque));
  const final = points[points.length - 1].torque;
  if (peak < 0.5 || final < 0.2) return 'FAIL';
  return 'PASS';
}

function extractSampleIdFromName(fileName: string): string {
  const base = fileName.replace(/\.[^/.]+$/, '');
  return base || 'UNKNOWN';
}

function getExtension(fileName: string): string {
  const lower = fileName.toLowerCase();
  const idx = lower.lastIndexOf('.');
  return idx >= 0 ? lower.slice(idx) : '';
}

function isSupportedExtension(fileName: string): boolean {
  return IMPORT_FILE_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext));
}

function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0).slice(0, 10);
  const delimiters = [',', '\t', ';', '|'];
  let best = ',';
  let bestCount = 0;
  for (const d of delimiters) {
    const counts = lines.map((line) => countDelimiter(line, d));
    const min = Math.min(...counts);
    if (min > 0 && min > bestCount) {
      bestCount = min;
      best = d;
    }
  }
  return best;
}

function countDelimiter(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === delimiter) {
      count++;
    }
  }
  return count;
}

function splitLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && char === delimiter) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((v) => v.trim());
}

function findHeaderRow(lines: string[], delimiter: string): number {
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    if (line.length === 0 || line.startsWith('#') || line.startsWith('//')) continue;
    const parts = splitLine(line, delimiter);
    if (parts.length >= 2 && parts.some((p) => isNaN(Number(p)))) return i;
  }
  return 0;
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().replace(/[\s_\-]/g, '');
    if (candidates.some((c) => h.includes(c.toLowerCase().replace(/[\s_\-]/g, '')))) return i;
  }
  return -1;
}

async function decodeText(buffer: ArrayBuffer): Promise<string> {
  const uint8 = new Uint8Array(buffer);
  if (uint8.length >= 3 && uint8[0] === 0xEF && uint8[1] === 0xBB && uint8[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(uint8.slice(3));
  }
  if (uint8.length >= 2 && uint8[0] === 0xFF && uint8[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(uint8.slice(2));
  }
  return new TextDecoder('utf-8').decode(uint8);
}

function parseDateToIso(value: string): string | null {
  if (!value) return null;
  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime())) return iso.toISOString();
  const parts = value.split(/[-/]/);
  if (parts.length === 3) {
    const [a, b, c] = parts.map((p) => Number(p));
    if (a > 31) return new Date(a, b - 1, c).toISOString();
    if (c > 31) return new Date(c, b - 1, a).toISOString();
  }
  const excel = Number(value);
  if (!Number.isNaN(excel) && excel > 30000 && excel < 50000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + excel * 24 * 60 * 60 * 1000).toISOString();
  }
  return null;
}

function parseConfidence(value: string): number | null {
  const n = Number(value.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n <= 100) return n;
  if (n >= 0 && n <= 1) return Math.round(n * 100);
  return null;
}

function parseCorrected(value: string): boolean {
  const v = value.toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y' || v === '是';
}

function normalizeFailureCode(value: string): string | null {
  const v = value.trim().toUpperCase();
  if (FAILURE_CODES.some((f) => f.key === v)) return v;
  const match = value.trim().match(/^F(\d{2})$/i);
  if (match) {
    const code = `F${match[1].padStart(2, '0')}`;
    if (FAILURE_CODES.some((f) => f.key === code)) return code;
  }
  return null;
}

export {};
