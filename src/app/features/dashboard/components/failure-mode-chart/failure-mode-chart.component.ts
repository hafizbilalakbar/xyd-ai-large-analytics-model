import { ChangeDetectionStrategy, Component, computed, effect, input, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import * as echarts from 'echarts';
import type { FailureMode } from '../../data-access/dashboard.models';

@Component({
  selector: 'app-failure-mode-chart',
  templateUrl: './failure-mode-chart.component.html',
  styleUrl: './failure-mode-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FailureModeChartComponent implements AfterViewInit, OnDestroy {
  readonly modes = input.required<readonly FailureMode[]>();
  readonly loading = input(false);

  readonly total = computed(() =>
    this.modes().reduce((sum, m) => sum + m.count, 0),
  );

  @ViewChild('chartContainer', { static: false }) readonly chartContainer!: ElementRef<HTMLDivElement>;

  private chartInstance: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  readonly chartOptions = computed(() => {
    const data = this.modes();
    const total = data.reduce((sum, m) => sum + m.count, 0);
    const hasData = data.length > 0;

    const prefersReducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    const colorMap: Record<string, string> = {
      blue: '#2563eb',
      amber: '#f59e0b',
      red: '#dc2626',
      violet: '#7c3aed',
      slate: '#94a3b8',
    };

    return {
      animation: !prefersReducedMotion,
      animationDuration: 1200,
      animationEasing: 'cubicOut',
      animationDurationUpdate: 800,
      animationEasingUpdate: 'cubicOut',
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 10,
        textStyle: { color: '#0f172a', fontSize: 13 },
        extraCssText: 'box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);',
        formatter: (params: any) => {
          const pct = total > 0 ? ((params.value / total) * 100).toFixed(1) : '0';
          return `<div style="font-size:13px;color:#0f172a">${params.name}</div><div style="font-size:13px;font-weight:600;color:#dc2626">${params.value} failures (${pct}%)</div>`;
        },
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: hasData ? Math.max(...data.map(m => m.count)) : 100,
        minInterval: 1,
        splitLine: { show: true, lineStyle: { color: '#e2e8f0', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#64748b', fontSize: 12 },
      },
      yAxis: {
        type: 'category',
        data: hasData ? data.map(m => m.label).reverse() : [],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#0f172a', fontSize: 12, fontWeight: 600 },
      },
      series: hasData
        ? ([{
            name: 'Failure modes',
            type: 'bar',
            barWidth: 24,
            itemStyle: {
              borderRadius: [0, 6, 6, 0],
            },
            emphasis: {
              itemStyle: { shadowBlur: 10, shadowColor: 'rgba(15, 23, 42, 0.15)' },
            },
            data: data.map(m => ({
              value: m.count,
              itemStyle: { color: colorMap[m.tone] ?? '#94a3b8' },
            })),
          }] as unknown as echarts.SeriesOption[])
        : [],
    };
  });

  constructor() {
    effect(() => {
      if (this.chartInstance && !this.chartInstance.isDisposed()) {
        this.chartInstance.setOption(this.chartOptions() as echarts.EChartsOption);
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
