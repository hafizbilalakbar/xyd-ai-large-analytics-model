import { Injectable } from '@angular/core';

export interface DetectedTextFormat {
  readonly encoding: string;
  readonly delimiter: string;
  readonly hasHeader: boolean;
  readonly headerRow: number;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface DetectedFileType {
  readonly kind: 'zip' | 'xlsx' | 'xls' | 'json' | 'text';
  readonly extension: string;
}

@Injectable({ providedIn: 'root' })
export class FormatDetectorService {
  detectType(file: File): DetectedFileType {
    const name = file.name.toLowerCase();
    const ext = name.slice(name.lastIndexOf('.'));

    if (ext === '.zip' || this.isZipSignature(file)) {
      return { kind: 'zip', extension: '.zip' };
    }
    if (ext === '.xlsx' || this.isXlsxSignature(file)) {
      return { kind: 'xlsx', extension: '.xlsx' };
    }
    if (ext === '.xls') {
      return { kind: 'xls', extension: '.xls' };
    }
    if (ext === '.json' || this.isJsonStart(file)) {
      return { kind: 'json', extension: '.json' };
    }
    return { kind: 'text', extension: ext };
  }

  private isZipSignature(file: File): boolean {
    const slice = file.slice(0, 4);
    const view = new DataView(slice as unknown as ArrayBufferLike);
    return view.getUint32(0, false) === 0x504B0304;
  }

  private isXlsxSignature(file: File): boolean {
    return this.isZipSignature(file);
  }

  private isJsonStart(_file: File): boolean {
    return false;
  }

  async decodeText(buffer: ArrayBuffer): Promise<{ text: string; encoding: string }> {
    const uint8 = new Uint8Array(buffer);
    const encoding = this.detectEncoding(uint8);
    const decoder = new TextDecoder(encoding, { fatal: false });
    let text = decoder.decode(uint8);
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }
    return { text, encoding };
  }

  private detectEncoding(uint8: Uint8Array): string {
    if (uint8.length >= 3 && uint8[0] === 0xEF && uint8[1] === 0xBB && uint8[2] === 0xBF) {
      return 'utf-8';
    }
    if (uint8.length >= 2 && uint8[0] === 0xFF && uint8[1] === 0xFE) {
      return 'utf-16le';
    }
    if (uint8.length >= 2 && uint8[0] === 0xFE && uint8[1] === 0xFF) {
      return 'utf-16be';
    }
    if (this.looksLikeUtf8(uint8)) {
      return 'utf-8';
    }
    return 'gbk';
  }

  private looksLikeUtf8(uint8: Uint8Array): boolean {
    let i = 0;
    while (i < uint8.length) {
      const b = uint8[i];
      if (b < 0x80) {
        i++;
        continue;
      }
      if (b >= 0xC2 && b <= 0xDF && i + 1 < uint8.length) {
        i += 2;
        continue;
      }
      if (b >= 0xE0 && b <= 0xEF && i + 2 < uint8.length) {
        i += 3;
        continue;
      }
      if (b >= 0xF0 && b <= 0xF4 && i + 3 < uint8.length) {
        i += 4;
        continue;
      }
      return false;
    }
    return true;
  }

  detectDelimiter(text: string): string {
    const lines = this.getNonEmptyLines(text.slice(0, 4096));
    if (lines.length === 0) return ',';
    const delimiters = [',', '\t', ';', '|'];
    let best = ',';
    let bestCount = 0;
    for (const d of delimiters) {
      const counts = lines.map((line) => this.countDelimiter(line, d));
      const min = Math.min(...counts);
      if (min > 0 && min > bestCount) {
        bestCount = min;
        best = d;
      }
    }
    return best;
  }

  private countDelimiter(line: string, delimiter: string): number {
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

  private getNonEmptyLines(text: string): string[] {
    return text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  }

  splitLine(line: string, delimiter: string): string[] {
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

  detectFormat(text: string): DetectedTextFormat {
    const delimiter = this.detectDelimiter(text);
    const allLines = text.split(/\r?\n/);
    const startIndex = this.findHeaderRow(allLines, delimiter);
    const headerLine = allLines[startIndex];
    const headers = this.splitLine(headerLine, delimiter);
    const rows = allLines
      .slice(startIndex + 1)
      .filter((line) => line.trim().length > 0)
      .map((line) => this.splitLine(line, delimiter));
    return {
      encoding: 'utf-8',
      delimiter,
      hasHeader: true,
      headerRow: startIndex,
      headers,
      rows,
    };
  }

  private findHeaderRow(lines: string[], delimiter: string): number {
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;
      if (line.startsWith('#') || line.startsWith('//')) continue;
      const parts = this.splitLine(line, delimiter);
      if (parts.length >= 2 && parts.some((p) => isNaN(Number(p)))) {
        return i;
      }
    }
    return 0;
  }

  parseJson(text: string): unknown[] {
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (trimmed[0] === '[') {
      const parsed = JSON.parse(trimmed) as unknown[];
      return Array.isArray(parsed) ? parsed : [];
    }
    if (trimmed[0] === '{') {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const key of ['data', 'rows', 'items', 'records']) {
        const value = parsed[key];
        if (Array.isArray(value)) return value;
      }
      return [];
    }
    return trimmed
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as unknown);
  }
}
