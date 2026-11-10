import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Event as RouterEvent,
  NavigationEnd,
  Router,
} from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { APP_SETTINGS } from './core/config/app-settings';

const DEFAULT_TITLE = 'XYD AI | Large Model Locking Data Analysis';

function getDeepestTitle(route: ActivatedRouteSnapshot): string {
  let deepest: ActivatedRouteSnapshot | null = route;
  let lastTitle = '';

  while (deepest !== null) {
    const dataTitle = (deepest.data as { title?: string })?.title;
    if (dataTitle && String(dataTitle).trim() !== '') {
      lastTitle = String(dataTitle);
    }
    deepest = deepest.firstChild ?? null;
  }

  return lastTitle;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly brand = APP_SETTINGS.brand;

  constructor() {
    this.title.setTitle(DEFAULT_TITLE);
  }

  ngOnInit(): void {
    const snapshot = this.router.routerState.snapshot as unknown as ActivatedRouteSnapshot;
    const initialTitle = getDeepestTitle(snapshot);
    const final = initialTitle ? `${initialTitle} | ${this.brand}` : DEFAULT_TITLE;
    this.title.setTitle(final);

    this.router.events.subscribe((event: RouterEvent) => {
      if (event instanceof NavigationEnd) {
        const snap = this.router.routerState.snapshot as unknown as ActivatedRouteSnapshot;
        const pageTitle = getDeepestTitle(snap);
        const navTitle = pageTitle ? `${pageTitle} | ${this.brand}` : DEFAULT_TITLE;
        this.title.setTitle(navTitle);
      }
    });
  }
}
