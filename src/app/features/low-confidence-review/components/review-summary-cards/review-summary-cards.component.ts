import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-review-summary-cards',
  standalone: true,
  templateUrl: './review-summary-cards.component.html',
  styleUrl: './review-summary-cards.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewSummaryCardsComponent {
  readonly pendingCount = input.required<number>();
  readonly reviewedCount = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly completionRate = input.required<number>();
  readonly threshold = input.required<number>();
}
