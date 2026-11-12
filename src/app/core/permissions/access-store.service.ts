import { computed, Injectable, signal } from '@angular/core';
import { AUTH_CONFIG } from '../auth/auth.config';
import { AuditLogService } from '../logging/audit-log.service';

export interface AccessRole {
  readonly id: number;
  readonly name: string;
  readonly description: string;
}

export interface AccessUser {
  readonly id: number;
  readonly username: string;
  readonly password: string;
  readonly enabled: boolean;
  readonly isSuperAdmin: boolean;
  readonly roleIds: readonly number[];
}

interface AccessState {
  nextRoleId: number;
  nextUserId: number;
  roles: readonly AccessRole[];
  users: readonly AccessUser[];
  rolePermissions: Readonly<Record<string, readonly string[]>>;
}

export interface AccessResult<T = undefined> {
  readonly ok: boolean;
  readonly error?: string;
  readonly value?: T;
}

export interface CsvImportRowError {
  readonly row: number;
  readonly message: string;
}

export interface CsvImportResult {
  readonly addedCount: number;
  readonly errors: readonly CsvImportRowError[];
}

const STORAGE_KEY = 'xyd_access_v1';

const CSV_TEMPLATE = 'username,password\nzhangsan,Init@1234\nlisi,Init@1234\n';

export const ROLE_NAME_MIN_LENGTH = 2;
export const ROLE_NAME_MAX_LENGTH = 40;
export const ROLE_DESCRIPTION_MAX_LENGTH = 150;

/** Letters, numbers, spaces, hyphen and underscore are the only allowed name characters. */
const ROLE_NAME_ALLOWED = /^[A-Za-z0-9 _-]+$/;

function ok<T>(value?: T): AccessResult<T> {
  return { ok: true, value };
}

function fail<T>(error: string): AccessResult<T> {
  return { ok: false, error };
}

function isBlank(value: string | undefined | null): boolean {
  return value === undefined || value === null || value.trim() === '';
}

/** Trims a role name and collapses runs of whitespace into single spaces. */
export function normalizeRoleName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Removes script blocks and HTML tags from free text. */
export function stripHtmlTags(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]*>/g, '');
}

/**
 * Shared role name validation. `takenNames` holds the names that are already
 * used; the comparison ignores case, surrounding spaces and repeated inner
 * spaces, so "Quality Engineer", "quality engineer" and " Quality  Engineer "
 * are all the same name.
 */
export function validateRoleNameValue(
  rawName: string,
  takenNames: readonly string[],
): string | null {
  const name = normalizeRoleName(rawName);
  if (name.length === 0) {
    return 'Role name is required.';
  }
  if (name.length < ROLE_NAME_MIN_LENGTH) {
    return `Role name must be at least ${ROLE_NAME_MIN_LENGTH} characters.`;
  }
  if (name.length > ROLE_NAME_MAX_LENGTH) {
    return `Role name must be at most ${ROLE_NAME_MAX_LENGTH} characters.`;
  }
  if (!ROLE_NAME_ALLOWED.test(name)) {
    return 'Role name may only contain letters, numbers, spaces, hyphens and underscores.';
  }
  const clash = takenNames.some(
    (taken) => normalizeRoleName(taken).toLowerCase() === name.toLowerCase(),
  );
  if (clash) {
    return `A role named "${name}" already exists.`;
  }
  return null;
}

/** Shared role description validation (the description itself is optional). */
export function validateRoleDescriptionValue(rawDescription: string): string | null {
  if (rawDescription.length > ROLE_DESCRIPTION_MAX_LENGTH) {
    return `Description must be at most ${ROLE_DESCRIPTION_MAX_LENGTH} characters.`;
  }
  return null;
}

/**
 * Local persistence for roles, users and role permissions used by the
 * "Access Management" page. Data is stored in localStorage so a real backend
 * can replace this service later without touching any component.
 *
 * The built-in administrator from `AUTH_CONFIG` is always present, can never
 * be deleted or disabled, and always keeps full access.
 */
@Injectable({ providedIn: 'root' })
export class AccessStoreService {
  private readonly stateSignal = signal<AccessState>(this.loadInitialState());

  readonly roles = computed(() => this.stateSignal().roles);
  readonly users = computed(() => this.stateSignal().users);

  /** Role id -> granted permission ids, kept in sync with the stored state. */
  readonly rolePermissionsMap = computed<ReadonlyMap<number, readonly string[]>>(() => {
    const state = this.stateSignal();
    const map = new Map<number, readonly string[]>();
    for (const role of state.roles) {
      const permissions = state.rolePermissions[String(role.id)];
      map.set(role.id, Array.isArray(permissions) ? permissions : []);
    }
    return map;
  });

  constructor(private readonly auditLog: AuditLogService) {}

