import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { PlaybackCurveItem } from '../../data-access/data-import.models';

interface ChartPoint {
  readonly x: number;
  readonly y: number;
}

interface ChartGeometry {
  readonly points: readonly ChartPoint[];
  readonly linePath: string;
  readonly areaPath: string;
  readonly xTicks: readonly { label: string; x: number }[];
  readonly yTicks: readonly { label: string; y: number }[];
  readonly hoverX: number | null;
  readonly hoverPoint: ChartPoint | null;
}

const WIDTH = 640;
const HEIGHT = 280;
const PLOT_LEFT = 56;
const PLOT_RIGHT = 24;
const PLOT_TOP = 24;
const PLOT_BOTTOM = 48;

@Component({
  selector: 'app-curve-viewer',
  standalone: true,
  templateUrl: './curve-viewer.component.html',
  styleUrl: './curve-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurveViewerComponent {
  readonly item = input.required<PlaybackCurveItem>();

  readonly previous = output<void>();
  readonly next = output<void>();
  readonly reJudge = output<void>();

  protected readonly geometry = computed<ChartGeometry>(() => {
    const data = this.item().curve;
    const plotRight = WIDTH - PLOT_RIGHT;
    const plotBottom = HEIGHT - PLOT_BOTTOM;
    const plotWidth = plotRight - PLOT_LEFT;
    const plotHeight = plotBottom - PLOT_TOP;

    if (data.length === 0) {
      return {
        points: [],
        linePath: '',
        areaPath: '',
        xTicks: [],
        yTicks: [],
        hoverX: null,
        hoverPoint: null,
      };
    }

    const maxAngle = Math.max(...data.map((p) => p.angle), 1);
    const maxTorque = Math.max(...data.map((p) => p.torque), 1);
    const points = data.map((p) => ({
      x: PLOT_LEFT + (p.angle / maxAngle) * plotWidth,
      y: plotBottom - (p.torque / maxTorque) * plotHeight,
    }));

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const first = points[0];
    const last = points[points.length - 1];
    const areaPath = `${linePath} L ${last.x.toFixed(1)} ${plotBottom} L ${first.x.toFixed(1)} ${plotBottom} Z`;

    const xTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      label: `${Math.round(maxAngle * ratio)}`,
      x: PLOT_LEFT + plotWidth * ratio,
    }));

    const yStep = maxTorque > 10 ? 5 : maxTorque > 4 ? 2 : 1;
    const yMax = Math.max(yStep, Math.ceil(maxTorque / yStep) * yStep);
    const steps = yMax / yStep;
    const yTicks = Array.from({ length: steps + 1 }, (_, i) => ({
      label: `${(yMax - i * yStep).toFixed(1)}`,
      y: PLOT_TOP + (i / steps) * plotHeight,
    }));

    return { points, linePath, areaPath, xTicks, yTicks, hoverX: null, hoverPoint: null };
  });

  protected readonly hoverState = {
    x: 0,
    y: 0,
    visible: false,
    angle: 0,
    torque: 0,
  };

  onMouseMove(event: MouseEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const x = (event.clientX - rect.left) * scaleX;
    const data = this.item().curve;
    const plotRight = WIDTH - PLOT_RIGHT;
    const plotWidth = plotRight - PLOT_LEFT;
    const maxAngle = Math.max(...data.map((p) => p.angle), 1);
    const angle = ((x - PLOT_LEFT) / plotWidth) * maxAngle;
    const closest = data.reduce((best, p) =>
      Math.abs(p.angle - angle) < Math.abs(best.angle - angle) ? p : best,
    );
    this.hoverState.x = event.clientX - rect.left;
    this.hoverState.y = event.clientY - rect.top;
    this.hoverState.visible = true;
    this.hoverState.angle = closest.angle;
    this.hoverState.torque = closest.torque;
  }

  onMouseLeave(): void {
    this.hoverState.visible = false;
  }
}
