import { Injectable } from '@angular/core';
import {
  MOCK_BATCHES,
} from './import-constants';
import {
  generateMockPlaybackZip,
  generateMockTrainingCsv,
  generateMockTrainingXlsx,
  generateMockTrainingJson,
  generateMockMessyFile,
} from './data-import.mock';
import type { BatchOption, TrainingRow, WriteTrainingResult } from './data-import.models';

export const USE_DATA_IMPORT_MOCK = true;

@Injectable({ providedIn: 'root' })
export class ImportApiService {
  async getBatches(): Promise<BatchOption[]> {
    if (USE_DATA_IMPORT_MOCK) {
      await delay(300);
      return [...MOCK_BATCHES];
    }
    throw new Error('API not implemented.');
  }

  async uploadPlayback(_batchId: string, files: File[]): Promise<{ items: number; errors: number }> {
    if (USE_DATA_IMPORT_MOCK) {
      await delay(1000);
      return { items: files.length * 5, errors: 0 };
    }
    throw new Error('API not implemented.');
  }

  async writeTrainingSet(
    rows: TrainingRow[],
    duplicateMode: string,
  ): Promise<WriteTrainingResult> {
    if (USE_DATA_IMPORT_MOCK) {
      await delay(1200);
      const skipped = duplicateMode === 'skip' ? Math.floor(rows.length * 0.1) : 0;
      const failed = 0;
      return {
        written: rows.length - skipped - failed,
        skipped,
        failed,
      };
    }
    throw new Error('API not implemented.');
  }

  downloadTemplate(): void {
    const headers = ['Sample ID', 'Locking Time', 'Failure Mode', 'Corrected', 'Confidence', 'Model Version'];
    const rows = [
      ['XYD-20261103-001', '2026-11-03 10:30', 'F01', 'false', '92', 'V3.0'],
      ['XYD-20261103-002', '2026-11-03 10:25', '', 'true', '88', 'V3.0'],
    ];
    downloadCsv('import-template.csv', [headers, ...rows]);
  }

  downloadErrorReport(errors: { fileName: string; rowIndex?: number; message: string }[]): void {
    const headers = ['File', 'Row', 'Reason'];
    const rows = errors.map((e) => [e.fileName, String(e.rowIndex ?? ''), e.message]);
    downloadCsv('import-error-report.csv', [headers, ...rows]);
  }

  generateMockPlaybackZip(): File {
    return generateMockPlaybackZip();
  }

  generateMockTrainingCsv(): File {
    return generateMockTrainingCsv();
  }

  generateMockTrainingXlsx(): File {
    return generateMockTrainingXlsx();
  }

  generateMockTrainingJson(): File {
    return generateMockTrainingJson();
  }

  generateMockMessyFile(): File {
    return generateMockMessyFile();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadCsv(fileName: string, rows: string[][]): void {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