  roleById(id: number): AccessRole | null {
    return this.roles().find((role) => role.id === id) ?? null;
  }

  userById(id: number): AccessUser | null {
    return this.users().find((user) => user.id === id) ?? null;
  }

  usersInRole(roleId: number): readonly AccessUser[] {
    return this.users().filter((user) => user.roleIds.includes(roleId));
  }

  userCountForRole(roleId: number): number {
    return this.usersInRole(roleId).length;
  }

  roleNamesForUser(user: AccessUser): readonly string[] {
    return user.roleIds
      .map((id) => this.roleById(id)?.name)
      .filter((name): name is string => name !== undefined);
  }

  permissionIdsForRole(roleId: number): readonly string[] {
    return this.rolePermissionsMap().get(roleId) ?? [];
  }

  /** Validates credentials of non built-in accounts. */
  validateLogin(username: string, password: string): AccessResult<AccessUser> {
    const normalized = username.trim().toLowerCase();
    const user = this.users().find((candidate) => candidate.username.toLowerCase() === normalized);
    if (!user || user.password !== password) {
      return fail('Incorrect account or password.');
    }
    if (!user.enabled) {
      return fail('This account has been disabled by an administrator.');
    }
    return ok(user);
  }

  createRole(name: string, description: string): AccessResult<AccessRole> {
    const trimmedName = normalizeRoleName(name);
    const nameError = this.validateRoleName(trimmedName);
    if (nameError) {
      return fail(nameError);
    }
    const rawDescription = description.trim();
    const descriptionError = validateRoleDescriptionValue(rawDescription);
    if (descriptionError) {
      return fail(descriptionError);
    }
    const cleanDescription = stripHtmlTags(rawDescription).trim();
    const state = this.stateSignal();
    const role: AccessRole = {
      id: state.nextRoleId,
      name: trimmedName,
      description: cleanDescription,
    };
    this.stateSignal.set({
      ...state,
      nextRoleId: state.nextRoleId + 1,
      roles: [...state.roles, role],
    });
    this.persist();
    this.auditLog.logOperate('role.create', trimmedName);
    return ok(role);
  }

  updateRole(id: number, name: string, description: string): AccessResult<AccessRole> {
    const state = this.stateSignal();
    const role = state.roles.find((candidate) => candidate.id === id);
    if (!role) {
      return fail('This role no longer exists.');
    }
    const trimmedName = normalizeRoleName(name);
    const nameError = this.validateRoleName(trimmedName, id);
    if (nameError) {
      return fail(nameError);
    }
    const updated: AccessRole = { ...role, name: trimmedName, description: description.trim() };
    this.stateSignal.set({
      ...state,
      roles: state.roles.map((candidate) => (candidate.id === id ? updated : candidate)),
    });
    this.persist();
    this.auditLog.logOperate('role.update', trimmedName);
    return ok(updated);
  }

  deleteRole(id: number): AccessResult {
    const state = this.stateSignal();
    const role = state.roles.find((candidate) => candidate.id === id);
    if (!role) {
      return fail('This role no longer exists.');
    }
    const rolePermissions = { ...state.rolePermissions };
    delete rolePermissions[String(id)];
    this.stateSignal.set({
      ...state,
      roles: state.roles.filter((candidate) => candidate.id !== id),
      users: state.users.map((user) => ({
        ...user,
        roleIds: user.roleIds.filter((roleId) => roleId !== id),
      })),
      rolePermissions,
    });
    this.persist();
    this.auditLog.logOperate('role.delete', role.name);
    return ok();
  }

  setRolePermissions(roleId: number, permissionIds: readonly string[]): AccessResult {
    const state = this.stateSignal();
    const role = state.roles.find((candidate) => candidate.id === roleId);
    if (!role) {
      return fail('This role no longer exists.');
    }
    const unique = Array.from(new Set(permissionIds));
    this.stateSignal.set({
      ...state,
      rolePermissions: { ...state.rolePermissions, [String(roleId)]: unique },
    });
    this.persist();
    this.auditLog.logOperate(
      'role.permissions',
      role.name,
      `${unique.length} permissions selected`,
    );
    return ok();
  }

  /**
   * Removes the given users from a role. The accounts themselves are kept;
   * they only lose the permissions granted by this role.
   */
  removeUsersFromRole(roleId: number, userIds: readonly number[]): AccessResult<number> {
    const state = this.stateSignal();
    const role = state.roles.find((candidate) => candidate.id === roleId);
    if (!role) {
      return fail('This role no longer exists.');
    }
    const idSet = new Set(userIds);
    let changed = 0;
    const users = state.users.map((user) => {
      if (!idSet.has(user.id) || !user.roleIds.includes(roleId)) {
        return user;
      }
      changed++;
      return { ...user, roleIds: user.roleIds.filter((id) => id !== roleId) };
    });
    if (changed > 0) {
      this.stateSignal.set({ ...state, users });
      this.persist();
      this.auditLog.logOperate('role.members.remove', role.name, `${changed} users removed`);
    }
    return ok(changed);
  }

