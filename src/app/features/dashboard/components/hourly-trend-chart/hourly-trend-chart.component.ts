import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import * as echarts from 'echarts';
import type { HourlyTrendPoint } from '../../data-access/dashboard.models';

@Component({
  selector: 'app-hourly-trend-chart',
  standalone: true,
  templateUrl: './hourly-trend-chart.component.html',
  styleUrl: './hourly-trend-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HourlyTrendChartComponent implements AfterViewInit, OnDestroy {
  readonly points = input.required<readonly HourlyTrendPoint[]>();
  readonly loading = input(false);

  @ViewChild('chartContainer', { static: false })
  readonly chartContainer!: ElementRef<HTMLDivElement>;

  private readonly width = signal(0);
  private chartInstance: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeFrame: number | null = null;

  readonly hasData = computed(() => this.points().some((point) => point.count > 0));

  private readonly labelInterval = computed(() => {
    const width = this.width();
    if (width > 0 && width < 480) {
      return 3;
    }
    if (width > 0 && width < 768) {
      return 1;
    }
    return 0;
  });

  private readonly axisFontSize = computed(() => {
    const width = this.width();
    return width > 0 && width < 480 ? 11 : 12;
  });

  readonly chartOptions = computed(() => {
    const data = this.points();
    const hasData = data.some((point) => point.count > 0);
    const maxCount = hasData ? Math.max(...data.map((point) => point.count)) : 0;
    const prefersReducedMotion =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    return {
      animation: !prefersReducedMotion,
      animationDuration: 700,
      animationEasing: 'cubicOut',
      animationDurationUpdate: 400,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        triggerOn: 'mousemove|click',
        confine: true,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 10,
        textStyle: { color: '#0f172a', fontSize: 12 },
        extraCssText: 'box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);',
        formatter: (params: unknown) => {
          const list = params as Array<{ name: string; value: number }>;
          const point = list[0];
          if (!point) {
            return '';
          }
          return `<div style="font-size:12px;color:#0f172a">${point.name}</div><div style="font-size:12px;font-weight:600;color:#2563eb">${point.value} locked items</div>`;
        },
      },
      grid: { left: 4, right: 12, top: 18, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.map((point) => point.hour),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#64748b',
          fontSize: this.axisFontSize(),
          interval: this.labelInterval(),
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: maxCount > 0 ? Math.ceil(maxCount * 1.15) : 10,
        minInterval: 1,
        splitNumber: 4,
        splitLine: { show: true, lineStyle: { color: '#e2e8f0', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#64748b',
          fontSize: this.axisFontSize(),
        },
      },
      series: hasData
        ? ([
            {
              name: 'Locked items',
              type: 'line',
              smooth: 0.35,
              showSymbol: true,
              symbol: 'circle',
              symbolSize: 6,
              data: data.map((point) => point.count),
              itemStyle: { color: '#2563eb', borderColor: '#ffffff', borderWidth: 2 },
              lineStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: '#2563eb' },
                  { offset: 1, color: '#7c3aed' },
                ]),
                width: 2.5,
              },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(37, 99, 235, 0.26)' },
                  { offset: 1, color: 'rgba(37, 99, 235, 0)' },
                ]),
              },
              emphasis: { focus: 'series', scale: 1.4 },
            },
          ] as unknown as echarts.SeriesOption[])
        : [],
    };
  });

  constructor() {
    effect(() => {
      const options = this.chartOptions();
      const hasData = this.hasData();
      if (!this.chartInstance || this.chartInstance.isDisposed()) {
        return;
      }
      if (!hasData) {
        this.chartInstance.clear();
        return;
      }
      this.chartInstance.setOption(options as echarts.EChartsOption);
    });
  }

  ngAfterViewInit(): void {
    const element = this.chartContainer.nativeElement;
    this.width.set(element.clientWidth);
    this.chartInstance = echarts.init(element, undefined, { renderer: 'svg' });
    if (this.hasData()) {
      this.chartInstance.setOption(this.chartOptions() as echarts.EChartsOption);
    }
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeFrame !== null) {
        cancelAnimationFrame(this.resizeFrame);
      }
      this.resizeFrame = requestAnimationFrame(() => {
        this.resizeFrame = null;
        this.width.set(element.clientWidth);
        this.chartInstance?.resize();
      });
    });
    this.resizeObserver.observe(element);
  }

  ngOnDestroy(): void {
    if (this.resizeFrame !== null) {
      cancelAnimationFrame(this.resizeFrame);
    }
    this.resizeObserver?.disconnect();
    this.chartInstance?.dispose();
  }
}
