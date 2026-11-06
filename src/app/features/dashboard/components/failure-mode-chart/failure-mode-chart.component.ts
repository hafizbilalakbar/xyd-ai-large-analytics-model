import { ChangeDetectionStrategy, Component, computed, effect, input, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import * as echarts from 'echarts';
import type { FailureMode } from '../../data-access/dashboard.models';

const DONUT_COLORS = ['#dc2626', '#2563eb', '#f59e0b', '#7c3aed', '#16a34a', '#94a3b8'];

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

    // Sort modes by count descending for consistent color assignment
    const sorted = [...data].sort((a, b) => b.count - a.count);
    const colorMap: Record<string, string> = {};
    sorted.forEach((m, i) => {
      colorMap[m.label] = DONUT_COLORS[i % DONUT_COLORS.length];
    });

    return {
      animation: !prefersReducedMotion,
      animationDuration: 1400,
      animationEasing: 'cubicOut',
      animationDurationUpdate: 900,
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
      legend: {
        show: true,
        orient: 'vertical',
        left: 'right',
        top: 'center',
        textStyle: { color: '#64748b', fontSize: 12 },
        data: hasData ? data.map(m => m.label) : [],
      },
      series: hasData
        ? ([{
            name: 'Failure modes',
            type: 'pie',
            radius: ['55%', '78%'],
            center: ['45%', '50%'],
            avoidLabelOverlap: false,
            padAngle: 3,
            itemStyle: {
              borderRadius: 8,
              borderColor: '#ffffff',
              borderWidth: 2,
            },
            label: {
              show: false,
            },
            labelLine: {
              show: false,
            },
            emphasis: {
              scale: true,
              scaleSize: 8,
              itemStyle: { shadowBlur: 10, shadowColor: 'rgba(15, 23, 42, 0.15)' },
            },
            data: data.map(m => ({
              value: m.count,
              name: m.label,
              itemStyle: { color: colorMap[m.label] ?? '#94a3b8' },
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