  createUser(
    username: string,
    password: string,
    roleIds: readonly number[],
  ): AccessResult<AccessUser> {
    const trimmedUsername = username.trim();
    const usernameError = this.validateUsername(trimmedUsername);
    if (usernameError) {
      return fail(usernameError);
    }
    const passwordError = this.validatePassword(password);
    if (passwordError) {
      return fail(passwordError);
    }
    const state = this.stateSignal();
    const user: AccessUser = {
      id: state.nextUserId,
      username: trimmedUsername,
      password,
      enabled: true,
      isSuperAdmin: false,
      roleIds: [...roleIds],
    };
    this.stateSignal.set({
      ...state,
      nextUserId: state.nextUserId + 1,
      users: [...state.users, user],
    });
    this.persist();
    this.auditLog.logOperate('user.create', trimmedUsername);
    return ok(user);
  }

  updateUser(
    id: number,
    changes: { username: string; password: string | null; roleIds: readonly number[] },
  ): AccessResult<AccessUser> {
    const state = this.stateSignal();
    const user = state.users.find((candidate) => candidate.id === id);
    if (!user) {
      return fail('This user no longer exists.');
    }
    const trimmedUsername = changes.username.trim();
    if (user.isSuperAdmin && trimmedUsername.toLowerCase() !== user.username.toLowerCase()) {
      return fail('The built-in administrator account cannot be renamed.');
    }
    const usernameError = this.validateUsername(trimmedUsername, id);
    if (usernameError) {
      return fail(usernameError);
    }
    if (changes.password !== null && changes.password !== '') {
      const passwordError = this.validatePassword(changes.password);
      if (passwordError) {
        return fail(passwordError);
      }
    }
    const updated: AccessUser = {
      ...user,
      username: trimmedUsername,
      password: changes.password ? changes.password : user.password,
      roleIds: user.isSuperAdmin ? user.roleIds : [...changes.roleIds],
    };
    this.stateSignal.set({
      ...state,
      users: state.users.map((candidate) => (candidate.id === id ? updated : candidate)),
    });
    this.persist();
    this.auditLog.logOperate('user.update', trimmedUsername);
    return ok(updated);
  }

  setUserEnabled(id: number, enabled: boolean): AccessResult {
    const state = this.stateSignal();
    const user = state.users.find((candidate) => candidate.id === id);
    if (!user) {
      return fail('This user no longer exists.');
    }
    if (user.isSuperAdmin && !enabled) {
      return fail('The built-in administrator cannot be disabled.');
    }
    this.stateSignal.set({
      ...state,
      users: state.users.map((candidate) =>
        candidate.id === id ? { ...candidate, enabled } : candidate,
      ),
    });
    this.persist();
    this.auditLog.logOperate(enabled ? 'user.enable' : 'user.disable', user.username);
    return ok();
  }

  deleteUser(id: number): AccessResult {
    const state = this.stateSignal();
    const user = state.users.find((candidate) => candidate.id === id);
    if (!user) {
      return fail('This user no longer exists.');
    }
    if (user.isSuperAdmin) {
      return fail('The built-in administrator cannot be deleted.');
    }
    this.stateSignal.set({
      ...state,
      users: state.users.filter((candidate) => candidate.id !== id),
    });
    this.persist();
    this.auditLog.logOperate('user.delete', user.username);
    return ok();
  }

  csvTemplate(): string {
    return CSV_TEMPLATE;
  }

  importUsersCsv(
    content: string,
    assignRoleIds: readonly number[],
  ): CsvImportResult {
    const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
    const errors: CsvImportRowError[] = [];
    const pending: { username: string; password: string }[] = [];
    const takenUsernames = new Set(
      this.users().map((user) => user.username.toLowerCase()),
    );
    takenUsernames.add(AUTH_CONFIG.adminUsername.toLowerCase());

    let rowNumber = 0;
    for (const line of lines) {
      rowNumber++;
      const trimmed = line.trim();
      if (trimmed === '') {
        continue;
      }
      const cells = trimmed.split(',').map((cell) => cell.trim());
      if (
        rowNumber === 1 &&
        cells.length === 2 &&
        cells[0].toLowerCase() === 'username' &&
        cells[1].toLowerCase() === 'password'
      ) {
        continue;
      }
      if (cells.length !== 2) {
        errors.push({
          row: rowNumber,
          message: 'Expected exactly 2 columns: username,password.',
        });
        continue;
      }
      const [username, password] = cells;
      const usernameError = this.validateUsername(username, undefined, takenUsernames);
      const passwordError = this.validatePassword(password);
      if (usernameError) {
        errors.push({ row: rowNumber, message: usernameError });
        continue;
      }
      if (passwordError) {
        errors.push({ row: rowNumber, message: passwordError });
        continue;
      }
      takenUsernames.add(username.toLowerCase());
      pending.push({ username, password });
    }

    if (pending.length > 0) {
      const state = this.stateSignal();
      const users = [...state.users];
      let nextUserId = state.nextUserId;
      for (const entry of pending) {
        users.push({
          id: nextUserId++,
          username: entry.username,
          password: entry.password,
          enabled: true,
          isSuperAdmin: false,
          roleIds: [...assignRoleIds],
        });
      }
      this.stateSignal.set({ ...state, nextUserId, users });
      this.persist();
    }

    this.auditLog.logOperate(
      'user.import',
      'CSV import',
      `${pending.length} users added, ${errors.length} rows failed`,
    );
    return { addedCount: pending.length, errors };
  }

