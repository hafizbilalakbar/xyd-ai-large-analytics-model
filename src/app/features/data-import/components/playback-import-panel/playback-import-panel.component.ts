import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FileDropzoneComponent } from '../file-dropzone/file-dropzone.component';
import { PlaybackResultsListComponent } from '../playback-results-list/playback-results-list.component';
import { CurveViewerComponent } from '../curve-viewer/curve-viewer.component';
import type { PlaybackCurveItem } from '../../data-access/data-import.models';

@Component({
  selector: 'app-playback-import-panel',
  standalone: true,
  imports: [
    FileDropzoneComponent,
    PlaybackResultsListComponent,
    CurveViewerComponent,
  ],
  templateUrl: './playback-import-panel.component.html',
  styleUrl: './playback-import-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaybackImportPanelComponent {
  readonly items = input.required<PlaybackCurveItem[]>();
  readonly selectedItem = input<PlaybackCurveItem | null>(null);
  readonly allCount = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly currentPage = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly search = input('');
  readonly filter = input<'all' | 'PASS' | 'FAIL' | 'Pending'>('all');
  readonly sort = input<'name' | 'time'>('time');
  readonly counts = input.required<{ total: number; pass: number; fail: number; warning: number }>();
  readonly hasErrors = input(false);

  readonly importClick = output<void>();
  readonly fileDrop = output<File[]>();
  readonly searchChange = output<string>();
  readonly filterChange = output<'all' | 'PASS' | 'FAIL' | 'Pending'>();
  readonly sortChange = output<'name' | 'time'>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly selectItem = output<string>();
  readonly clear = output<void>();
  readonly downloadErrors = output<void>();
  readonly previous = output<void>();
  readonly next = output<void>();
  readonly reJudge = output<void>();
  readonly cancelImport = output<void>();
}
