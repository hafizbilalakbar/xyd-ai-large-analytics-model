import { ChangeDetectionStrategy, Component, HostListener, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastContainerComponent } from '../../../../shared/components/toast-container/toast-container.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PlaybackImportModalComponent } from '../../components/playback-import-modal/playback-import-modal.component';
import { PlaybackImportPanelComponent } from '../../components/playback-import-panel/playback-import-panel.component';
import { TrainingImportPanelComponent } from '../../components/training-import-panel/training-import-panel.component';
import { ImportTabsComponent } from '../../components/import-tabs/import-tabs.component';
import { DataImportService } from '../../data-access/data-import.service';
import { FAILURE_CODES, fromDateTimeLocalValue, toDateTimeLocalValue, validateTrainingRow, isKnownFailureCode } from '../../data-access/import-constants';
import type { ImportTab, TrainingRowStatus } from '../../data-access/data-import.models';

interface TrainingEditDraft {
  readonly sampleId: string;
  readonly lockingTime: string;
  readonly failureMode: string;
  readonly corrected: boolean;
  readonly confidence: number;
  readonly modelVersion: string;
}

@Component({
  selector: 'app-data-import-page',
  standalone: true,
  imports: [
    ToastContainerComponent,
    ConfirmDialogComponent,
    ModalComponent,
    PlaybackImportModalComponent,
    PlaybackImportPanelComponent,
    TrainingImportPanelComponent,
    ImportTabsComponent,
  ],
  templateUrl: './data-import-page.component.html',
  styleUrl: './data-import-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataImportPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(DataImportService);

  readonly activeTab = this.service.activeTab;
  readonly subtitle = this.service.subtitle;
  readonly batches = this.service.batches;
  readonly playbackItems = this.service.pagedPlaybackItems;
  readonly playbackTotalItems = computed(() => this.service.playbackCounts().total);
  readonly playbackTotalCount = this.service.playbackTotalCount;
  readonly playbackPage = this.service.playbackPage;
  readonly playbackPageSize = this.service.playbackPageSize;
  readonly playbackSearch = this.service.playbackSearch;
  readonly playbackFilter = this.service.playbackFilter;
  readonly playbackSort = this.service.playbackSort;
  readonly selectedPlaybackItem = this.service.selectedPlaybackItem;
  readonly playbackCounts = this.service.playbackCounts;
  readonly playbackImportErrors = this.service.playbackImportErrors;
  readonly playbackProgress = this.service.playbackProgress;
  readonly playbackIsImporting = this.service.playbackIsImporting;

  readonly trainingRows = this.service.pagedTrainingRows;
  readonly trainingRowCount = this.service.trainingRowCount;
  readonly trainingTotalCount = this.service.trainingTotalCount;
  readonly trainingPage = this.service.trainingPage;
  readonly trainingPageSize = this.service.trainingPageSize;
  readonly trainingSelectedIds = this.service.trainingSelectedIds;
  readonly trainingSelectedCount = this.service.trainingSelectedCount;
  readonly trainingFilter = this.service.trainingFilter;
  readonly duplicateMode = this.service.duplicateMode;
  readonly trainingCounts = this.service.trainingCounts;
  readonly trainingSources = this.service.trainingSources;
  readonly trainingImportErrors = this.service.trainingImportErrors;
  readonly trainingProgress = this.service.trainingProgress;
  readonly trainingIsImporting = this.service.trainingIsImporting;

  readonly isImporting = this.service.isImporting;

  protected playbackImportModalOpen = false;
  protected clearPlaybackConfirmOpen = false;
  protected writeTrainingConfirmOpen = false;
  protected removeSelectedConfirmOpen = false;
  protected clearAllConfirmOpen = false;
  protected removeSourceConfirmOpen = false;
  protected removeSourceFileName = '';
  protected removePlaybackConfirmOpen = false;
  protected removePlaybackItemId = '';
  protected discardEditConfirmOpen = false;

  protected readonly editRowId = signal<string | null>(null);
  protected readonly editDraft = signal<TrainingEditDraft | null>(null);
  protected readonly editOriginal = signal<TrainingEditDraft | null>(null);

  protected readonly failureCodes = FAILURE_CODES;

  protected readonly editOpen = computed(() => this.editRowId() !== null);

  protected readonly editValidation = computed(() => {
    const draft = this.editDraft();
    const id = this.editRowId();
    if (!draft || !id) return null;
    return validateTrainingRow(
      {
        sampleId: draft.sampleId,
        lockingTime: draft.lockingTime,
        failureMode: draft.failureMode ? draft.failureMode : null,
        confidence: draft.confidence,
        modelVersion: draft.modelVersion,
      },
      this.service.trainingRows(),
      id,
    );
  });

  protected readonly editMessages = computed<Record<string, string>>(() => {
    const validation = this.editValidation();
    const messages: Record<string, string> = {};
    if (!validation) return messages;
    if (validation.errors['sampleId']) {
      messages['sampleId'] = validation.errors['sampleId'];
    } else if (validation.duplicateSampleId) {
      messages['sampleId'] = 'Sample ID already exists in the loaded rows.';
    }
    if (validation.errors['lockingTime']) messages['lockingTime'] = validation.errors['lockingTime'];
    if (validation.errors['failureMode']) messages['failureMode'] = validation.errors['failureMode'];
    if (validation.errors['confidence']) messages['confidence'] = validation.errors['confidence'];
    if (validation.errors['modelVersion']) messages['modelVersion'] = validation.errors['modelVersion'];
    return messages;
  });

  protected readonly editHasErrors = computed(() => Object.keys(this.editMessages()).length > 0);

  protected readonly editChanged = computed(() => {
    const draft = this.editDraft();
    const original = this.editOriginal();
    if (!draft || !original) return false;
    return (
      draft.sampleId !== original.sampleId ||
      draft.lockingTime !== original.lockingTime ||
      draft.failureMode !== original.failureMode ||
      draft.corrected !== original.corrected ||
      draft.confidence !== original.confidence ||
      draft.modelVersion !== original.modelVersion
    );
  });

  protected readonly editCanSave = computed(
    () => this.editOpen() && this.editChanged() && !this.editHasErrors(),
  );

  protected readonly removeSelectedLabel = computed(
    () => `${this.trainingSelectedCount()} ${this.trainingSelectedCount() === 1 ? 'row' : 'rows'}`,
  );

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
    if (this.isImporting()) {
      this.service.cancelImport();
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isImporting()) {
      event.preventDefault();
    }
  }

  onTabChange(tab: ImportTab): void {
    if (tab !== 'playback' && this.playbackIsImporting()) {
      this.playbackImportModalOpen = false;
    }
    this.service.setTab(tab);
  }

  openPlaybackImport(): void {
    this.playbackImportModalOpen = true;
  }

  closePlaybackImport(): void {
    this.playbackImportModalOpen = false;
  }

  async onPlaybackImport(event: { batchId: string; files: File[] }): Promise<void> {
    await this.service.importPlayback(event.batchId, event.files);
    if (!this.playbackIsImporting()) {
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

  onRemovePlaybackItem(id: string): void {
    this.removePlaybackItemId = id;
    this.removePlaybackConfirmOpen = true;
  }

  confirmRemovePlaybackItem(): void {
    this.service.removePlaybackItem(this.removePlaybackItemId);
    this.removePlaybackConfirmOpen = false;
  }

  onDownloadPlaybackErrors(): void {
    this.service.downloadErrorReport('playback');
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
    this.service.downloadErrorReport('training');
  }

  onDownloadTemplate(): void {
    this.service.downloadTemplate();
  }

  onTrainingRemoveRow(id: string): void {
    this.service.removeRow(id);
  }

  onTrainingEditRow(id: string): void {
    const row = this.service.trainingRows().find((item) => item.id === id);
    if (!row) return;
    const draft: TrainingEditDraft = {
      sampleId: row.sampleId,
      lockingTime: toDateTimeLocalValue(row.lockingTime),
      failureMode: row.failureMode ?? '',
      corrected: row.corrected,
      confidence: row.confidence,
      modelVersion: row.modelVersion,
    };
    this.editOriginal.set(draft);
    this.editDraft.set(draft);
    this.editRowId.set(id);
  }

  onEditSampleIdChange(value: string): void {
    this.editDraft.update((draft) => (draft ? { ...draft, sampleId: value } : draft));
  }

  onEditLockingTimeChange(value: string): void {
    this.editDraft.update((draft) => (draft ? { ...draft, lockingTime: value } : draft));
  }

  onEditFailureModeChange(value: string): void {
    this.editDraft.update((draft) => (draft ? { ...draft, failureMode: value } : draft));
  }

  onEditCorrectedChange(value: boolean): void {
    this.editDraft.update((draft) => (draft ? { ...draft, corrected: value } : draft));
  }

  onEditConfidenceChange(value: string): void {
    const parsed = Number(value);
    this.editDraft.update((draft) =>
      draft ? { ...draft, confidence: Number.isFinite(parsed) ? parsed : Number.NaN } : draft,
    );
  }

  onEditModelVersionChange(value: string): void {
    this.editDraft.update((draft) => (draft ? { ...draft, modelVersion: value } : draft));
  }

  onEditSave(): void {
    const id = this.editRowId();
    const draft = this.editDraft();
    if (!id || !draft || !this.editCanSave()) return;
    const failureMode = draft.failureMode ? draft.failureMode : null;
    this.service.updateRow(id, {
      sampleId: draft.sampleId.trim(),
      lockingTime: fromDateTimeLocalValue(draft.lockingTime),
      failureMode,
      failureModeRaw: failureMode,
      corrected: draft.corrected,
      confidence: draft.confidence,
      modelVersion: draft.modelVersion.trim(),
    });
    this.closeEditModal();
  }

  onEditCancel(): void {
    if (this.editChanged()) {
      this.discardEditConfirmOpen = true;
      return;
    }
    this.closeEditModal();
  }

  confirmDiscardEdit(): void {
    this.discardEditConfirmOpen = false;
    this.closeEditModal();
  }

  closeEditModal(): void {
    this.editRowId.set(null);
    this.editDraft.set(null);
    this.editOriginal.set(null);
  }

  onClearTrainingSelection(): void {
    this.service.clearTrainingSelection();
  }

  onRemoveSelected(): void {
    this.removeSelectedConfirmOpen = true;
  }

  confirmRemoveSelected(): void {
    const ids = [...this.trainingSelectedIds()];
    this.service.removeRows(ids);
    this.removeSelectedConfirmOpen = false;
  }

  onClearAll(): void {
    this.clearAllConfirmOpen = true;
  }

  confirmClearAll(): void {
    this.service.clearAll();
    this.clearAllConfirmOpen = false;
  }

  onRemoveSource(fileName: string): void {
    this.removeSourceFileName = fileName;
    this.removeSourceConfirmOpen = true;
  }

  confirmRemoveSource(): void {
    this.service.removeSource(this.removeSourceFileName);
    this.removeSourceConfirmOpen = false;
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

  isKnownFailure(code: string): boolean {
    return isKnownFailureCode(code);
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
