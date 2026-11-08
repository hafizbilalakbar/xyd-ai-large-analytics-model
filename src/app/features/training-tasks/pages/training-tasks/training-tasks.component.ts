import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { TrainingTaskDetailComponent } from '../../components/training-task-detail/training-task-detail.component';
import { TrainingTaskConfirmComponent } from '../../components/training-task-confirm/training-task-confirm.component';
import { TrainingTasksService } from '../../data-access/training-tasks.service';
import {
  TrainingJob,
  formatTrainingDate,
  formatTrainingDuration,
  isActiveTrainingStatus,
  trainingScopeLabel,
  trainingStatusLabel,
} from '../../data-access/training-task.models';

@Component({
  selector: 'app-training-tasks',
  standalone: true,
  imports: [
    PageHeaderComponent,
    IconComponent,
    TrainingTaskConfirmComponent,
    TrainingTaskDetailComponent,
  ],
  templateUrl: './training-tasks.component.html',
  styleUrl: './training-tasks.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingTasksComponent implements OnInit, OnDestroy {
  private readonly service = inject(TrainingTasksService);
  private readonly router = inject(Router);

  readonly preview = this.service.preview;
  readonly jobs = this.service.jobs;
  readonly listState = this.service.listState;
  readonly isPreviewLoading = this.service.isPreviewLoading;
  readonly loadError = this.service.loadError;
  readonly traceId = this.service.traceId;
  readonly isStarting = this.service.isStarting;
  readonly cancellingTaskId = this.service.cancellingTaskId;
  readonly detail = this.service.detail;
  readonly detailOpen = this.service.detailOpen;
  readonly confirmOpen = this.service.confirmOpen;
  readonly activeVersion = this.service.activeVersion;
  readonly canStart = this.service.canStart;
  readonly startLabel = this.service.startLabel;

  readonly skeletonTiles = [0, 1, 2];
  readonly skeletonRows = [0, 1, 2, 3, 4];

  readonly thisRunText = computed(() => {
    const data = this.preview();
    if (!data) {
      return '';
    }
    return `This training uses ${data.sample_count} samples (base ${data.base_sample_count}, local ${data.local_total})`;
  });

  readonly cancellingDetail = computed(() => {
    const data = this.detail();
    if (!data) {
      return false;
    }
    return this.cancellingTaskId() === data.task_id;
  });

  ngOnInit(): void {
    void this.service.load();
  }

  ngOnDestroy(): void {
    this.service.destroy();
  }

  onCreate(): void {
    this.service.openConfirm();
  }

  onCloseConfirm(): void {
    this.service.closeConfirm();
  }

  onConfirmStart(): void {
    void this.service.startTraining();
  }

  onViewDetails(taskId: string): void {
    void this.service.openDetail(taskId);
  }

  onCancelTask(taskId: string): void {
    void this.service.cancelTask(taskId);
  }

  onCloseDetail(): void {
    this.service.closeDetail();
  }

  onGoVersions(): void {
    this.service.closeDetail();
    void this.router.navigate(['/version-management']);
  }

  onRetry(): void {
    this.service.retry();
  }

  isActive(job: TrainingJob): boolean {
    return isActiveTrainingStatus(job.status);
  }

  isDone(job: TrainingJob): boolean {
    return job.status === 'done';
  }

  isCancelling(taskId: string): boolean {
    return this.cancellingTaskId() === taskId;
  }

  protected readonly formatTrainingDate = formatTrainingDate;
  protected readonly formatTrainingDuration = formatTrainingDuration;
  protected readonly trainingScopeLabel = trainingScopeLabel;
  protected readonly trainingStatusLabel = trainingStatusLabel;
}
