import { Component, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { DataImportService } from '../../data-import.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-data-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-import.component.html',
  styleUrl: './data-import.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataImportComponent {
  private readonly service = inject(DataImportService);
  private readonly toastService = inject(ToastService);

  // Subtitle computed from active tab
  readonly subtitle = computed(() => {
    const tab = this.service.activeTab();
    if (tab === 'playback') {
      return 'Temporarily view curves and make judgments.';
    }
    return 'Preview and import the corrected sample.';
  });

  // Derived signals from service
  readonly activeTab = this.service.activeTab;
  readonly isImporting = this.service.isLoading;

  // Training signals
  readonly trainingRows = computed(() => this.service.getTrainingRows());
  readonly trainingSelection = this.service.trainingSelection;
  readonly trainingFilterChip = this.service.trainingFilterChip;
  readonly trainingPage = this.service.trainingPage;
  readonly trainingPageSize = this.service.trainingPageSize;
  readonly trainingTotal = computed(() => this.service.getTrainingTotal());
  readonly trainingPages = computed(() => this.service.getTrainingPages());
  readonly trainingFrom = computed(() => this.service.getTrainingFrom());
  readonly trainingTo = computed(() => this.service.getTrainingTo());
  readonly trainingValidCount = computed(() => this.service.getValidCount());
  readonly trainingWarningCount = computed(() => this.service.getWarningCount());
  readonly trainingErrorCount = computed(() => this.service.getErrorCount());
  readonly trainingRemainingCount = computed(() => this.service.getRemainingCount());

  // Playback signals
  readonly playbackCurves = computed(() => this.service.playbackCurves);
  readonly playbackSelection = this.service.playbackSelection;
  readonly playbackPage = this.service.playbackPage;
  readonly playbackPageSize = this.service.playbackPageSize;
  readonly playbackTotal = computed(() => this.service.getPlaybackTotal());
  readonly playbackPages = computed(() => this.service.getPlaybackPages());
  readonly playbackFrom = computed(() => this.service.getPlaybackFrom());
  readonly playbackTo = computed(() => this.service.getPlaybackTo());

  readonly selectedCount = computed(() => this.service.getSelectedCount());

  // Toast helper
  showToast(message: string, type: 'success' | 'info' | 'error') {
    this.toastService.show(message, type);
  }

  // Tab actions
  setActiveTab(tab: 'playback' | 'training') {
    this.service.setActiveTab(tab);
  }

  onFileSelected(event: Event, isPlayback = false) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const file = input.files[0];
    if (!file) return;

    const allowedTypes = ['.zip', '.csv', '.tsv', '.txt', '.xlsx', '.xls', '.json'];
    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt && !allowedTypes.includes(`.${fileExt}`)) {
      this.showToast(`File type .${fileExt} is not allowed`, 'error');
      input.value = '';
      return;
    }

    this.service.loadFile(file, isPlayback);

    // Reset input value so same file can be chosen again
    input.value = '';
  }

  downloadTemplate() {
    // Create and trigger download of template
    const blob = new Blob(['sample template content'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Template downloaded', 'info');
  }

  // Remove row action
  onRemoveRow(rowId: string) {
    this.service.removeRow(rowId);
  }

  // Remove selected rows
  onRemoveSelected() {
    const rowIds = Array.from(this.service.trainingSelection()).filter(
      id => id
    );
    if (rowIds.length > 0) {
      this.service.removeRows(rowIds);
    }
  }

  // Clear all
  onClearAll() {
    this.service.clearAll();
  }

  // Source chip remove
  onSourceRemove(fileName: string) {
    this.service.removeSource(fileName);
  }

  // Edit row
  onEditRow(row: any) {
    // Open edit modal
    this.showEditModal(row);
  }

  private showEditModal(_row: any) {
    this.showToast('Edit modal not yet implemented', 'info');
  }
}