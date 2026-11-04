import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TablePaginationComponent } from '../../../sample-search/components/table-pagination/table-pagination.component';
import type { PlaybackCurveItem } from '../../data-access/data-import.models';

@Component({
  selector: 'app-playback-results-list',
  standalone: true,
  imports: [TablePaginationComponent],
  templateUrl: './playback-results-list.component.html',
  styleUrl: './playback-results-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaybackResultsListComponent {
  readonly items = input.required<PlaybackCurveItem[]>();
  readonly totalCount = input.required<number>();
  readonly currentPage = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly selectedId = input<string | null>(null);
  readonly search = input('');
  readonly filter = input<'all' | 'PASS' | 'FAIL' | 'Pending'>('all');
  readonly sort = input<'name' | 'time'>('time');

  readonly searchChange = output<string>();
  readonly filterChange = output<'all' | 'PASS' | 'FAIL' | 'Pending'>();
  readonly sortChange = output<'name' | 'time'>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly selectItem = output<string>();
}
