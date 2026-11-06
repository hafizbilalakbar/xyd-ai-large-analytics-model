import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 5;

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

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  protected readonly totalPages = () => Math.max(1, Math.ceil(this.totalCount() / this.pageSize()));

  protected readonly pages = () => {
    const total = this.totalPages();
    const pages: number[] = [];
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
    return pages;
  };

  protected readonly displayedPages = () => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => ({ value: i + 1, ellipsis: false }));
    }
    const items: { value: number | string; ellipsis: boolean }[] = [];
    const push = (value: number | string) => {
      if (items.length === 0 || items[items.length - 1].value !== value) {
        items.push({ value, ellipsis: typeof value === 'string' });
      }
    };
    push(1);
    if (current > 3) push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) push(i);
    if (current < total - 2) push('...');
    push(total);
    return items;
  };

  protected readonly isFirstPage = () => this.currentPage() <= 1 || this.totalCount() === 0;
  protected readonly isLastPage = () => this.currentPage() >= this.totalPages() || this.totalCount() === 0;

  protected readonly from = () => {
    if (this.totalCount() === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  };

  protected readonly to = () => {
    if (this.totalCount() === 0) return 0;
    return Math.min(this.currentPage() * this.pageSize(), this.totalCount());
  };

  constructor() {
    effect(() => {
      const total = this.totalPages();
      const current = this.currentPage();
      if (current > total) {
        this.pageChange.emit(total);
      }
    });
  }

  onPageSizeChange(event: Event) {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    this.pageSizeChange.emit(value);
    this.pageChange.emit(1);
  }

  goToPage(page: number | string): void {
    this.pageChange.emit(Number(page));
  }
}
