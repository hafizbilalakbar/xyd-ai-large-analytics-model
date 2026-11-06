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
import type { FailureMode, FailureModeTone } from '../../data-access/dashboard.models';

const TONE_COLORS: Record<FailureModeTone, string> = {
  red: '#dc2626',
  blue: '#2563eb',
  amber: '#f59e0b',
  violet: '#7c3aed',
  slate: '#94a3b8',
};

@Component({
  selector: 'app-failure-mode-chart',
  standalone: true,
  templateUrl: './failure-mode-chart.component.html',
  styleUrl: './failure-mode-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FailureModeChartComponent implements AfterViewInit, OnDestroy {
  readonly modes = input.required<readonly FailureMode[]>();
  readonly loading = input(false);

  @ViewChild('chartContainer', { static: false })
  readonly chartContainer!: ElementRef<HTMLDivElement>;

  @ViewChild('card', { static: false })
  readonly card!: ElementRef<HTMLElement>;

  private readonly chartWidth = signal(0);
  private readonly chartHeight = signal(0);
  private readonly cardWidth = signal(0);
  private chartInstance: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeFrame: number | null = null;

  readonly total = computed(() => this.modes().reduce((sum, mode) => sum + mode.count, 0));

  readonly segments = computed(() => {
    const total = this.total();
    return this.modes()
      .filter((mode) => mode.count > 0)
      .map((mode) => ({
        code: mode.code,
        name: mode.name,
        count: mode.count,
        color: TONE_COLORS[mode.tone],
        percent: total > 0 ? (mode.count / total) * 100 : 0,
      }));
  });

  readonly legendItems = computed(() => this.segments());

  readonly hasData = computed(() => this.segments().length > 0);

  readonly wide = computed(() => this.cardWidth() > 420);

  private readonly diameter = computed(() => {
    const width = this.chartWidth();
    const height = this.chartHeight();
    if (width <= 0 || height <= 0) {
      return 0;
    }
    return Math.max(96, Math.min(220, Math.min(width, height) - 24));
  });

  readonly chartOptions = computed(() => {
    const data = this.segments();
    const hasData = data.length > 0;
    const total = this.total();
    const diameter = this.diameter();
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
        trigger: 'item',
        triggerOn: 'mousemove|click',
        confine: true,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 10,
        textStyle: { color: '#0f172a', fontSize: 12 },
        extraCssText: 'box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);',
        formatter: (params: unknown) => {
          const point = params as {
            name?: string;
            value?: number;
            data?: { code?: string; percent?: number };
          };
          const code = point.data?.code ?? '';
          const percent = point.data?.percent ?? 0;
          return `<div style="font-size:12px;color:#0f172a">${code} · ${point.name ?? ''}</div><div style="font-size:12px;font-weight:600;color:#dc2626">${point.value ?? 0} failures (${percent.toFixed(1)}%)</div>`;
        },
      },
      graphic: hasData
        ? [
            {
              type: 'text',
              left: 'center',
              top: '42%',
              style: {
                text: String(total),
                fill: '#0f172a',
                fontSize: 26,
                fontWeight: 700,
                textAlign: 'center',
              },
            },
            {
              type: 'text',
              left: 'center',
              top: '56%',
              style: {
                text: 'NG total',
                fill: '#64748b',
                fontSize: 11,
                textAlign: 'center',
              },
            },
          ]
        : [],
      series: hasData
        ? ([
            {
              name: 'Failure modes',
              type: 'pie',
              radius: [diameter * 0.29, diameter * 0.5],
              center: ['50%', '50%'],
              avoidLabelOverlap: false,
              padAngle: 2,
              itemStyle: {
                borderRadius: 6,
                borderColor: '#ffffff',
                borderWidth: 2,
              },
              label: { show: false },
              labelLine: { show: false },
              emphasis: { scale: true, scaleSize: 6 },
              data: data.map((item) => ({
                value: item.count,
                name: item.name,
                code: item.code,
                percent: item.percent,
                itemStyle: { color: item.color },
              })),
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
    const card = this.card.nativeElement;
    this.chartWidth.set(element.clientWidth);
    this.chartHeight.set(element.clientHeight);
    this.cardWidth.set(card.clientWidth);
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
        this.chartWidth.set(element.clientWidth);
        this.chartHeight.set(element.clientHeight);
        this.cardWidth.set(card.clientWidth);
        this.chartInstance?.resize();
      });
    });
    this.resizeObserver.observe(element);
    this.resizeObserver.observe(card);
  }

  ngOnDestroy(): void {
    if (this.resizeFrame !== null) {
      cancelAnimationFrame(this.resizeFrame);
    }
    this.resizeObserver?.disconnect();
    this.chartInstance?.dispose();
  }
}
