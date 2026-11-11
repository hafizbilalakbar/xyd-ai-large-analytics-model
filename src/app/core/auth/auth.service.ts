import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AUTH_CONFIG } from './auth.config';
import { AccessStoreService, AccessUser } from '../permissions/access-store.service';
import { AuditLogService } from '../logging/audit-log.service';

export interface AuthenticatedUser {
  /** Display name (used in the header and operation logs). */
  readonly name: string;
  readonly username: string;
  /** Role label shown in the header. */
  readonly role: string;
  readonly roleIds: readonly number[];
  readonly isSuperAdmin: boolean;
}

interface StoredSession {
  readonly username: string;
  readonly roleIds: readonly number[];
  readonly isSuperAdmin: boolean;
  readonly expiresAt: number;
}

export type SignInResult = { ok: true } | { ok: false; error: string };

const SESSION_CHECK_INTERVAL_MS = 30_000;

/**
 * Local login/session service.
 *
 * Credentials live in `AUTH_CONFIG` (core/auth/auth.config.ts): the built-in
 * administrator plus any users created on the "Access Management" page (stored
 * in localStorage by `AccessStoreService`). Replace the checks inside
 * `signIn` with a real backend call to wire up production authentication.
 */
@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly accessStore = inject(AccessStoreService);
  private readonly auditLog = inject(AuditLogService);
  private readonly router = inject(Router);

  private readonly userState = signal<AuthenticatedUser | null>(null);
  private sessionExpiresAt: number | null = null;
  private expiryTimer: number | null = null;

  readonly user = this.userState.asReadonly();

  constructor() {
    this.restoreSession();
    if (typeof window !== 'undefined') {
      this.expiryTimer = window.setInterval(() => {
        this.ensureSessionValid();
      }, SESSION_CHECK_INTERVAL_MS);
    }
  }

  ngOnDestroy(): void {
    if (this.expiryTimer !== null) {
      window.clearInterval(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  isAuthenticated(): boolean {
    this.ensureSessionValid();
    return this.userState() !== null;
  }

  signIn(username: string, password: string, remember: boolean): SignInResult {
    const trimmedUsername = username.trim();
    if (trimmedUsername === '') {
      return { ok: false, error: 'Please enter your account name.' };
    }
    if (password === '') {
      return { ok: false, error: 'Please enter your password.' };
    }

    let user: AccessUser | null = null;
    let isSuperAdmin = false;

    if (
      trimmedUsername.toLowerCase() === AUTH_CONFIG.adminUsername.toLowerCase() &&
      password === AUTH_CONFIG.adminPassword
    ) {
      isSuperAdmin = true;
    } else {
      const result = this.accessStore.validateLogin(trimmedUsername, password);
      if (!result.ok) {
        return { ok: false, error: result.error ?? 'Incorrect account or password.' };
      }
      user = result.value ?? null;
      if (!user) {
        return { ok: false, error: 'Incorrect account or password.' };
      }
    }

    const authenticated: AuthenticatedUser = isSuperAdmin
      ? {
          name: AUTH_CONFIG.adminDisplayName,
          username: AUTH_CONFIG.adminUsername,
          role: AUTH_CONFIG.adminRoleLabel,
          roleIds: [],
          isSuperAdmin: true,
        }
      : {
          name: user!.username,
          username: user!.username,
          role: this.resolveRoleLabel(user!.roleIds),
          roleIds: [...user!.roleIds],
          isSuperAdmin: false,
        };

    this.startSession(authenticated, remember);
    this.auditLog.logOperate('auth.login', authenticated.username);
    return { ok: true };
  }

  signOut(logOperation = true): void {
    const username = this.userState()?.username ?? null;
    this.userState.set(null);
    this.sessionExpiresAt = null;
    this.clearStoredSession();
    this.auditLog.setUser(null);
    if (logOperation && username !== null) {
      this.auditLog.logOperate('auth.logout', username);
    }
  }

  /** Drops the session when it expired; called by guards and a timer. */
  ensureSessionValid(): void {
    const expiresAt = this.sessionExpiresAt;
    if (expiresAt === null) {
      return;
    }
    if (Date.now() >= expiresAt) {
      this.signOut(false);
      void this.router.navigate(['/login'], {
        queryParams: { reason: 'expired' },
      });
      return;
    }
    // Re-validate the underlying account (e.g. it was disabled meanwhile).
    const user = this.userState();
    if (user && !user.isSuperAdmin) {
      const stored = this.accessStore
        .users()
        .find((candidate) => candidate.username.toLowerCase() === user.username.toLowerCase());
      if (!stored || !stored.enabled) {
        this.signOut(false);
        void this.router.navigate(['/login'], { queryParams: { reason: 'disabled' } });
      }
    }
  }

  /** Account name remembered from a previous "remember me" login. */
  rememberedUsername(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      return localStorage.getItem(AUTH_CONFIG.rememberedUsernameKey);
    } catch {
      return null;
    }
  }

  private startSession(user: AuthenticatedUser, remember: boolean): void {
    this.userState.set(user);
    this.auditLog.setUser(user.username);
    this.sessionExpiresAt =
      Date.now() + AUTH_CONFIG.sessionDurationHours * 60 * 60 * 1000;
    this.persistSession(user, remember);
  }

  private persistSession(user: AuthenticatedUser, remember: boolean): void {
    if (typeof window === 'undefined') {
      return;
    }
    const session: StoredSession = {
      username: user.username,
      roleIds: user.roleIds,
      isSuperAdmin: user.isSuperAdmin,
      expiresAt: this.sessionExpiresAt ?? Date.now(),
    };
    try {
      this.clearStoredSession();
      if (remember) {
        localStorage.setItem(AUTH_CONFIG.sessionStorageKey, JSON.stringify(session));
        localStorage.setItem(AUTH_CONFIG.rememberedUsernameKey, user.username);
      } else {
        sessionStorage.setItem(AUTH_CONFIG.sessionStorageKey, JSON.stringify(session));
        localStorage.removeItem(AUTH_CONFIG.rememberedUsernameKey);
      }
    } catch {
      return;
    }
  }

  private restoreSession(): void {
    if (typeof window === 'undefined') {
      return;
    }
    let session: StoredSession | null = null;
    try {
      const fromSession = sessionStorage.getItem(AUTH_CONFIG.sessionStorageKey);
      const fromLocal = localStorage.getItem(AUTH_CONFIG.sessionStorageKey);
      session = parseSession(fromSession) ?? parseSession(fromLocal);
    } catch {
      session = null;
    }
    if (!session) {
      return;
    }
    if (Date.now() >= session.expiresAt) {
      this.clearStoredSession();
      return;
    }

    if (session.isSuperAdmin) {
      this.userState.set({
        name: AUTH_CONFIG.adminDisplayName,
        username: AUTH_CONFIG.adminUsername,
        role: AUTH_CONFIG.adminRoleLabel,
        roleIds: [],
        isSuperAdmin: true,
      });
    } else {
      const stored = this.accessStore
        .users()
        .find(
          (candidate) =>
            candidate.username.toLowerCase() === session!.username.toLowerCase(),
        );
      if (!stored || !stored.enabled) {
        this.clearStoredSession();
        return;
      }
      this.userState.set({
        name: stored.username,
        username: stored.username,
        role: this.resolveRoleLabel(stored.roleIds),
        roleIds: [...stored.roleIds],
        isSuperAdmin: false,
      });
    }
    this.sessionExpiresAt = session.expiresAt;
    this.auditLog.setUser(session.username);
  }

  private clearStoredSession(): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      sessionStorage.removeItem(AUTH_CONFIG.sessionStorageKey);
      localStorage.removeItem(AUTH_CONFIG.sessionStorageKey);
    } catch {
      return;
    }
  }

  private resolveRoleLabel(roleIds: readonly number[]): string {
    const names = roleIds
      .map((id) => this.accessStore.roleById(id)?.name)
      .filter((name): name is string => name !== undefined);
    return names.length > 0 ? names.join(', ') : 'No role assigned';
  }
}

function parseSession(raw: string | null): StoredSession | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (
      typeof parsed?.username !== 'string' ||
      typeof parsed?.isSuperAdmin !== 'boolean' ||
      !Array.isArray(parsed?.roleIds) ||
      typeof parsed?.expiresAt !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
