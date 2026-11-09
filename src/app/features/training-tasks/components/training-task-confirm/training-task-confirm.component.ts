import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TrainingPreview } from '../../data-access/training-task.models';

@Component({
  selector: 'app-training-task-confirm',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './training-task-confirm.component.html',
  styleUrl: './training-task-confirm.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingTaskConfirmComponent {
  readonly open = input.required<boolean>();
  readonly preview = input<TrainingPreview | null>(null);
  readonly loading = input(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();
}
