import { Injectable, inject } from '@angular/core';
import { AuditLogService } from './audit-log.service';

/**
 * Global click listener that logs main button clicks as `ui.click <label>`.
 *
 * Rules:
 * - Uses the button's visible text or aria-label.
 * - Skips icon-only buttons with no label, plain text inputs, scrolling, hover.
 * - Skips elements with `data-no-log` attribute.
 * - Holds each click for 400ms; if a specific action log arrives within that
 *   window, the pending click is dropped (avoids duplicate lines for the same
 *   user action).
 * - Ignores exact repeats of the same click by the same user within 1 second.
 */
@Injectable({ providedIn: 'root' })
export class ClickLogger {
  private readonly auditLog = inject(AuditLogService);

  constructor() {
    if (typeof document === 'undefined') {
      return;
    }
    document.addEventListener('click', this.handleClick, true);
  }

  private readonly handleClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    // Respect data-no-log opt-out
    if (target.closest('[data-no-log]')) {
      return;
    }

    const button = target.closest<HTMLElement>('button, [role="button"], [role="switch"]');
    if (!button) {
      return;
    }

    // Skip disabled elements
    if (button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true') {
      return;
    }

    // Skip icon-only buttons with no visible text or aria-label
    const label =
      button.getAttribute('aria-label')?.trim() ??
      button.textContent?.trim() ??
      '';
    if (!label) {
      return;
    }

    const normalized = label.replace(/\s+/g, ' ').slice(0, 60);
    if (!normalized) {
      return;
    }

    this.auditLog.logClick(normalized);
  };
}
