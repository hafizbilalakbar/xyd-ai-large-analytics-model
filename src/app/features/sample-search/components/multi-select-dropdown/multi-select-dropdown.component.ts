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

  protected readonly displayText = computed(() => {
    const v = this.value();
    if (v.length === 0) return this.placeholder();
    if (v.length === 1) {
      const opt = this.options().find(o => o.key === v[0]);
      return opt?.label ?? v[0];
    }
    return `${v.length} selected`;
  });

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  toggle() {
    if (this.disabled()) return;
    this.open.update(o => !o);
  }

  close() {
    this.open.set(false);
  }

  isSelected(key: string): boolean {
    return this.value().includes(key);
  }

  onChange(key: string, event: Event) {
    event.stopPropagation();
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('keydown.escape')
  onEscape() {
    this.close();
  }
}
