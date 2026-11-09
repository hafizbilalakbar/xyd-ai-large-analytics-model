import { ChangeDetectionStrategy, Component, ElementRef, HostListener, input, output, viewChildren } from '@angular/core';
import { TabId } from '../../data-access/parameters-and-formulas.models';

@Component({
  selector: 'app-config-tabs',
  standalone: true,
  templateUrl: './config-tabs.component.html',
  styleUrl: './config-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigTabsComponent {
  readonly activeTab = input.required<TabId>();
  readonly tabChange = output<TabId>();

  readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabBtn');

  readonly tabs: Array<{ id: TabId; label: string }> = [
    { id: 'execution', label: 'System Execution Parameters' },
    { id: 'failure-modes', label: 'Failure Mode Types' },
    { id: 'system', label: 'System Settings' },
  ];

  selectTab(tab: TabId): void {
    this.tabChange.emit(tab);
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();

    const currentIndex = this.tabs.findIndex((t) => t.id === this.activeTab());
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % this.tabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
    }

    const nextTab = this.tabs[nextIndex];
    this.tabChange.emit(nextTab.id);

    const buttons = this.tabButtons();
    if (buttons[nextIndex]) {
      buttons[nextIndex].nativeElement.focus();
    }
  }
}
