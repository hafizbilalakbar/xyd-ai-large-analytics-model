export interface AuthConfig {
  /** Built-in administrator account. Always valid and always has full access. */
  readonly adminUsername: string;
  readonly adminPassword: string;
  readonly adminDisplayName: string;
  readonly adminRoleLabel: string;
  /** How long a login session stays valid. */
  readonly sessionDurationHours: number;
  /** Storage keys for the persisted session and the remembered account name. */
  readonly sessionStorageKey: string;
  readonly rememberedUsernameKey: string;
}

/**
 * Default credentials and session rules for the local login feature.
 *
 * Change the values here (or swap `AuthService` for a real backend call) to
 * adjust who may sign in. The account configured here is a super administrator:
 * it cannot be deleted or locked out through Access Management.
 */
export const AUTH_CONFIG: AuthConfig = {
  adminUsername: 'admin',
  adminPassword: 'admin12345',
  adminDisplayName: 'admin',
  adminRoleLabel: 'Administrator',
  sessionDurationHours: 24,
  sessionStorageKey: 'xyd_session_v1',
  rememberedUsernameKey: 'xyd_login_username_v1',
};
