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

  protected readonly selectedMemberIds = signal<ReadonlySet<number>>(new Set());

  protected readonly allMembersSelected = computed(() => {
    const members = this.members();
    return (
      members.length > 0 && members.every((member) => this.selectedMemberIds().has(member.id))
    );
  });

  protected readonly someMembersSelected = computed(() => {
    const selected = this.selectedMemberIds();
    return selected.size > 0 && !this.allMembersSelected();
  });

  protected readonly draftRoleName = signal('');
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

  protected lastGroup(group: PermissionGroup): boolean {
    return group.key === PERMISSION_GROUPS[PERMISSION_GROUPS.length - 1]?.key;
  }

  // ---------- Selection / drafts ----------

  protected selectRole(id: number): void {
    this.selectedRoleId.set(id);
    this.selectedMemberIds.set(new Set());
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
    const update = this.store.updateRole(role.id, this.draftRoleName(), role.description);
    if (!update.ok) {
      this.toastService.show(update.error ?? 'Could not save the role.', 'error');
      return;
    }
    const permissions = this.store.setRolePermissions(role.id, [
      ...this.draftPermissionIds(),
    ]);
    if (!permissions.ok) {
      this.toastService.show(permissions.error ?? 'Could not save permissions.', 'error');
      return;
    }
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
          this.selectedMemberIds.set(new Set());
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

  // ---------- Members table ----------

  protected isMemberSelected(userId: number): boolean {
    return this.selectedMemberIds().has(userId);
  }

  protected toggleMember(userId: number): void {
    this.selectedMemberIds.update((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  protected toggleAllMembers(checked: boolean): void {
    if (!checked) {
      this.selectedMemberIds.set(new Set());
      return;
    }
    this.selectedMemberIds.set(new Set(this.members().map((member) => member.id)));
  }

  protected requestRemoveSelectedMembers(): void {
    const roleId = this.selectedRoleId();
    if (roleId === null || this.selectedMemberIds().size === 0) {
      return;
    }
    const count = this.selectedMemberIds().size;
    this.requestConfirm(
      `Remove ${count} ${count === 1 ? 'member' : 'members'} from this role?`,
      'The accounts are kept, but they lose the permissions of this role.',
      'Remove',
      () => {
        const result = this.store.removeUsersFromRole(roleId, [...this.selectedMemberIds()]);
        if (result.ok) {
          this.selectedMemberIds.set(new Set());
          this.toastService.show('Members removed from the role.', 'success');
        } else {
          this.toastService.show(result.error ?? 'Could not remove the members.', 'error');
        }
      },
    );
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
