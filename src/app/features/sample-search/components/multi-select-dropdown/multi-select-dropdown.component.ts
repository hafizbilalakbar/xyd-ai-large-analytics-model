import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-multi-select-dropdown',
  standalone: true,
  templateUrl: './multi-select-dropdown.component.html',
  styleUrl: './multi-select-dropdown.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiSelectDropdownComponent {
  readonly value = input.required<string[]>();
  readonly options = input.required<{ key: string; label: string }[]>();
  readonly placeholder = input('All');
  readonly disabled = input(false);

  readonly valueChange = output<string[]>();

  protected readonly open = signal(false);
  protected readonly focusedIndex = signal(-1);
  protected readonly popupUpward = signal(false);

  protected readonly displayText = computed(() => {
    const v = this.value();
    if (v.length === 0) return this.placeholder();
    if (v.length === 1) {
      const opt = this.options().find(o => o.key === v[0]);
      return opt?.label ?? v[0];
    }
    return `${v.length} selected`;
  });

  protected readonly selectedCountText = computed(() => {
    const count = this.value().length;
    if (count === 1) return '1 item selected';
    return `${count} items selected`;
  });

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  toggle() {
    if (this.disabled()) return;
    const willOpen = !this.open();
    if (willOpen) {
      const rect = this.elementRef.nativeElement.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      this.popupUpward.set(spaceBelow < 280);
      this.focusedIndex.set(0);
    }
    this.open.set(willOpen);
  }

  close() {
    this.open.set(false);
    this.focusedIndex.set(-1);
  }

  isSelected(key: string): boolean {
    return this.value().includes(key);
  }

  onChange(key: string, event?: Event) {
    event?.stopPropagation();
    const current = this.value();
    const next = current.includes(key)
      ? current.filter(k => k !== key)
      : [...current, key];
    this.valueChange.emit(next);
  }

  clear(event: Event) {
    event.stopPropagation();
    this.valueChange.emit([]);
  }

  onKeydown(event: KeyboardEvent) {
    if (!this.open()) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.toggle();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusedIndex.update(i => Math.min(i + 1, this.options().length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusedIndex.update(i => Math.max(i - 1, 0));
    } else if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      const opt = this.options()[this.focusedIndex()];
      if (opt) this.onChange(opt.key);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onGlobalEscape() {
    this.close();
  }
}
