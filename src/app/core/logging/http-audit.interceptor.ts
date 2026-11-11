import {
  HttpErrorResponse,
  HttpEventType,
  HttpInterceptorFn,
  HttpContextToken,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { AuditLogService } from './audit-log.service';

/**
 * Mark an HttpClient request as silent so the interceptor skips logging it.
 * Used for background polling (system metrics, capacity, status checks) and
 * any timer-driven call.
 */
export const LOG_SILENT = new HttpContextToken(() => false);

/**
 * Records an `interface` audit log entry for every API call made through
 * `HttpClient`. Calls issued with `window.fetch` (all pre-existing services)
 * are NOT patched here — only HttpClient calls go through this interceptor.
 *
 * Logs only: METHOD PATH STATUS TIME — never response bodies.
 * Silent requests (LOG_SILENT context) and static assets are skipped.
 * Failed requests (4xx/5xx) are always logged.
 */
export const httpAuditInterceptor: HttpInterceptorFn = (req, next) => {
  const auditLog = inject(AuditLogService);

  if (req.context.get(LOG_SILENT)) {
    return next(req);
  }

  if (!req.url.includes('/api/')) {
    return next(req);
  }

  const started = performance.now();

  return next(req).pipe(
    tap({
      next: (event) => {
        if (event.type === HttpEventType.Response) {
          auditLog.logInterface(
            req.method,
            req.urlWithParams,
            event.status,
            performance.now() - started,
          );
        }
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          auditLog.logInterface(
            req.method,
            req.urlWithParams,
            error.status,
            performance.now() - started,
          );
        }
      },
    }),
  );
};
