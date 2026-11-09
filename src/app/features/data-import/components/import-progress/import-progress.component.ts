import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-import-progress',
  standalone: true,
  templateUrl: './import-progress.component.html',
  styleUrl: './import-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportProgressComponent {
  readonly fileName = input<string>('');
  readonly stage = input<string>('');
  readonly percent = input.required<number>();
  readonly elapsedMs = input<number>(0);
  readonly status = input<string>('reading');

  readonly cancel = output<void>();

  protected readonly formattedElapsed = () => {
    const ms = this.elapsedMs();
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  protected readonly stages = () => [
    { key: 'reading', label: 'Reading file' },
    { key: 'extracting', label: 'Extracting files' },
    { key: 'detecting', label: 'Detecting format' },
    { key: 'parsing', label: 'Parsing' },
    { key: 'validating', label: 'Validating' },
    { key: 'saving', label: 'Saving' },
  ];
}
