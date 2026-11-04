import { ChangeDetectionStrategy, Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastContainerComponent } from '../../../../shared/components/toast-container/toast-container.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PlaybackImportModalComponent } from '../../components/playback-import-modal/playback-import-modal.component';
import { PlaybackImportPanelComponent } from '../../components/playback-import-panel/playback-import-panel.component';
import { TrainingImportPanelComponent } from '../../components/training-import-panel/training-import-panel.component';
import { ImportTabsComponent } from '../../components/import-tabs/import-tabs.component';
import { DataImportService } from '../../data-access/data-import.service';
import { ImportParserService } from '../../data-access/import-parser.service';
import type { ImportTab, TrainingRowStatus } from '../../data-access/data-import.models';

@Component({
  selector: 'app-data-import-page',
  standalone: true,
  imports: [
    ToastContainerComponent,
    ConfirmDialogComponent,
    PlaybackImportModalComponent,
    PlaybackImportPanelComponent,
    TrainingImportPanelComponent,
    ImportTabsComponent,
  ],
  providers: [DataImportService, ImportParserService],
  templateUrl: './data-import-page.component.html',
  styleUrl: './data-import-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataImportPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(DataImportService);

  readonly activeTab = this.service.activeTab;
  readonly batches = this.service.batches;
  readonly playbackItems = this.service.pagedPlaybackItems;
  readonly playbackTotalCount = this.service.playbackTotalCount;
  readonly playbackPage = this.service.playbackPage;
  readonly playbackPageSize = this.service.playbackPageSize;
  readonly playbackSearch = this.service.playbackSearch;
  readonly playbackFilter = this.service.playbackFilter;
  readonly playbackSort = this.service.playbackSort;
  readonly selectedPlaybackItem = this.service.selectedPlaybackItem;
  readonly playbackCounts = this.service.playbackCounts;
  readonly importErrors = this.service.importErrors;

  readonly trainingRows = this.service.pagedTrainingRows;
  readonly trainingTotalCount = this.service.trainingTotalCount;
  readonly trainingPage = this.service.trainingPage;
  readonly trainingPageSize = this.service.trainingPageSize;
  readonly trainingSelectedIds = this.service.trainingSelectedIds;
  readonly trainingSelectedCount = this.service.trainingSelectedCount;
  readonly trainingFilter = this.service.trainingFilter;
  readonly duplicateMode = this.service.duplicateMode;
  readonly trainingCounts = this.service.trainingCounts;

  readonly isImporting = this.service.isImporting;
  readonly importStatus = this.service.importStatus;
  readonly progressPercent = this.service.progressPercent;
  readonly currentStage = this.service.currentStage;
  readonly currentFileName = this.service.currentFileName;
  readonly importElapsedMs = this.service.importElapsedMs;

  protected playbackImportModalOpen = false;
  protected clearPlaybackConfirmOpen = false;
  protected writeTrainingConfirmOpen = false;
  protected tabSwitchPending: ImportTab | null = null;

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const tab = params['tab'];
      if (tab === 'playback' || tab === 'training') {
        this.service.activeTab.set(tab);
      } else {
        this.service.activeTab.set('playback');
        this.service.setTab('playback');
      }
    });
  }

  ngOnDestroy(): void {
    this.service.cancelImport();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isImporting()) {
      event.preventDefault();
    }
  }

  onTabChange(tab: ImportTab): void {
    if (this.isImporting()) {
      this.tabSwitchPending = tab;
      return;
    }
    this.service.setTab(tab);
  }

  confirmTabSwitch(): void {
    if (this.tabSwitchPending) {
      this.service.setTab(this.tabSwitchPending);
      this.tabSwitchPending = null;
    }
  }

  cancelTabSwitch(): void {
    this.tabSwitchPending = null;
  }

  openPlaybackImport(): void {
    this.playbackImportModalOpen = true;
  }

  closePlaybackImport(): void {
    if (this.isImporting()) return;
    this.playbackImportModalOpen = false;
  }

  async onPlaybackImport(event: { batchId: string; files: File[] }): Promise<void> {
    await this.service.importPlayback(event.batchId, event.files);
    if (!this.isImporting()) {
      this.playbackImportModalOpen = false;
    }
  }

  onPlaybackFileDrop(_files: File[]): void {
    this.playbackImportModalOpen = true;
  }

  onClearPlayback(): void {
    this.clearPlaybackConfirmOpen = true;
  }

  confirmClearPlayback(): void {
    this.service.clearPlaybackItems();
    this.clearPlaybackConfirmOpen = false;
  }

  onDownloadPlaybackErrors(): void {
    this.service.downloadErrorReport();
  }

  onReJudge(): void {
    this.service.reJudgeSelected();
  }

  async onTrainingFileDrop(files: File[]): Promise<void> {
    await this.service.importTraining(files);
  }

  onWriteTraining(): void {
    this.writeTrainingConfirmOpen = true;
  }

  async confirmWriteTraining(): Promise<void> {
    await this.service.writeTrainingSet();
    this.writeTrainingConfirmOpen = false;
  }

  onDownloadTrainingErrors(): void {
    this.service.downloadErrorReport();
  }

  onDownloadTemplate(): void {
    this.service.downloadTemplate();
  }

  onCancelImport(): void {
    this.service.cancelImport();
  }

  onFilterChange(value: 'all' | 'PASS' | 'FAIL' | 'Pending'): void {
    this.service.setPlaybackFilter(value);
  }

  onSortChange(value: 'name' | 'time'): void {
    this.service.setPlaybackSort(value);
  }

  onTrainingFilterChange(value: 'all' | TrainingRowStatus): void {
    this.service.setTrainingFilter(value);
  }

  onDuplicateModeChange(value: string): void {
    if (value === 'skip' || value === 'overwrite') {
      this.service.setDuplicateMode(value);
    }
  }

  onToggleTrainingRow(id: string): void {
    this.service.toggleTrainingRow(id);
  }

  onToggleTrainingSelectAll(selected: boolean): void {
    this.service.toggleTrainingSelectAll(selected);
  }

  onSelectPlayback(id: string): void {
    this.service.selectPlayback(id);
  }

  onPreviousPlayback(): void {
    this.service.selectPreviousPlayback();
  }

  onNextPlayback(): void {
    this.service.selectNextPlayback();
  }

  onPlaybackPageChange(page: number): void {
    this.service.setPlaybackPage(page);
  }

  onPlaybackPageSizeChange(size: number): void {
    this.service.setPlaybackPageSize(size);
  }

  onTrainingPageChange(page: number): void {
    this.service.setTrainingPage(page);
  }

  onTrainingPageSizeChange(size: number): void {
    this.service.setTrainingPageSize(size);
  }
}
