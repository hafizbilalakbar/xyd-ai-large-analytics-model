import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ToastContainerComponent } from '../../../../shared/components/toast-container/toast-container.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ToastService } from '../../../../shared/services/toast.service';
import { AuditLogService } from '../../../../core/logging/audit-log.service';
import {
  AccessStoreService,
  type AccessUser,
  type CsvImportResult,
} from '../../../../core/permissions/access-store.service';
import {
  PERMISSION_GROUPS,
  type PermissionGroup,
} from '../../../../core/permissions/permission-catalog';

const CSV_TEMPLATE_FILE_NAME = 'user-import-template.csv';

// Build a map from permission id to human-readable label.
const PERMISSION_LABELS = new Map<string, string>();
for (const group of PERMISSION_GROUPS) {
  for (const item of group.items) {
    PERMISSION_LABELS.set(item.id, item.label);
  }
}

function permissionNames(ids: readonly string[]): string[] {
  return [...ids].map((id) => PERMISSION_LABELS.get(id) ?? id);
}

@Component({
  selector: 'app-permission-management',
  imports: [
    FormsModule,
    ModalComponent,
    ConfirmDialogComponent,
    PageHeaderComponent,
    ToastContainerComponent,
    IconComponent,
  ],
  templateUrl: './permission-management.component.html',
  styleUrl: './permission-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionManagementComponent {
  private readonly store = inject(AccessStoreService);
  private readonly toastService = inject(ToastService);
  private readonly auditLog = inject(AuditLogService);

  protected readonly groups = PERMISSION_GROUPS;

  protected readonly roles = this.store.roles;
  protected readonly selectedRoleId = signal<number | null>(null);

  protected readonly selectedRole = computed(() => {
    const id = this.selectedRoleId();
    return id === null ? null : this.store.roleById(id);
  });

  protected readonly members = computed(() => {
    const id = this.selectedRoleId();
    return id === null ? [] : this.store.usersInRole(id);
  });

  /** Role search box filter (view only, the store keeps every role). */
  protected readonly roleSearch = signal('');

  protected readonly visibleRoles = computed(() => {
    const query = this.roleSearch().trim().toLowerCase();
    const roles = this.roles();
    if (!query) {
      return roles;
    }
    return roles.filter(
      (role) =>
        role.name.toLowerCase().includes(query) ||
        role.description.toLowerCase().includes(query),
    );
  });

  protected readonly draftRoleName = signal('');
  protected readonly roleNameError = signal('');
  protected readonly draftPermissionIds = signal<ReadonlySet<string>>(new Set());

  protected readonly savedPermissionIds = computed<ReadonlySet<string>>(() => {
    const id = this.selectedRoleId();
    return id === null ? new Set<string>() : new Set(this.store.permissionIdsForRole(id));
  });

  protected readonly hasUnsavedChanges = computed(() => {
    const role = this.selectedRole();
    if (!role) {
      return false;
    }
    if (this.draftRoleName().trim() !== role.name) {
      return true;
    }
    const saved = this.savedPermissionIds();
    const draft = this.draftPermissionIds();
    if (saved.size !== draft.size) {
      return true;
    }
    for (const permissionId of draft) {
      if (!saved.has(permissionId)) {
        return true;
      }
    }
    return false;
  });

  // Role create modal
  protected readonly roleModalOpen = signal(false);
  protected readonly roleFormName = signal('');
  protected readonly roleFormDescription = signal('');
  protected readonly roleFormError = signal('');

  // User create/edit modal
  protected readonly userModalOpen = signal(false);
  protected readonly userModalMode = signal<'create' | 'edit'>('create');
  protected readonly userFormId = signal<number | null>(null);
  protected readonly userFormUsername = signal('');
  protected readonly userFormPassword = signal('');
  protected readonly userFormRoleIds = signal<ReadonlySet<number>>(new Set());
  protected readonly userFormError = signal('');

  // CSV import result modal
  protected readonly importResultOpen = signal(false);
  protected readonly importResult = signal<CsvImportResult | null>(null);

  // Generic confirmation dialog
  protected readonly confirmOpen = signal(false);
  protected readonly confirmTitle = signal('');
  protected readonly confirmMessage = signal('');
  protected readonly confirmLabel = signal('Delete');
  private confirmAction: (() => void) | null = null;

  protected readonly membersCaption = computed(() => {
    const role = this.selectedRole();
    if (!role) {
      return 'View members after selecting a role.';
    }
    const count = this.members().length;
    return `${count} ${count === 1 ? 'member' : 'members'}`;
  });

  protected readonly roleTotalLabel = computed(() => {
    const count = this.roles().length;
    return `${count} role${count === 1 ? '' : 's'} in total`;
  });

  // ---------- Selection / drafts ----------

  protected onRoleSearch(event: Event): void {    this.roleSearch.set((event.target as HTMLInputElement).value);
  }

  protected onRoleNameChange(value: string): void {
    this.draftRoleName.set(value);
    this.roleNameError.set('');
  }

  protected selectRole(id: number): void {
    this.selectedRoleId.set(id);
    this.resetDraft();
  }

  private resetDraft(): void {
    const role = this.selectedRole();
    this.draftRoleName.set(role?.name ?? '');
    this.draftPermissionIds.set(new Set(this.savedPermissionIds()));
  }

  // ---------- Permission tree ----------

  protected isPermissionChecked(permissionId: string): boolean {
    return this.draftPermissionIds().has(permissionId);
  }

  protected togglePermission(permissionId: string): void {
    this.draftPermissionIds.update((current) => {
      const next = new Set(current);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  }

  protected groupState(group: PermissionGroup): 'on' | 'half' | 'off' {
    const ids = group.items.map((item) => item.id);
    const checked = ids.filter((id) => this.draftPermissionIds().has(id)).length;
    if (checked === 0) {
      return 'off';
    }
    return checked === ids.length ? 'on' : 'half';
  }

  protected toggleGroup(group: PermissionGroup): void {
    const ids = group.items.map((item) => item.id);
    const allOn = ids.every((id) => this.draftPermissionIds().has(id));
    this.draftPermissionIds.update((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (allOn) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }

  protected selectAllPermissions(): void {
    const all = new Set<string>();
    for (const group of PERMISSION_GROUPS) {
      for (const item of group.items) {
        all.add(item.id);
      }
    }
    this.draftPermissionIds.set(all);
  }

  protected invertPermissions(): void {
    this.draftPermissionIds.update((current) => {
      const next = new Set<string>();
      for (const group of PERMISSION_GROUPS) {
        for (const item of group.items) {
          if (!current.has(item.id)) {
            next.add(item.id);
          }
        }
      }
      return next;
    });
  }

  protected saveRoleChanges(): void {
    const role = this.selectedRole();
    if (!role) {
      return;
    }
    const isRename = this.draftRoleName().trim() !== role.name;
    const update = this.store.updateRole(role.id, this.draftRoleName(), role.description);
    if (!update.ok) {
      this.roleNameError.set(update.error ?? 'Could not save the role.');
      this.toastService.show(update.error ?? 'Could not save the role.', 'error');
      return;
    }
    this.roleNameError.set('');
    if (isRename) {
      this.auditLog.logOperate('role.rename', `${role.name} -> ${this.draftRoleName().trim()}`);
    } else {
      this.auditLog.logOperate('role.update', role.name);
    }
    const permissions = this.store.setRolePermissions(role.id, [
      ...this.draftPermissionIds(),
    ]);
    if (!permissions.ok) {
      this.toastService.show(permissions.error ?? 'Could not save permissions.', 'error');
      return;
    }
    const saved = new Set(this.savedPermissionIds());
    const draft = new Set(this.draftPermissionIds());
    const added = [...draft].filter((id) => !saved.has(id));
    const removed = [...saved].filter((id) => !draft.has(id));
    const parts: string[] = [];
    if (added.length > 0) {
      parts.push(`+${permissionNames(added).join(', +')}`);
    }
    if (removed.length > 0) {
      parts.push(`-${permissionNames(removed).join(', -')}`);
    }
    if (added.length === 0 && removed.length === 0) {
      // First save: list all granted permissions
      parts.push(...permissionNames([...draft]).map((name) => `+${name}`));
    }
    this.auditLog.logOperate('role.permissions', role.name, parts.join(' '));
    this.toastService.show('Role changes saved.', 'success');
  }

  protected requestDeleteRole(): void {
    const role = this.selectedRole();
    if (!role) {
      return;
    }
    this.requestConfirm(
      'Delete this role?',
      `"${role.name}" will be removed. Its members keep their accounts but lose this role's permissions.`,
      'Delete role',
      () => {
        const result = this.store.deleteRole(role.id);
        if (result.ok) {
          this.selectedRoleId.set(null);
          this.roleNameError.set('');
          this.toastService.show('Role deleted.', 'success');
        } else {
          this.toastService.show(result.error ?? 'Could not delete the role.', 'error');
        }
      },
    );
  }

  // ---------- Role create modal ----------

  protected openCreateRoleModal(): void {
    this.roleFormName.set('');
    this.roleFormDescription.set('');
    this.roleFormError.set('');
    this.roleModalOpen.set(true);
  }

  protected submitRoleModal(): void {
    const result = this.store.createRole(this.roleFormName(), this.roleFormDescription());
    if (!result.ok) {
      this.roleFormError.set(result.error ?? 'Could not create the role.');
      return;
    }
    this.roleModalOpen.set(false);
    this.toastService.show('Role created.', 'success');
    const role = result.value;
    if (role) {
      this.selectRole(role.id);
    }
  }

  // ---------- User modal ----------

  protected openCreateUserModal(): void {
    this.userModalMode.set('create');
    this.userFormId.set(null);
    this.userFormUsername.set('');
    this.userFormPassword.set('');
    const roleIds = new Set<number>();
    const selected = this.selectedRoleId();
    if (selected !== null) {
      roleIds.add(selected);
    }
    this.userFormRoleIds.set(roleIds);
    this.userFormError.set('');
    this.userModalOpen.set(true);
  }

  protected openEditUserModal(user: AccessUser): void {
    this.userModalMode.set('edit');
    this.userFormId.set(user.id);
    this.userFormUsername.set(user.username);
    this.userFormPassword.set('');
    this.userFormRoleIds.set(new Set(user.roleIds));
    this.userFormError.set('');
    this.userModalOpen.set(true);
  }

  protected isUserRoleToggled(roleId: number): boolean {
    return this.userFormRoleIds().has(roleId);
  }

  protected toggleUserRole(roleId: number): void {
    this.userFormRoleIds.update((current) => {
      const next = new Set(current);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  }

  protected submitUserModal(): void {
    const username = this.userFormUsername();
    const password = this.userFormPassword();
    const roleIds = [...this.userFormRoleIds()];

    if (this.userModalMode() === 'create') {
      const result = this.store.createUser(username, password, roleIds);
      if (!result.ok) {
        this.userFormError.set(result.error ?? 'Could not add the user.');
        return;
      }
      this.userModalOpen.set(false);
      this.toastService.show('User added.', 'success');
      return;
    }

    const id = this.userFormId();
    if (id === null) {
      return;
    }
    const oldUser = this.store.userById(id);
    const oldRoles = oldUser?.roleIds.map((rid) => this.store.roleById(rid)?.name).filter(Boolean) ?? [];
    const newRoles = roleIds.map((rid) => this.store.roleById(rid)?.name).filter(Boolean);
    const result = this.store.updateUser(id, {
      username,
      password: password === '' ? null : password,
      roleIds,
    });
    if (!result.ok) {
      this.userFormError.set(result.error ?? 'Could not save the user.');
      return;
    }
    this.userModalOpen.set(false);
    this.toastService.show('User updated.', 'success');

    // Log detailed changes
    const changes: string[] = [];
    if (oldUser && username !== oldUser.username) {
      changes.push(`username: ${oldUser.username} -> ${username}`);
    }
    const oldRolesStr = oldRoles.join(', ');
    const newRolesStr = newRoles.join(', ');
    if (oldRolesStr !== newRolesStr) {
      changes.push(`role: ${oldRolesStr} -> ${newRolesStr}`);
    }
    if (password !== '' && password !== null) {
      changes.push('password changed');
    }
    if (changes.length > 0) {
      this.auditLog.logOperate('user.update', username, changes.join(', '));
    } else {
      this.auditLog.logOperate('user.update', username);
    }
  }

  protected toggleUserEnabled(user: AccessUser): void {
    const result = this.store.setUserEnabled(user.id, !user.enabled);
    if (!result.ok) {
      this.toastService.show(result.error ?? 'Could not update the user.', 'error');
      return;
    }
    this.toastService.show(
      user.enabled ? 'User disabled.' : 'User enabled.',
      user.enabled ? 'info' : 'success',
    );
  }

  protected requestDeleteUser(user: AccessUser): void {
    this.requestConfirm(
      'Delete this user?',
      `"${user.username}" will be removed from all roles and can no longer sign in.`,
      'Delete user',
      () => {
        const result = this.store.deleteUser(user.id);
        if (result.ok) {
          this.toastService.show('User deleted.', 'success');
        } else {
          this.toastService.show(result.error ?? 'Could not delete the user.', 'error');
        }
      },
    );
  }

  // ---------- CSV template / import ----------

  protected downloadTemplate(): void {
    const blob = new Blob([this.store.csvTemplate()], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = CSV_TEMPLATE_FILE_NAME;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toastService.show('Template downloaded.', 'success');
    this.auditLog.logOperate('template.download', CSV_TEMPLATE_FILE_NAME);
  }

  protected async onCsvSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const content = await file.text();
    const assignRoleIds =
      this.selectedRoleId() === null ? [] : [this.selectedRoleId()!];
    const result = this.store.importUsersCsv(content, assignRoleIds);
    this.importResult.set(result);
    this.importResultOpen.set(true);
    this.auditLog.logOperate(
      'user.import',
      'CSV import',
      `${result.addedCount} rows imported, ${result.errors.length} failed`,
    );
    if (result.addedCount > 0 && result.errors.length === 0) {
      this.toastService.show(`${result.addedCount} users imported.`, 'success');
    }
  }

  // ---------- Confirm dialog ----------

  private requestConfirm(
    title: string,
    message: string,
    confirmLabel: string,
    action: () => void,
  ): void {
    this.confirmTitle.set(title);
    this.confirmMessage.set(message);
    this.confirmLabel.set(confirmLabel);
    this.confirmAction = action;
    this.confirmOpen.set(true);
  }

  protected onConfirm(): void {
    this.confirmOpen.set(false);
    const action = this.confirmAction;
    this.confirmAction = null;
    action?.();
  }

  protected onCancelConfirm(): void {
    this.confirmOpen.set(false);
    this.confirmAction = null;
  }
}
