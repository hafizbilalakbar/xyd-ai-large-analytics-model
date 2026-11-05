import { ChangeDetectionStrategy, Component, computed, effect, input, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import * as echarts from 'echarts';
import type { HourlyTrendPoint } from '../../data-access/dashboard.models';

@Component({
  selector: 'app-hourly-trend-chart',
  templateUrl: './hourly-trend-chart.component.html',
  styleUrl: './hourly-trend-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HourlyTrendChartComponent implements AfterViewInit, OnDestroy {
  readonly points = input.required<readonly HourlyTrendPoint[]>();
  readonly loading = input(false);

  @ViewChild('chartContainer', { static: false }) readonly chartContainer!: ElementRef<HTMLDivElement>;

  private chartInstance: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  readonly chartOptions = computed(() => {
    const data = this.points();
    const hasData = data.length > 0;
    const maxCount = hasData ? Math.max(...data.map(p => p.count)) : 1000;
    const peak = hasData ? data.reduce((a, b) => (a.count > b.count ? a : b), data[0]) : null;
    const low = hasData ? data.reduce((a, b) => (a.count < b.count ? a : b), data[0]) : null;

    const prefersReducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    return {
      animation: !prefersReducedMotion,
      animationDuration: 1200,
      animationEasing: 'cubicOut',
      animationDurationUpdate: 800,
      animationEasingUpdate: 'cubicOut',
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 10,
        textStyle: { color: '#0f172a', fontSize: 13 },
        extraCssText: 'box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);',
        formatter: (params: any[]) => {
          const p = params[0];
          return `<div style="font-size:13px;color:#0f172a">${p.name}</div><div style="font-size:13px;font-weight:600;color:#2563eb">${p.value} locked items</div>`;
        },
      },
      grid: { left: 40, right: 30, top: 40, bottom: 50 },
      xAxis: {
        type: 'category',
        data: hasData ? data.map(p => p.hour) : [],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#64748b', fontSize: 12 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: maxCount > 0 ? maxCount : 100,
        minInterval: 1,
        splitLine: { show: true, lineStyle: { color: '#e2e8f0', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#64748b', fontSize: 12 },
      },
      series: hasData
        ? ([{
            name: 'Locked items',
            type: 'line',
            smooth: true,
            data: data.map(p => ({
              value: p.count,
              itemStyle: p === peak ? { color: '#16a34a' } : p === low ? { color: '#f59e0b' } : { color: '#2563eb' },
            })),
            itemStyle: { color: '#2563eb', borderWidth: 3 },
            lineStyle: { color: '#2563eb', width: 3 },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(37, 99, 235, 0.25)' },
                { offset: 1, color: 'rgba(37, 99, 235, 0)' },
              ]),
            },
            emphasis: {
              itemStyle: { borderWidth: 4, borderColor: '#2563eb' },
            },
          }] as unknown as echarts.SeriesOption[])
        : [],
    };
  });

  constructor() {
    effect(() => {
      if (this.chartInstance && !this.chartInstance.isDisposed()) {
        this.chartInstance.setOption(this.chartOptions() as echarts.EChartsOption, !this.chartInstance.isDisposed());
      }
    });
  }

  ngAfterViewInit(): void {
    const el = this.chartContainer.nativeElement;
    this.chartInstance = echarts.init(el, undefined, { renderer: 'svg' });
    this.chartInstance.setOption(this.chartOptions() as echarts.EChartsOption);
    window.addEventListener('resize', () => this.chartInstance?.resize());
    this.resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        this.chartInstance?.resize();
      });
    });
    this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', () => this.chartInstance?.resize());
    this.chartInstance?.dispose();
  }
}
