import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-table-pagination',
  standalone: true,
  templateUrl: './table-pagination.component.html',
  styleUrl: './table-pagination.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablePaginationComponent {
  readonly totalCount = input.required<number>();
  readonly currentPage = input.required<number>();
  readonly pageSize = input.required<number>();

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly pageSizeOptions = [20, 50, 100];

  protected readonly pages = () => {
    const totalPages = Math.max(1, Math.ceil(this.totalCount() / this.pageSize()));
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  };

  protected readonly isFirstPage = () => this.currentPage() <= 1 || this.totalCount() === 0;
  protected readonly isLastPage = () => this.currentPage() >= Math.ceil(this.totalCount() / this.pageSize()) || this.totalCount() === 0;

  protected readonly from = () => {
    if (this.totalCount() === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  };

  protected readonly to = () => {
    if (this.totalCount() === 0) return 0;
    return Math.min(this.currentPage() * this.pageSize(), this.totalCount());
  };

  onPageSizeChange(event: Event) {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    this.pageSizeChange.emit(value);
  }
}
