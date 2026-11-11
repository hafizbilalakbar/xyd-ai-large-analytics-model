import { Injectable, signal } from '@angular/core';

export type AuditLogKind = 'interface' | 'operate';

export interface AuditLogEntry {
  readonly id: number;
  /** ISO timestamp of when the entry was recorded. */
  readonly time: string;
  readonly kind: AuditLogKind;
  /** Formatted entry content without timestamp and kind badge. */
  readonly message: string;
}

interface PersistedAuditLogEntry {
  readonly id: number;
  readonly time: string;
  readonly kind: AuditLogKind;
  readonly message: string;
}

const MAX_ENTRIES = 1000;
const STORAGE_KEY = 'xyd_audit_logs_v1';
const PERSIST_DEBOUNCE_MS = 300;

const CLICKABLE_SELECTOR = 'button, a, [role="button"], [role="switch"]';
const SUMMARY_MAX_LENGTH = 400;

let fetchPatched = false;

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

/**
 * Central audit log for the whole application.
 *
 * Records two kinds of entries, exactly like the log viewer on the
 * "Logs and Monitoring" page displays them:
 * - `operate`: user actions. Menu clicks and button clicks anywhere in the app
 *   are captured automatically through a document-level click listener, and
 *   feature services can record explicit `role.create` / `user.update` style
 *   actions through `logOperate`.
 * - `interface`: every API call. `window.fetch` (used by all existing
 *   services) is patched here, and the Angular HTTP interceptor covers calls
 *   made through `HttpClient`.
 *
 * Entries are persisted to localStorage (latest 1000 kept) so they survive a
 * page refresh.
 */
@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly entriesState = signal<readonly AuditLogEntry[]>([]);
  private nextId = 1;
  private currentUser: string | null = null;
  private persistTimer: number | null = null;

  /** Newest entry first, capped at the most recent 1000 entries. */
  readonly entries = this.entriesState.asReadonly();

  constructor() {
    this.restore();
    if (typeof document !== 'undefined') {
      document.addEventListener('click', this.handleDocumentClick, true);
    }
    if (typeof window !== 'undefined' && !fetchPatched) {
      fetchPatched = true;
      this.patchWindowFetch();
    }
  }

  /** Tracks the signed-in user so operate entries can be attributed. */
  setUser(username: string | null): void {
    this.currentUser = username;
  }

  logOperate(action: string, target: string, detail?: string): void {
    const user = this.currentUser ?? '-';
    const message =
      detail === undefined
        ? `${user}  ${action}  ${target}`
        : `${user}  ${action}  ${target}  ${detail}`;
    this.addEntry('operate', message);
  }

  logInterface(
    method: string,
    path: string,
    status: number,
    durationMs: number,
    summary: string,
  ): void {
    const duration = durationMs >= 10 ? durationMs.toFixed(0) : durationMs.toFixed(1);
    const summaryText = summary === '' ? '' : `  → ${summary}`;
    const message = `${method.toUpperCase()} ${path} ${status} ${duration}ms${summaryText}`;
    this.addEntry('interface', message);
  }

  formatTimestamp(isoTime: string): string {
    const date = new Date(isoTime);
    if (Number.isNaN(date.getTime())) {
      return isoTime;
    }
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  /** Builds the downloadable log file content, matching the original format. */
  buildExportFile(summaryLines: readonly string[]): string {
    const header = [
      '# XYD AI Large Model Locking Data Analysis and Learning Platform operation/interface logs',
      `# Exported at ${this.formatTimestamp(new Date().toISOString())}`,
      '# Current system status',
      ...summaryLines,
      '--------------------------------------------------------',
    ];
    const body = this.entries().map((entry) => {
      const label = entry.kind === 'interface' ? 'interface' : 'operate';
      return `${this.formatTimestamp(entry.time)}  [${label}]  ${entry.message}`;
    });
    return `${[...header, ...body].join('\n')}\n`;
  }

  private addEntry(kind: AuditLogKind, message: string): void {
    const entry: AuditLogEntry = {
      id: this.nextId++,
      time: new Date().toISOString(),
      kind,
      message,
    };
    this.entriesState.update((entries) => [entry, ...entries].slice(0, MAX_ENTRIES));
    this.schedulePersist();
  }

  private readonly handleDocumentClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const clickable = target.closest<HTMLElement>(CLICKABLE_SELECTOR);
    if (!clickable) {
      return;
    }
    const label = accessibleNameOf(clickable);
    if (label === '') {
      return;
    }
    this.logOperate('ui.click', label);
  };

  private patchWindowFetch(): void {
    const originalFetch = window.fetch.bind(window);
    const patchedFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const method =
        init?.method ?? (input instanceof Request ? input.method : 'GET');
      // Angular's HttpClient (FetchBackend) always sends an AbortSignal in
      // `init`; those calls are recorded by the HttpClient interceptor, so
      // skip them here to avoid duplicate entries.
      if (!url.includes('/api/') || init?.signal !== undefined) {
        return originalFetch(input, init);
      }
      const started = performance.now();
      try {
        const response = await originalFetch(input, init);
        const duration = performance.now() - started;
        void this.readResponseSummary(response).then((summary) => {
          this.logInterface(method, url, response.status, duration, summary);
        });
        return response;
      } catch (error) {
        this.logInterface(
          method,
          url,
          0,
          performance.now() - started,
          error instanceof Error ? error.message : 'network error',
        );
        throw error;
      }
    };
    window.fetch = patchedFetch as typeof window.fetch;
  }

  private async readResponseSummary(response: Response): Promise<string> {
    try {
      const contentType = response.headers?.get('content-type') ?? '';
      if (!contentType.includes('json')) {
        return '';
      }
      const text = await response.clone().text();
      return text.length > SUMMARY_MAX_LENGTH
        ? `${text.slice(0, SUMMARY_MAX_LENGTH)}…`
        : text;
    } catch {
      return '';
    }
  }

  private restore(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as PersistedAuditLogEntry[];
      if (!Array.isArray(parsed)) {
        return;
      }
      const entries = parsed
        .filter(
          (entry) =>
            typeof entry?.id === 'number' &&
            typeof entry?.time === 'string' &&
            (entry?.kind === 'interface' || entry?.kind === 'operate') &&
            typeof entry?.message === 'string',
        )
        .slice(0, MAX_ENTRIES);
      this.entriesState.set(entries);
      this.nextId = entries.reduce((max, entry) => Math.max(max, entry.id), 0) + 1;
    } catch {
      return;
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer !== null) {
      return;
    }
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = null;
      this.persist();
    }, PERSIST_DEBOUNCE_MS);
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries()));
    } catch {
      return;
    }
  }
}

function accessibleNameOf(element: HTMLElement): string {
  const label =
    element.getAttribute('aria-label')?.trim() ??
    element.title?.trim() ??
    element.textContent?.trim() ??
    '';
  const normalized = label.replace(/\s+/g, ' ');
  return normalized.slice(0, 60);
}
