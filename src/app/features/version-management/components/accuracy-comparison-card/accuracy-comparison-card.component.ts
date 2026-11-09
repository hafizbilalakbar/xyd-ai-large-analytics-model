import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  input,
  viewChild,
} from '@angular/core';
import * as echarts from 'echarts';
import type { EChartsOption, EChartsType } from 'echarts';
import type { ClassAccuracy } from '../../data-access/version-management.models';

const OLDER_COLOR = '#e08a00';
const NEWER_COLOR = '#0b57b0';

interface ChartPoint {
  code: string;
  category: string;
  older: number | null;
  newer: number | null;
}

@Component({
  selector: 'app-accuracy-comparison-card',
  standalone: true,
  imports: [],
  templateUrl: './accuracy-comparison-card.component.html',
  styleUrl: './accuracy-comparison-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccuracyComparisonCardComponent implements AfterViewInit, OnDestroy {
  readonly olderVersion = input.required<string>();
  readonly newerVersion = input.required<string>();
  readonly classAccuracies = input<readonly ClassAccuracy[]>([]);

  private readonly chartHost = viewChild.required<ElementRef<HTMLDivElement>>('chartHost');

  private chart: EChartsType | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private compactLabels = false;

  readonly points = computed<readonly ChartPoint[]>(() => {
    const older = this.olderVersion();
    const newer = this.newerVersion();
    return this.classAccuracies().map((metric) => ({
      code: metric.code,
      category: metric.category,
      older: metric.accuracies[older] ?? null,
      newer: metric.accuracies[newer] ?? null,
    }));
  });

  readonly hasChartData = computed(() =>
    this.points().some((point) => point.older !== null || point.newer !== null),
  );

  readonly showNoDataNote = computed(() => !this.hasChartData());

  readonly chartAriaLabel = computed(
    () =>
      `Category accuracy comparison between ${this.olderVersion()} and ${this.newerVersion()}.`,
  );

  constructor() {
    effect(() => {
      this.points();
      this.olderVersion();
      this.newerVersion();
      if (this.chart !== null) {
        this.chart.setOption(this.buildOption(), true);
      }
    });
  }

  ngAfterViewInit(): void {
    const host = this.chartHost().nativeElement;
    this.chart = echarts.init(host);
    this.compactLabels = host.clientWidth > 0 && host.clientWidth < 560;
    this.chart.setOption(this.buildOption(), true);
    this.resizeObserver = new ResizeObserver(() => {
      if (this.chart === null) {
        return;
      }
      const width = this.chart.getWidth();
      const compact = width > 0 && width < 560;
      if (compact !== this.compactLabels) {
        this.compactLabels = compact;
        this.chart.setOption(this.buildOption(), true);
      }
      this.chart.resize();
    });
    this.resizeObserver.observe(host);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.chart?.dispose();
    this.chart = null;
  }

  private buildOption(): EChartsOption {
    const older = this.olderVersion();
    const newer = this.newerVersion();
    const points = this.points();
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const olderData = points
      .filter((point) => point.older !== null)
      .map((point) => ({ value: [point.code, point.older as number] }));
    const newerData = points
      .filter((point) => point.newer !== null)
      .map((point) => ({ value: [point.code, point.newer as number] }));

    return {
      backgroundColor: 'transparent',
      animation: !reducedMotion,
      animationDuration: reducedMotion ? 0 : 500,
      animationEasing: 'cubicOut',
      legend: { show: false },
      grid: { left: 60, right: 24, top: 24, bottom: 48 },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: '#fff',
        borderColor: '#dbe4f0',
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: '#0f172a', fontSize: 12 },
        extraCssText: 'border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);',
        axisPointer: {
          type: 'line',
          lineStyle: { type: 'dashed', color: '#94a3b8', width: 1 },
        },
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params];
          const index = list[0]?.dataIndex ?? 0;
          const point = points[index];
          if (point === undefined) {
            return '';
          }
          const line = (color: string, version: string, value: number | null): string => {
            const shown =
              value === null
                ? '<span style="color:#9aa7bd">Not evaluated</span>'
                : `${value.toFixed(1)}%`;
            return `<div style="display:flex;align-items:center;gap:6px;line-height:1.6"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex:none"></span><span>${this.escape(version)}</span><span style="margin-left:auto;font-weight:600">${shown}</span></div>`;
          };
          return [
            `<div style="font-size:12px;font-weight:600;margin-bottom:6px">${this.escape(point.category)}</div>`,
            line(OLDER_COLOR, older, point.older),
            line(NEWER_COLOR, newer, point.newer),
          ].join('');
        },
      },
      xAxis: {
        type: 'category',
        data: points.map((point) => point.code),
        boundaryGap: true,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#dde5f0' } },
        axisLabel: {
          interval: 0,
          fontSize: this.compactLabels ? 9 : 10,
          lineHeight: 15,
          color: '#6b7a92',
          formatter: (value: string) => {
            if (this.compactLabels) {
              return value;
            }
            const point = points.find((item) => item.code === value);
            if (point === undefined) {
              return value;
            }
            const name =
              point.category.startsWith(`${point.code} `) && point.category.length > point.code.length
                ? point.category.slice(point.code.length + 1)
                : point.category;
            return name.length > 0 && name !== point.code ? `${point.code}\n${name}` : point.code;
          },
        },
      },
      yAxis: {
        type: 'value',
        min: 80,
        max: 100,
        interval: 5,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { formatter: '{value}%', color: '#6b7a92', fontSize: 11 },
        splitLine: { lineStyle: { color: '#eaeff7', type: 'dashed' } },
      },
      series: [
        {
          name: older,
          type: 'scatter',
          z: 2,
          symbol: 'circle',
          symbolSize: 12,
          data: olderData,
          itemStyle: { color: '#fff', borderColor: OLDER_COLOR, borderWidth: 2.5 },
        },
        {
          name: newer,
          type: 'scatter',
          z: 3,
          symbol: 'circle',
          symbolSize: 8,
          data: newerData,
          itemStyle: { color: NEWER_COLOR, borderColor: NEWER_COLOR, borderWidth: 0 },
        },
      ],
    };
  }

  private escape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
