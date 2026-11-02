import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { TorqueAnglePoint } from '../../data-access/monitoring.models';

interface ChartPoint {
  readonly x: number;
  readonly y: number;
}

interface ChartTick {
  readonly label: string;
  readonly position: number;
}

interface ChartGeometry {
  readonly points: readonly ChartPoint[];
  readonly xTicks: readonly ChartTick[];
  readonly yTicks: readonly ChartTick[];
  readonly linePath: string;
  readonly areaPath: string;
  readonly plotLeft: number;
  readonly plotRight: number;
  readonly plotTop: number;
  readonly plotBottom: number;
  readonly axisCenter: number;
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 280;
const PLOT_LEFT = 58;
const PLOT_RIGHT = 24;
const PLOT_TOP = 24;
const PLOT_BOTTOM = 48;

@Component({
  selector: 'app-torque-angle-chart',
  templateUrl: './torque-angle-chart.component.html',
  styleUrl: './torque-angle-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorqueAngleChartComponent {
  readonly points = input.required<readonly TorqueAnglePoint[]>();

  protected readonly geometry = computed<ChartGeometry>(() => {
    const data = this.points();
    const plotRight = CHART_WIDTH - PLOT_RIGHT;
    const plotBottom = CHART_HEIGHT - PLOT_BOTTOM;
    const plotTop = PLOT_TOP;
    const axisCenter = (plotTop + plotBottom) / 2;

    if (data.length === 0) {
      return {
        points: [],
        xTicks: [],
        yTicks: [],
        linePath: '',
        areaPath: '',
        plotLeft: PLOT_LEFT,
        plotRight,
        plotTop,
        plotBottom,
        axisCenter,
      };
    }

    const plotWidth = plotRight - PLOT_LEFT;
    const plotHeight = plotBottom - plotTop;
    const maxAngle = Math.max(...data.map((point) => point.angle));
    const maxTorque = Math.max(...data.map((point) => point.torque));
    const angleStep = maxAngle > 80 ? 20 : 10;
    const torqueStep = maxTorque > 10 ? 5 : maxTorque > 4 ? 2 : 1;
    const angleMax = Math.max(angleStep, Math.ceil(maxAngle / angleStep) * angleStep);
    const torqueMax = Math.max(torqueStep, Math.ceil(maxTorque / torqueStep) * torqueStep);

    const points = data.map((point) => ({
      x: PLOT_LEFT + (point.angle / angleMax) * plotWidth,
      y: plotTop + plotHeight - (point.torque / torqueMax) * plotHeight,
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

    const xTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      label: `${Math.round(angleMax * ratio)}`,
      position: PLOT_LEFT + plotWidth * ratio,
    }));

    const torqueSteps = torqueMax / torqueStep;
    const yTicks = Array.from({ length: torqueSteps + 1 }, (_, index) => ({
      label: `${torqueMax - index * torqueStep}`,
      position: plotTop + (index / torqueSteps) * plotHeight,
    }));

    return {
      points,
      xTicks,
      yTicks,
      linePath,
      areaPath,
      plotLeft: PLOT_LEFT,
      plotRight,
      plotTop,
      plotBottom,
      axisCenter,
    };
  });
}