  private validateRoleName(name: string, excludeRoleId?: number): string | null {
    const takenNames = this.roles()
      .filter((role) => role.id !== excludeRoleId)
      .map((role) => role.name);
    return validateRoleNameValue(name, takenNames);
  }

  private validateUsername(
    username: string,
    excludeUserId?: number,
    extraUsernames?: ReadonlySet<string>,
  ): string | null {
    if (isBlank(username)) {
      return 'Username is required.';
    }
    if (username.length < 2 || username.length > 32) {
      return 'Username must be between 2 and 32 characters.';
    }
    if (username.toLowerCase() === AUTH_CONFIG.adminUsername.toLowerCase()) {
      return 'This username is reserved for the built-in administrator.';
    }
    const clash = this.users().find(
      (user) =>
        user.id !== excludeUserId &&
        user.username.toLowerCase() === username.toLowerCase(),
    );
    if (clash || extraUsernames?.has(username.toLowerCase())) {
      return `The username "${username}" already exists.`;
    }
    return null;
  }

  private validatePassword(password: string): string | null {
    if (isBlank(password)) {
      return 'Password is required.';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return 'Password must contain both letters and numbers.';
    }
    return null;
  }

  private loadInitialState(): AccessState {
    let state: AccessState | null = null;
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = this.sanitizeState(JSON.parse(raw));
          if (parsed) {
            state = parsed;
          }
        }
      } catch {
        state = null;
      }
    }
    return this.ensureAdmin(state ?? this.defaultState());
  }

  private defaultState(): AccessState {
    return {
      nextRoleId: 1,
      nextUserId: 2,
      roles: [],
      users: [
        {
          id: 1,
          username: AUTH_CONFIG.adminUsername,
          password: AUTH_CONFIG.adminPassword,
          enabled: true,
          isSuperAdmin: true,
          roleIds: [],
        },
      ],
      rolePermissions: {},
    };
  }

  private sanitizeState(value: unknown): AccessState | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const raw = value as Partial<AccessState>;
    if (!Array.isArray(raw.users) || !Array.isArray(raw.roles)) {
      return null;
    }
    return {
      nextRoleId: typeof raw.nextRoleId === 'number' ? raw.nextRoleId : 1,
      nextUserId: typeof raw.nextUserId === 'number' ? raw.nextUserId : 2,
      roles: raw.roles.filter(
        (role): role is AccessRole =>
          typeof role?.id === 'number' &&
          typeof role?.name === 'string' &&
          typeof role?.description === 'string',
      ),
      users: raw.users.filter(
        (user): user is AccessUser =>
          typeof user?.id === 'number' &&
          typeof user?.username === 'string' &&
          typeof user?.password === 'string' &&
          typeof user?.enabled === 'boolean' &&
          typeof user?.isSuperAdmin === 'boolean' &&
          Array.isArray(user?.roleIds),
      ),
      rolePermissions:
        typeof raw.rolePermissions === 'object' && raw.rolePermissions !== null
          ? raw.rolePermissions
          : {},
    };
  }

  private ensureAdmin(state: AccessState): AccessState {
    const admin = state.users.find((user) => user.isSuperAdmin);
    if (admin && admin.enabled && admin.username === AUTH_CONFIG.adminUsername) {
      return state;
    }
    const users = state.users.filter(
      (user) => user.username.toLowerCase() !== AUTH_CONFIG.adminUsername.toLowerCase(),
    );
    return {
      ...state,
      nextUserId: Math.max(state.nextUserId, 2),
      users: [
        {
          id: 1,
          username: AUTH_CONFIG.adminUsername,
          password: AUTH_CONFIG.adminPassword,
          enabled: true,
          isSuperAdmin: true,
          roleIds: [],
        },
        ...users,
      ],
    };
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stateSignal()));
    } catch {
      return;
    }
  }
}
