import { HttpErrorResponse, HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { AuditLogService } from './audit-log.service';

const SUMMARY_MAX_LENGTH = 400;

function summarize(body: unknown): string {
  if (body === null || body === undefined) {
    return '';
  }
  try {
    const text = JSON.stringify(body);
    if (text === undefined) {
      return '';
    }
    return text.length > SUMMARY_MAX_LENGTH
      ? `${text.slice(0, SUMMARY_MAX_LENGTH)}…`
      : text;
  } catch {
    return '';
  }
}

/**
 * Records an `interface` audit log entry for every API call made through
 * `HttpClient`. Calls issued with `window.fetch` (all pre-existing services)
 * are captured by the fetch patch inside `AuditLogService` instead.
 */
export const httpAuditInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/')) {
    return next(req);
  }

  const auditLog = inject(AuditLogService);
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
            summarize(event.body),
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
            summarize(error.error),
          );
        }
      },
    }),
  );
};
