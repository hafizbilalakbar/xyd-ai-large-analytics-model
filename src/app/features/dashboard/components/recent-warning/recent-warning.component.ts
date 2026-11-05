import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { Alarm } from '../../data-access/dashboard.models';

type AlarmTypeLabel = Record<string, { label: string; color: string }>;

const TYPE_LABELS: AlarmTypeLabel = {
  storage: { label: 'Storage', color: '#dc2626' },
  model: { label: 'Model', color: '#7c3aed' },
  training: { label: 'Training', color: '#f59e0b' },
  export: { label: 'Export', color: '#2563eb' },
};

@Component({
  selector: 'app-recent-warning',
  templateUrl: './recent-warning.component.html',
  styleUrl: './recent-warning.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentWarningComponent {
  readonly alarms = input.required<readonly Alarm[]>();
  readonly loading = input(false);
  readonly markRead = output<number>();
  readonly remove = output<number>();

  onMarkRead(id: number): void {
    this.markRead.emit(id);
  }

  onRemove(id: number): void {
    this.remove.emit(id);
  }

  readonly monitoringRange = signal([
    { label: 'Storage: Insufficient disk space/critical', color: '#dc2626' },
    { label: 'Model: Loading failed', color: '#7c3aed' },
    { label: 'Training: Mission Failed', color: '#f59e0b' },
    { label: 'Export: Archive verification failed.', color: '#2563eb' },
  ]);

  readonly sortedAlarms = computed(() => {
    return [...this.alarms()].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 10);
  });

  typeLabel(type: string): string {
    return TYPE_LABELS[type]?.label ?? type;
  }

  typeColor(type: string): string {
    return TYPE_LABELS[type]?.color ?? '#64748b';
  }
}
