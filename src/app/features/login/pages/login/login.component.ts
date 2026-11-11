import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { APP_SETTINGS } from '../../../../core/config/app-settings';
import { AUTH_CONFIG } from '../../../../core/auth/auth.config';
import { AuthService } from '../../../../core/auth/auth.service';
import { BrandLogoComponent } from '../../../../shared/components/brand-logo/brand-logo.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { ToastContainerComponent } from '../../../../shared/components/toast-container/toast-container.component';

const REASON_NOTICES: Readonly<Record<string, string>> = {
  expired: 'Your session has expired. Please log in again.',
  disabled: 'This account has been disabled by an administrator.',
  'no-access': 'Your account does not have access to any pages. Please contact an administrator.',
};

@Component({
  selector: 'app-login',
  imports: [FormsModule, BrandLogoComponent, IconComponent, ToastContainerComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly settings = APP_SETTINGS;
  protected readonly sessionHours = AUTH_CONFIG.sessionDurationHours;

  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly rememberMe = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly submitting = signal(false);

  ngOnInit(): void {
    const remembered = this.authService.rememberedUsername();
    if (remembered) {
      this.username.set(remembered);
      this.rememberMe.set(true);
    }
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason) {
      this.notice.set(REASON_NOTICES[reason] ?? '');
    }
  }

  protected onUsernameInput(event: Event): void {
    this.username.set((event.target as HTMLInputElement).value);
    this.error.set('');
  }

  protected onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
    this.error.set('');
  }

  protected onRememberToggle(event: Event): void {
    this.rememberMe.set((event.target as HTMLInputElement).checked);
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    this.error.set('');
    this.notice.set('');

    const result = this.authService.signIn(
      this.username(),
      this.password(),
      this.rememberMe(),
    );
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }

    this.submitting.set(true);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const target =
      returnUrl !== null && returnUrl.startsWith('/') && !returnUrl.startsWith('/login')
        ? returnUrl
        : '/dashboard';
    void this.router.navigateByUrl(target);
  }
}
