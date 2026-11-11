import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { APP_SETTINGS } from '../../core/config/app-settings';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [IconComponent, BrandLogoComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly settings = APP_SETTINGS;
  protected readonly user = this.authService.user;

  readonly toggleMobile = output<void>();

  protected signOut(): void {
    this.authService.signOut();
    void this.router.navigate(['/login']);
  }
}
