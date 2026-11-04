import { Injectable } from '@angular/core';
import { COLUMN_SYNONYMS, RESULT_TEXT_MAP, FAILURE_CODES } from './import-constants';
import type { ColumnMapping, MatchConfidence } from './data-import.models';

type RowRecord = Record<string, string | undefined>;

@Injectable({ providedIn: 'root' })
export class ColumnMapperService {
  private normalizeHeader(header: string): string {
    return header
      .toLowerCase()
      .replace(/[\s_\-().\[\]{}]/g, '')
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
  }

  buildRowRecord(headers: string[], values: string[]): RowRecord {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = values[i] ?? '';
    });
    return record;
  }

  detectMappings(headers: string[], rows: string[][]): ColumnMapping[] {
    const fields = Object.keys(COLUMN_SYNONYMS);
    return fields.map((field) => {
      const match = this.findBestMatch(field, headers, rows);
      return {
        field,
        sourceColumn: match.column,
        confidence: match.confidence,
        samples: match.samples,
      };
    });
  }

  private findBestMatch(
    field: string,
    headers: string[],
    rows: string[][],
  ): { column: string | null; confidence: MatchConfidence; samples: (string | null)[] } {
    const synonyms = COLUMN_SYNONYMS[field] ?? [];
    const normalizedSynonyms = synonyms.map((s) => this.normalizeHeader(s));

    for (const header of headers) {
      const normalized = this.normalizeHeader(header);
      if (normalizedSynonyms.includes(normalized)) {
        return {
          column: header,
          confidence: 'High',
          samples: this.getSamples(header, headers, rows),
        };
      }
    }

    for (const header of headers) {
      const normalized = this.normalizeHeader(header);
      if (normalizedSynonyms.some((s) => s.includes(normalized) || normalized.includes(s))) {
        return {
          column: header,
          confidence: 'Medium',
          samples: this.getSamples(header, headers, rows),
        };
      }
    }

    if (rows.length > 0) {
      const byPattern = this.findByValuePattern(field, headers, rows);
      if (byPattern) {
        return {
          column: byPattern,
          confidence: 'Low',
          samples: this.getSamples(byPattern, headers, rows),
        };
      }
    }

    return { column: null, confidence: 'Low', samples: [] };
  }

  private getSamples(column: string, headers: string[], rows: string[][]): (string | null)[] {
    const index = headers.indexOf(column);
    if (index < 0) return [];
    return rows.slice(0, 3).map((row) => row[index] ?? null);
  }

  private findByValuePattern(field: string, headers: string[], rows: string[][]): string | null {
    if (field === 'lockingTime') {
      for (let i = 0; i < headers.length; i++) {
        const samples = rows.slice(0, 5).map((row) => row[i]);
        if (samples.every((s) => this.looksLikeDate(s))) {
          return headers[i];
        }
      }
    }
    if (field === 'confidence') {
      for (let i = 0; i < headers.length; i++) {
        const samples = rows.slice(0, 5).map((row) => row[i]);
        if (samples.every((s) => this.isConfidenceValue(s))) {
          return headers[i];
        }
      }
    }
    if (field === 'angle') {
      for (let i = 0; i < headers.length; i++) {
        const samples = rows.slice(0, 5).map((row) => row[i]);
        if (samples.every((s) => this.isNumericRange(s, 0, 360))) {
          return headers[i];
        }
      }
    }
    if (field === 'torque') {
      for (let i = 0; i < headers.length; i++) {
        const samples = rows.slice(0, 5).map((row) => row[i]);
        if (samples.every((s) => this.isNumericRange(s, 0, 100))) {
          return headers[i];
        }
      }
    }
    return null;
  }

  private looksLikeDate(value: string): boolean {
    if (!value) return false;
    const patterns = [
      /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/,
      /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/,
      /^\d{4}[-/]\d{1,2}[-/]\d{1,2}[ T]\d{1,2}:\d{2}(:\d{2})?$/,
      /^\d{10,13}$/,
      /^\d{5,6}(\.\d+)?$/,
    ];
    return patterns.some((p) => p.test(value.trim()));
  }

  private isConfidenceValue(value: string): boolean {
    if (!value) return false;
    const n = this.parseNumber(value);
    return n !== null && ((n >= 0 && n <= 1) || (n > 1 && n <= 100));
  }

  private isNumericRange(value: string, min: number, max: number): boolean {
    if (!value) return false;
    const n = this.parseNumber(value);
    return n !== null && n >= min && n <= max;
  }

  parseNumber(value: string): number | null {
    if (!value || value.trim() === '') return null;
    const normalized = value.trim().replace(/,/g, '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  parseDate(value: string): string | null {
    if (!value) return null;
    const v = value.trim();
    const iso = new Date(v);
    if (!Number.isNaN(iso.getTime())) {
      return iso.toISOString();
    }
    const parts = v.split(/[-/]/);
    if (parts.length === 3) {
      const [a, b, c] = parts.map((p) => Number(p));
      if (a > 31) {
        return new Date(a, b - 1, c).toISOString();
      }
      if (c > 31) {
        return new Date(c, b - 1, a).toISOString();
      }
    }
    const excel = Number(v);
    if (!Number.isNaN(excel) && excel > 30000 && excel < 50000) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const ms = excel * 24 * 60 * 60 * 1000;
      return new Date(epoch.getTime() + ms).toISOString();
    }
    return null;
  }

  parseConfidence(value: string): number | null {
    const n = this.parseNumber(value);
    if (n === null) return null;
    if (n > 1 && n <= 100) return n;
    if (n >= 0 && n <= 1) return Math.round(n * 100);
    return null;
  }

  parseCorrected(value: string): boolean {
    const v = value.toLowerCase().trim();
    return v === 'true' || v === '1' || v === 'yes' || v === 'y' || v === '是' || v === 'corrected';
  }

  parseResult(value: string): 'PASS' | 'FAIL' | null {
    const v = value.toLowerCase().trim();
    return RESULT_TEXT_MAP[v] ?? null;
  }

  normalizeFailureCode(value: string): string | null {
    const v = value.trim().toUpperCase();
    if (FAILURE_CODES.some((f) => f.key === v)) return v;
    const match = value.trim().match(/^F(\d{2})$/i);
    if (match) {
      const code = `F${match[1].padStart(2, '0')}`;
      if (FAILURE_CODES.some((f) => f.key === code)) return code;
    }
    return null;
  }

  applyMappings(
    headers: string[],
    rows: string[][],
    mappings: ColumnMapping[],
  ): Record<string, string | undefined>[] {
    return rows.map((row) => {
      const record: Record<string, string | undefined> = {};
      for (const mapping of mappings) {
        if (!mapping.sourceColumn) continue;
        const index = headers.indexOf(mapping.sourceColumn);
        record[mapping.field] = index >= 0 ? row[index] : undefined;
      }
      return record;
    });
  }

  loadStoredMapping(signature: string): ColumnMapping[] | null {
    try {
      const stored = localStorage.getItem(`import-mapping-${signature}`);
      return stored ? (JSON.parse(stored) as ColumnMapping[]) : null;
    } catch {
      return null;
    }
  }

  storeMapping(signature: string, mappings: ColumnMapping[]): void {
    try {
      localStorage.setItem(`import-mapping-${signature}`, JSON.stringify(mappings));
    } catch {
    }
  }

  createSignature(headers: string[]): string {
    return headers
      .map((h) => this.normalizeHeader(h))
      .sort()
      .join('|');
  }
}
