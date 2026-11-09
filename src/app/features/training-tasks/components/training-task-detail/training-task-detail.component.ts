import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ModelVersionService } from '../../../../shared/services/model-version.service';
import {
  TrainingJob,
  formatAccuracy,
  formatTrainingDate,
  formatTrainingDuration,
  isActiveTrainingStatus,
  trainingEvaluationModeLabel,
  trainingScopeLabel,
  trainingStatusLabel,
} from '../../data-access/training-task.models';

@Component({
  selector: 'app-training-task-detail',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './training-task-detail.component.html',
  styleUrl: './training-task-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingTaskDetailComponent {
  readonly open = input.required<boolean>();
  readonly job = input<TrainingJob | null>(null);
  readonly cancelling = input(false);

  private readonly modelVersions = inject(ModelVersionService);

  readonly close = output<void>();
  readonly cancelTask = output<string>();
  readonly goToVersions = output<void>();

  readonly metrics = computed(() => this.job()?.metrics ?? null);

  readonly perClass = computed<[string, number][]>(() => {
    const metrics = this.metrics();
    if (!metrics?.per_class) {
      return [];
    }
    return Object.entries(metrics.per_class).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number',
    );
  });

  readonly canCancel = computed(() => {
    const job = this.job();
    return job !== null && isActiveTrainingStatus(job.status);
  });

  readonly showFooter = computed(() => {
    const job = this.job();
    return job !== null && (isActiveTrainingStatus(job.status) || job.status === 'done');
  });

  readonly statusText = computed(() => {
    const job = this.job();
    if (!job) {
      return '—';
    }
    const label = trainingStatusLabel(job.status);
    return job.status === 'running' ? `${label}, ${job.progress}%` : label;
  });

  readonly outputVersion = computed(() => {
    const job = this.job();
    if (!job) {
      return '—';
    }
    if (!job.model_version) {
      return job.model_version_id ? 'Produced' : '(Not yet produced)';
    }
    const exists = this.modelVersions.findByVersion(job.model_version) !== null;
    if (!exists) {
      return `${job.model_version} (Version deleted)`;
    }
    return job.model_version;
  });

  readonly logText = computed(() => this.job()?.log_summary || '(No logs available.)');

  protected readonly formatAccuracy = formatAccuracy;
  protected readonly formatTrainingDate = formatTrainingDate;
  protected readonly formatTrainingDuration = formatTrainingDuration;
  protected readonly trainingScopeLabel = trainingScopeLabel;
  protected readonly trainingEvaluationModeLabel = trainingEvaluationModeLabel;
}
