import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ImportTab } from '../../data-access/data-import.models';

@Component({
  selector: 'app-import-tabs',
  standalone: true,
  templateUrl: './import-tabs.component.html',
  styleUrl: './import-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportTabsComponent {
  readonly activeTab = input.required<ImportTab>();
  readonly busy = input(false);

  readonly tabChange = output<ImportTab>();

  private readonly tabs: { key: ImportTab; label: string }[] = [
    { key: 'playback', label: 'Import Playback Data' },
    { key: 'training', label: 'Import Training Data' },
  ];

  protected readonly tabsList = () => this.tabs;

  onTabClick(tab: ImportTab): void {
    if (this.busy()) return;
    this.tabChange.emit(tab);
  }

  onKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const next = (index + 1) % this.tabs.length;
      this.tabChange.emit(this.tabs[next].key);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const prev = (index - 1 + this.tabs.length) % this.tabs.length;
      this.tabChange.emit(this.tabs[prev].key);
    }
  }
}
