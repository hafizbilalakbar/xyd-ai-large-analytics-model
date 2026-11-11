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
import * as echarts from 'echarts';
import { use } from 'echarts/core';
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

  private chart: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastDataJson: string | null = null;
  private lastRect: { width: number; height: number } | null = null;

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

    // Watch points; re-render when data changes
    effect(() => {
      const pts = this.points();
      const json = JSON.stringify(pts);
      if (this.chart && json !== this.lastDataJson && pts.length > 0) {
        this.lastDataJson = json;
        this.render();
      }
    });
  }

  ngAfterViewInit(): void {
    // Container is always in DOM now. Wait one tick for layout, then init.
    setTimeout(() => this.initChart(), 0);
  }

  private initChart(): void {
    const container = this.el.nativeElement.querySelector(
      '.chart__ec-container',
    ) as HTMLElement | null;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      // Container has no size yet; retry on next tick
      setTimeout(() => this.initChart(), 0);
      return;
    }
    this.zone.runOutsideAngular(() => {
      // Only init if not already initialized
      if (!this.chart) {
        this.chart = echarts.init(container, null, {
          renderer: 'canvas',
          width: rect.width,
          height: rect.height,
        });
      }
      if (!this.resizeObserver) {
        this.createResizeObserver(container);
      }
      this.chart.showLoading({
        color: '#2563eb',
        textColor: '#0f172a',
        maskColor: 'rgba(255, 255, 255, 0.8)',
      });
      const pts = this.points();
      if (pts.length > 0) {
        this.render();
      }
    });
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
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container && this.chart) {
          const rect = container.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.width !== this.lastRect?.width && rect.height !== this.lastRect?.height) {
            this.lastRect = { width: rect.width, height: rect.height };
            this.zone.runOutsideAngular(() => {
              // Chart is guaranteed non-null by the guard condition above
              this.chart!.resize({ width: rect.width, height: rect.height });
            });
          }
        }
      }
    });
    this.resizeObserver.observe(container);
  }

  private buildOption(
    pts: readonly TorqueAnglePoint[],
    reducedMotion: boolean,
    lastPoint: TorqueAnglePoint | undefined,
  ): echarts.EChartsOption {
    const maxAngle = Math.max(...pts.map((p) => p.angle));
    const maxTorque = Math.max(...pts.map((p) => p.torque));
    // Use evenly spaced numeric axis: 0, 20, 40, 60, 80 - cover full width
    const angleStep = 20;
    const angleMax = Math.max(angleStep, Math.ceil(maxAngle / angleStep) * angleStep);
    const torqueStep = maxTorque > 10 ? 5 : maxTorque > 4 ? 2 : 1;
    const torqueMax = Math.max(torqueStep, Math.ceil(maxTorque / torqueStep) * torqueStep);

    const seriesData = pts.map((p) => [p.angle, p.torque] as [number, number]);

    const isMobile = window.innerWidth < 640;
    const symbolSize = reducedMotion || isMobile ? 4 : 6;
    const lineWidth = reducedMotion || isMobile ? 1.5 : 2.5;

    return {
      animation: !reducedMotion,
      animationDuration: reducedMotion ? 0 : 800,
      animationDurationUpdate: reducedMotion ? 0 : 400,
      animationEasing: reducedMotion ? 'linear' : 'cubicOut',
      animationEasingUpdate: reducedMotion ? 'linear' : 'cubicInOut',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { show: false } },
        confine: true,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#0f172a', fontSize: reducedMotion || isMobile ? 10 : 12 },
        extraCssText: 'box-shadow: 0 4px 12px rgb(15 23 42 / 8%);',
        formatter: (params: unknown) => {
          const item = Array.isArray(params) ? params[0] : params;
          const data = (item as { data?: [number, number] } | null)?.data;
          if (!data) return '';
          return `Torque: ${data[1].toFixed(2)} N·m`;
        },
      },
      grid: {
        left: reducedMotion || isMobile ? 8 : 16,
        right: reducedMotion || isMobile ? 12 : 24,
        top: reducedMotion || isMobile ? 24 : 28,
        bottom: reducedMotion || isMobile ? 24 : 28,
        // Show only horizontal dashed grid lines, no vertical lines
        borderColor: '#e2e8f0',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: 'Angle (°)',
        nameLocation: 'middle',
        nameGap: reducedMotion || isMobile ? 32 : 40,
        nameTextStyle: {
          fontSize: reducedMotion || isMobile ? 11 : 12,
          color: '#64748b',
          padding: [28, 0, 0, 0],
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        axisLabel: { fontSize: reducedMotion || isMobile ? 10 : 12, color: '#64748b' },
        // Only show horizontal dashed split lines, no vertical
        splitLine: { show: false },
        min: 0,
        max: angleMax,
        // Use evenly spaced numeric ticks: 0, 20, 40, 60, 80
        interval: 20,
        boundaryGap: [0, 0],
      },
      yAxis: {
        type: 'value',
        name: 'Torque (N·m)',
        nameLocation: 'middle',
        nameGap: reducedMotion || isMobile ? 32 : 40,
        nameTextStyle: {
          fontSize: reducedMotion || isMobile ? 11 : 12,
          color: '#64748b',
          padding: [0, 0, 0, 14],
        },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        axisLabel: { fontSize: reducedMotion || isMobile ? 10 : 12, color: '#64748b' },
        splitLine: {
          show: true,
          lineStyle: { type: 'dashed', color: '#e8edf5' },
        },
        min: 0,
        max: torqueMax,
        // Use evenly spaced numeric ticks: 0, 3, 6, 9, 12, 15
        interval: 3,
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
                      show: false,
                      // Marker only - no text label to avoid overlap
                      formatter: '',
                      offset: [0, -10],
                    },
                  },
                ],
              }
            : undefined,
        },
      ],
    };
  }
}
