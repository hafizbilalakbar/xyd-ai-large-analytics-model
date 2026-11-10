import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { APP_SETTINGS } from '../../../core/config/app-settings';

@Component({
  selector: 'app-brand-logo',
  standalone: true,
  imports: [],
  templateUrl: './brand-logo.component.html',
  styleUrl: './brand-logo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandLogoComponent {
  readonly size = input<number>(36);
  readonly showName = input<boolean>(true);
  readonly shortName = input<boolean>(false);

  private readonly router = inject(Router);

  readonly settings = APP_SETTINGS;

  readonly displayName = computed(() => {
    if (this.shortName()) {
      return this.settings.shortName;
    }
    return this.settings.name;
  });

  readonly isReducedMotion = computed<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  navigateHome(): void {
    void this.router.navigate(['/dashboard']);
  }
}
