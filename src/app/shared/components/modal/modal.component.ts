import { ChangeDetectionStrategy, Component, ElementRef, HostListener, effect, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  readonly title = input('');
  readonly open = input.required<boolean>();
  readonly size = input<'md' | 'lg'>('md');

  readonly close = output<void>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDivElement>>('dialog');
  private lastFocusedElement: Element | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.lastFocusedElement = document.activeElement;
        document.body.style.overflow = 'hidden';
        setTimeout(() => this.focusFirst());
      } else {
        document.body.style.overflow = '';
        if (this.lastFocusedElement instanceof HTMLElement && this.lastFocusedElement.isConnected) {
          this.lastFocusedElement.focus();
        }
        this.lastFocusedElement = null;
      }
    });
  }

  onBackdropClick() {
    this.close.emit();
  }

  onCloseClick() {
    this.close.emit();
  }

  @HostListener('keydown.escape')
  onEscape() {
    this.close.emit();
  }

  @HostListener('keydown.tab', ['$event'])
  onTab(event: Event) {
    const ke = event as KeyboardEvent;
    const dialog = this.dialogRef()?.nativeElement;
    if (!dialog) return;

    const focusable = this.getFocusable(dialog);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (ke.shiftKey && document.activeElement === first) {
      ke.preventDefault();
      last.focus();
    } else if (!ke.shiftKey && document.activeElement === last) {
      ke.preventDefault();
      first.focus();
    }
  }

  private focusFirst() {
    const dialog = this.dialogRef()?.nativeElement;
    if (!dialog) return;
    const focusable = this.getFocusable(dialog);
    if (focusable.length > 0) focusable[0].focus();
  }

  private getFocusable(dialog: HTMLElement): HTMLElement[] {
    return Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
  }
}
