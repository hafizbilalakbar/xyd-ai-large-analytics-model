import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { HourlyTrendPoint } from '../../data-access/dashboard.models';

interface TrendPoint {
  readonly hour: string;
  readonly count: number;
  readonly x: number;
  readonly y: number;
}

interface TrendTick {
  readonly value: number;
  readonly y: number;
}

interface TrendGeometry {
  readonly points: readonly TrendPoint[];
  readonly ticks: readonly TrendTick[];
  readonly linePath: string;
  readonly areaPath: string;
  readonly plotLeft: number;
  readonly plotRight: number;
  readonly plotBottom: number;
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 260;
const PLOT_LEFT = 56;
const PLOT_RIGHT = 24;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 40;

@Component({
  selector: 'app-hourly-trend-chart',
  templateUrl: './hourly-trend-chart.component.html',
  styleUrl: './hourly-trend-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HourlyTrendChartComponent {
  readonly points = input.required<readonly HourlyTrendPoint[]>();

  protected readonly geometry = computed<TrendGeometry>(() => {
    const data = this.points();
    const plotRight = CHART_WIDTH - PLOT_RIGHT;
    const plotBottom = CHART_HEIGHT - PLOT_BOTTOM;

    if (data.length === 0) {
      return {
        points: [],
        ticks: [],
        linePath: '',
        areaPath: '',
        plotLeft: PLOT_LEFT,
        plotRight,
        plotBottom,
      };
    }

    const plotWidth = plotRight - PLOT_LEFT;
    const plotHeight = plotBottom - PLOT_TOP;
    const peak = Math.max(...data.map((point) => point.count));
    const step = peak > 1500 ? 500 : peak > 800 ? 250 : 100;
    const maxValue = Math.max(step, Math.ceil(peak / step) * step);

    const points = data.map((point, index) => ({
      hour: point.hour,
      count: point.count,
      x: PLOT_LEFT + (index * plotWidth) / Math.max(data.length - 1, 1),
      y: PLOT_TOP + plotHeight - (point.count / maxValue) * plotHeight,
    }));

    const linePath = points
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
      )
      .join(' ');
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const areaPath = `${linePath} L ${lastPoint.x.toFixed(1)} ${plotBottom} L ${firstPoint.x.toFixed(1)} ${plotBottom} Z`;

    const ticks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
      value: Math.round(maxValue * ratio),
      y: PLOT_TOP + plotHeight * (1 - ratio),
    }));

    return { points, ticks, linePath, areaPath, plotLeft: PLOT_LEFT, plotRight, plotBottom };
  });
}
