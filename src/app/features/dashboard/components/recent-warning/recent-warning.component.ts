import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { Alarm } from '../../data-access/dashboard.models';

type AlarmType = Alarm['type'];

const TYPE_META: Record<AlarmType, { label: string; color: string }> = {
  storage: { label: 'Storage', color: '#dc2626' },
  model: { label: 'Model', color: '#7c3aed' },
  training: { label: 'Training', color: '#f59e0b' },
  export: { label: 'Export', color: '#2563eb' },
};

const MONITORING_RANGE: readonly { type: AlarmType; label: string; color: string }[] = [
  { type: 'storage', label: 'Storage: Insufficient disk space/critical', color: '#dc2626' },
  { type: 'model', label: 'Model: Loading failed', color: '#7c3aed' },
  { type: 'training', label: 'Training: Mission Failed', color: '#f59e0b' },
  { type: 'export', label: 'Export: Archive verification failed.', color: '#2563eb' },
];

@Component({
  selector: 'app-recent-warning',
  standalone: true,
  templateUrl: './recent-warning.component.html',
  styleUrl: './recent-warning.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentWarningComponent {
  readonly alarms = input.required<readonly Alarm[]>();
  readonly loading = input(false);
  readonly markRead = output<number>();
  readonly remove = output<number>();

  readonly monitoringRange = MONITORING_RANGE;
  readonly activeType = signal<AlarmType | null>(null);

  readonly sortedAlarms = computed(() =>
    [...this.alarms()].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 10),
  );

  readonly hasAlarms = computed(() => this.sortedAlarms().length > 0);

  readonly alarmRows = computed(() => {
    const active = this.activeType();
    return this.sortedAlarms()
      .filter((alarm) => active === null || alarm.type === active)
      .map((alarm) => {
        const meta = TYPE_META[alarm.type];
        return {
          ...alarm,
          typeName: meta.label,
          typeColor: meta.color,
        };
      });
  });

  onMarkRead(id: number): void {
    this.markRead.emit(id);
  }

  onRemove(id: number): void {
    this.remove.emit(id);
  }

  toggleType(type: AlarmType): void {
    this.activeType.update((current) => (current === type ? null : type));
  }
}
