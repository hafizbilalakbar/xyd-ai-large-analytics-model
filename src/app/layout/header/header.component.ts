import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { APP_SETTINGS } from '../../core/config/app-settings';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-header',
  imports: [IconComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private readonly authService = inject(AuthService);

  protected readonly settings = APP_SETTINGS;
  protected readonly user = this.authService.user;

  readonly toggleMobile = output<void>();

  protected signIn(): void {
    this.authService.signIn();
  }

  protected signOut(): void {
    this.authService.signOut();
  }
}
