import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideRouter,
  withInMemoryScrolling,
} from '@angular/router';
import { routes } from './app.routes';
import { httpAuditInterceptor } from './core/logging/http-audit.interceptor';
import { NavigationLogger } from './core/logging/navigation-logger.service';
import { ClickLogger } from './core/logging/click-logger.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withInterceptors([httpAuditInterceptor])),
    NavigationLogger,
    ClickLogger,
  ],
};
