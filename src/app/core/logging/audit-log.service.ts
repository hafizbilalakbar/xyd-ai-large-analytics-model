import { Injectable, signal, computed } from '@angular/core';

export type AuditLogKind = 'interface' | 'operate';

export interface AuditLogEntry {
  readonly id: number;
  readonly time: string;
  readonly kind: AuditLogKind;
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
const DEDUP_WINDOW_MS = 1000;

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

export function formatTimestamp(isoTime: string): string {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) {
    return isoTime;
  }
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Central audit log for the whole application.
 *
 * Two kinds of entries:
 * - `operate`: user actions (login, logout, navigation, role/user actions,
 *   export, clear). Recorded through `logOperate` from feature services and
 *   the navigation logger.
 * - `interface`: API calls. Recorded by the HTTP audit interceptor.
 *
 * Entries are persisted to localStorage (latest 1000 kept) so they survive a
 * page refresh. If storage is blocked or full, writes fail silently and logs
 * continue working in memory.
 *
 * Dedup: the same action key repeated within 1 second is ignored, preventing
 * double-click or double-poll spam.
 */
@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly entriesState = signal<readonly AuditLogEntry[]>([]);
  private readonly filterTerm = signal('');
  private nextId = 1;
  private currentUser: string | null = null;
  private persistTimer: number | null = null;
  private lastLogKey = '';
  private lastLogTime = 0;

  /** Newest entry first, capped at the most recent 1000 entries. */
  readonly entries = this.entriesState.asReadonly();

  /** Entries matching the current filter, newest first. */
  readonly filteredEntries = computed(() => {
    const term = this.filterTerm().trim().toLowerCase();
    const all = this.entries();
    if (term === '') {
      return all;
    }
    return all.filter(
      (entry) =>
        entry.message.toLowerCase().includes(term) ||
        entry.kind.includes(term) ||
        formatTimestamp(entry.time).toLowerCase().includes(term),
    );
  });

  constructor() {
    this.restore();
  }

  /** Tracks the signed-in user so operate entries can be attributed. */
  setUser(username: string | null): void {
    this.currentUser = username;
  }

  /** Sets the live filter term. */
  setFilter(term: string): void {
    this.filterTerm.set(term);
  }

  /** Clears the live filter. */
  clearFilter(): void {
    this.filterTerm.set('');
  }

  /**
   * Records an `operate` entry.
   * @param action - action key from LOG_ACTIONS (e.g. 'role.create')
   * @param target - the target name (e.g. role name or username)
   * @param detail - optional extra detail
   */
  logOperate(action: string, target: string, detail?: string): void {
    const user = this.currentUser ?? '-';
    const message =
      detail === undefined
        ? `${user}  ${action}  ${target}`
        : `${user}  ${action}  ${target}  ${detail}`;
    this.addEntryDedup('operate', message, `${action}:${target}`);
  }

  /**
   * Records a successful `interface` entry (HTTP call).
   * No response body is ever logged.
   */
  logInterface(method: string, path: string, status: number, durationMs: number): void {
    const duration = durationMs >= 10 ? Math.round(durationMs) : durationMs.toFixed(1);
    const message = `${method.toUpperCase()} ${path} ${status} ${duration}ms`;
    this.addEntryDedup('interface', message, `${method}:${path}`);
  }

  /**
   * Records a failed `interface` entry (HTTP error or network failure).
   */
  logInterfaceFailed(method: string, path: string, durationMs: number, error: string): void {
    const duration = durationMs >= 10 ? Math.round(durationMs) : durationMs.toFixed(1);
    const message = `${method.toUpperCase()} ${path} ${duration}ms ${error}`;
    this.addEntry('interface', message);
  }

  /** Removes all stored logs and persists the empty state. */
  clear(): void {
    this.entriesState.set([]);
    this.nextId = 1;
    this.lastLogKey = '';
    this.lastLogTime = 0;
    this.schedulePersist();
  }

  /** Builds export file content for the given entries. */
  exportContent(filtered: readonly AuditLogEntry[]): string {
    const header = [
      '# XYD AI Large Model Locking Data Analysis and Learning Platform operation/interface logs',
      `# Exported at ${formatTimestamp(new Date().toISOString())}`,
      '--------------------------------------------------------',
    ];
    const body = filtered.map((entry) => {
      const label = entry.kind === 'interface' ? 'interface' : 'operate';
      return `${formatTimestamp(entry.time)}  [${label}]  ${entry.message}`;
    });
    return `${[...header, ...body].join('\n')}\n`;
  }

  private addEntryDedup(kind: AuditLogKind, message: string, dedupKey: string): void {
    const now = Date.now();
    if (dedupKey === this.lastLogKey && now - this.lastLogTime < DEDUP_WINDOW_MS) {
      return;
    }
    this.lastLogKey = dedupKey;
    this.lastLogTime = now;
    this.addEntry(kind, message);
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
