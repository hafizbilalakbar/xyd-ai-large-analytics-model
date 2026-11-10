import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  NgZone,
} from '@angular/core';
import { init, use, type ECharts, type EChartsCoreOption } from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent]);

interface TorqueAnglePoint {
  readonly angle: number;
  readonly torque: number;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

@Component({
  selector: 'app-torque-angle-chart',
  templateUrl: './torque-angle-chart.component.html',
  styleUrl: './torque-angle-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class TorqueAngleChartComponent implements AfterViewInit {
  readonly points = input.required<readonly TorqueAnglePoint[]>();

  private readonly el = inject(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private chart: ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.zone.runOutsideAngular(() => {
        if (this.resizeObserver) {
          this.resizeObserver.disconnect();
          this.resizeObserver = null;
        }
        if (this.chart) {
          this.chart.dispose();
          this.chart = null;
        }
      });
    });

    effect(() => {
      const pts = this.points();
      const container = this.el.nativeElement.querySelector(
        '.chart__ec-container',
      ) as HTMLElement | null;

      if (!container) {
        return;
      }

      if (!this.chart && pts.length > 0) {
        this.zone.runOutsideAngular(() => {
          this.chart = init(container, null, {
            renderer: 'canvas',
            width: '100%',
            height: '100%',
          });
          this.createResizeObserver(container);
          this.chart.showLoading({
            color: '#2563eb',
            textColor: '#0f172a',
            maskColor: 'rgba(255, 255, 255, 0.8)',
          });
        });
      }

      if (this.chart && pts.length > 0) {
        this.render();
      }
    });
  }

  ngAfterViewInit(): void {
    // Chart initialization is handled by the effect which watches for
    // both the container's existence and the points data.
  }

  private render(): void {
    const pts = this.points();
    if (!this.chart || pts.length === 0) {
      return;
    }

    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    const lastPoint = pts[pts.length - 1];

    const option = this.buildOption(pts, reducedMotion, lastPoint);
    const chart = this.chart;

    this.zone.runOutsideAngular(() => {
      chart.hideLoading();
      chart.setOption(option, !reducedMotion);
    });
  }

  private createResizeObserver(container: HTMLElement): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container && this.chart) {
          const chart = this.chart;
          this.zone.runOutsideAngular(() => {
            chart.resize();
          });
        }
      }
    });
    this.resizeObserver.observe(container);
  }

  private buildOption(
    pts: readonly TorqueAnglePoint[],
    reducedMotion: boolean,
    lastPoint: TorqueAnglePoint | undefined,
  ): EChartsCoreOption {
    const maxAngle = Math.max(...pts.map((p) => p.angle));
    const maxTorque = Math.max(...pts.map((p) => p.torque));
    const angleStep = maxAngle > 80 ? 20 : 10;
    const torqueStep = maxTorque > 10 ? 5 : maxTorque > 4 ? 2 : 1;
    const angleMax = Math.max(angleStep, Math.ceil(maxAngle / angleStep) * angleStep);
    const torqueMax = Math.max(torqueStep, Math.ceil(maxTorque / torqueStep) * torqueStep);

    const seriesData = pts.map((p) => [p.angle, p.torque] as [number, number]);

    const isMobile = window.innerWidth < 640;
    const symbolSize = reducedMotion || isMobile ? 4 : 6;
    const lineWidth = reducedMotion || isMobile ? 1.5 : 2.5;

    const option: EChartsCoreOption = {
      animation: !reducedMotion,
      animationDuration: reducedMotion ? 0 : 1200,
      animationDurationUpdate: reducedMotion ? 0 : 600,
      animationEasing: reducedMotion ? 'linear' : 'cubicOut',
      animationEasingUpdate: reducedMotion ? 'linear' : 'cubicInOut',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        confine: true,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#0f172a', fontSize: reducedMotion || isMobile ? 10 : 12 },
        extraCssText:
          'box-shadow: 0 4px 12px rgb(15 23 42 / 8%);',
        formatter: (params: unknown) => {
          const item = Array.isArray(params) ? params[0] : params;
          const data = (item as { data?: [number, number] } | null)?.data;
          if (!data) {
            return '';
          }
          return `Angle: ${data[0].toFixed(1)}°<br/>Torque: ${data[1].toFixed(2)} N·m`;
        },
      },
      grid: {
        left: reducedMotion || isMobile ? 44 : 56,
        right: reducedMotion || isMobile ? 12 : 28,
        top: reducedMotion || isMobile ? 16 : 24,
        bottom: reducedMotion || isMobile ? 46 : 70,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        name: 'Angle (°)',
        nameLocation: 'middle',
        nameTextStyle: {
          fontSize: reducedMotion || isMobile ? 9 : 11,
          color: '#64748b',
          padding: [10, 0, 0, 0],
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        axisLabel: { fontSize: reducedMotion || isMobile ? 9 : 11, color: '#64748b' },
        splitLine: { show: true, lineStyle: { type: 'dashed', color: '#e8edf5' } },
        min: 0,
        max: angleMax,
        data: pts.map((p) => p.angle),
      },
      yAxis: {
        type: 'value',
        name: 'Torque (N·m)',
        nameLocation: 'middle',
        nameTextStyle: {
          fontSize: reducedMotion || isMobile ? 9 : 11,
          color: '#64748b',
          padding: [0, 0, 0, 10],
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        axisLabel: { fontSize: reducedMotion || isMobile ? 9 : 11, color: '#64748b' },
        splitLine: { show: true, lineStyle: { type: 'dashed', color: '#e8edf5' } },
        min: 0,
        max: torqueMax,
      },
      series: [
        {
          type: 'line',
          data: seriesData,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: symbolSize,
          itemStyle: {
            color: '#2563eb',
            borderColor: '#ffffff',
            borderWidth: 2,
          },
          lineStyle: { color: '#2563eb', width: lineWidth },
          areaStyle: { color: 'rgba(37, 99, 235, 0.08)' },
          markPoint: lastPoint
            ? {
                data: [
                  {
                    type: 'max',
                    name: 'Latest',
                    value: lastPoint.torque,
                    itemStyle: {
                      color: '#2563eb',
                      borderColor: '#ffffff',
                      borderWidth: 2,
                    },
                    label: {
                      show: true,
                      formatter: `Latest: ${lastPoint.torque.toFixed(2)} N·m @ ${lastPoint.angle.toFixed(1)}°`,
                    },
                  },
                ],
              }
            : undefined,
        },
      ],
    };

    return option;
  }
}
