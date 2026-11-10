import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  input,
  output,
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

interface BandStyle {
  width: number;
  align: 'center';
  fontSize: number;
  lineHeight: number;
  color: string;
  fontWeight: number;
  overflow: 'truncate';
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
  readonly loading = input(false);
  readonly error = input<string | null>(null);

  readonly retry = output<void>();

  private readonly chartHost = viewChild.required<ElementRef<HTMLDivElement>>('chartHost');

  private chart: EChartsType | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeFrame: number | null = null;
  private lastLayoutKey = '';

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

  readonly showNoDataNote = computed(() => {
    const points = this.points();
    if (points.length === 0) {
      return true;
    }
    return (
      points.every((point) => point.older === null) ||
      points.every((point) => point.newer === null)
    );
  });

  readonly unassessed = computed<readonly { version: string; tone: 'old' | 'new'; items: readonly string[] }[]>(() => {
    const points = this.points();
    const older = this.olderVersion();
    const newer = this.newerVersion();
    const groups: { version: string; tone: 'old' | 'new'; items: string[] }[] = [];
    const olderItems = points.filter((point) => point.older === null).map((point) => point.category);
    if (olderItems.length > 0) {
      groups.push({ version: older, tone: 'old', items: olderItems });
    }
    const newerItems = points.filter((point) => point.newer === null).map((point) => point.category);
    if (newerItems.length > 0) {
      groups.push({ version: newer, tone: 'new', items: newerItems });
    }
    return groups;
  });

  readonly chartAriaLabel = computed(
    () =>
      `Category accuracy comparison between ${this.olderVersion()} and ${this.newerVersion()}.`,
  );

  readonly sameValueCodes = computed<readonly string[]>(() => {
    const points = this.points();
    return points
      .filter((point) => point.older !== null && point.newer !== null && point.older === point.newer)
      .map((point) => point.code);
  });

  private readonly pointerOutside = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') {
      return;
    }
    const host = this.chartHost().nativeElement;
    const target = event.target;
    if (target instanceof Node && !host.contains(target)) {
      this.chart?.dispatchAction({ type: 'hideTip' });
    }
  };

  constructor() {
    effect(() => {
      this.points();
      this.olderVersion();
      this.newerVersion();
      if (this.chart !== null) {
        this.chart.setOption(this.buildOption(), { notMerge: false, lazyUpdate: true });
      }
    });
  }

  ngAfterViewInit(): void {
    const host = this.chartHost().nativeElement;
    this.chart = echarts.init(host);
    this.chart.setOption(this.buildOption(), { notMerge: true });
    this.lastLayoutKey = this.layoutKey();
    this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
    this.resizeObserver.observe(host);
    document.addEventListener('pointerdown', this.pointerOutside, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('pointerdown', this.pointerOutside, true);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.resizeFrame !== null) {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = null;
    }
    this.chart?.dispose();
    this.chart = null;
  }

  private scheduleResize(): void {
    if (this.resizeFrame !== null) {
      return;
    }
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = null;
      this.chart?.resize();
      const key = this.layoutKey();
      if (key === this.lastLayoutKey) {
        return;
      }
      this.lastLayoutKey = key;
      this.chart?.setOption(this.buildOption(), { notMerge: false, lazyUpdate: true });
    });
  }

  private layoutKey(): string {
    const width = this.chart?.getWidth() ?? this.chartHost().nativeElement.clientWidth;
    const breakpoint =
      width < 360 ? 'xs' : width < 640 ? 'sm' : width < 1024 ? 'md' : 'lg';
    const points = Math.max(1, this.points().length);
    const band = Math.max(10, Math.round((width - 60) / points));
    return `${breakpoint}:${Math.round(band / 4)}`;
  }

  private buildOption(): EChartsOption {
    const older = this.olderVersion();
    const newer = this.newerVersion();
    const points = this.points();
    const sameValueCodes = this.sameValueCodes();
    const width =
      this.chart?.getWidth() ??
      (this.chartHost().nativeElement.clientWidth || 1280);
    const isPhone = width < 640;
    const isTiny = width < 360;
    const isTablet = width >= 640 && width < 1024;
    const fontSize = isPhone ? (isTiny ? 9 : 10) : isTablet ? 10 : 11;
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const grid = isPhone
      ? { left: 44, right: 12, top: 16, bottom: 46 }
      : isTablet
        ? { left: 44, right: 12, top: 18, bottom: 60 }
        : { left: 48, right: 18, top: 18, bottom: 56 };

    const bandWidth = Math.max(
      10,
      Math.floor((width - grid.left - grid.right) / Math.max(1, points.length)) - 6,
    );
    const lineHeight = fontSize + 3;
    const rich: Record<'code' | 'name', BandStyle> = {
      code: {
        width: bandWidth,
        align: 'center',
        fontSize,
        lineHeight,
        color: '#3f4c60',
        fontWeight: 600,
        overflow: 'truncate',
      },
      name: {
        width: bandWidth,
        align: 'center',
        fontSize,
        lineHeight,
        color: '#6b7a92',
        fontWeight: 400,
        overflow: 'truncate',
      },
    };

    const olderData = points.map((point) => point.older);
    const newerData = points.map((point) => point.newer);
    const allValues = [...olderData, ...newerData].filter((value): value is number => value !== null);
    const dataMin = allValues.length > 0 ? Math.min(...allValues) : 80;
    const yMin = Math.min(80, Math.floor(dataMin / 10) * 10);

    const getItemStyle = (color: string, isSameValue: boolean) => {
      if (isSameValue) {
        return {
          color: '#fff',
          borderColor: color,
          borderWidth: 2.5,
        };
      }
      return {
        color: '#fff',
        borderColor: color,
        borderWidth: 2,
      };
    };

    return {
      backgroundColor: 'transparent',
      animation: !reducedMotion,
      animationDuration: reducedMotion ? 0 : 300,
      animationDurationUpdate: reducedMotion ? 0 : 700,
      animationEasingUpdate: 'cubicInOut',
      stateAnimation: { duration: reducedMotion ? 0 : 150, easing: 'cubicOut' },
      legend: { show: false },
      grid,
      tooltip: {
        trigger: 'axis',
        triggerOn: 'mousemove|click|mousewheel',
        confine: true,
        backgroundColor: '#fff',
        borderColor: '#dbe4f0',
        borderWidth: 1,
        padding: [10, 12],
        textStyle: { color: '#0f172a', fontSize: 12 },
        extraCssText:
          'max-width:calc(100vw - 32px);border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);',
        axisPointer: {
          type: 'line',
          snap: true,
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
                ? '<span style="color:#9aa7bd">Unevaluated</span>'
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
          rotate: isPhone ? 30 : 0,
          margin: isPhone ? 8 : 10,
          color: (_value?: string | number | undefined, index?: number | undefined): string => {
            const point = points[index ?? 0];
            if (!point) {
              return '#6b7a92';
            }
            return point.older === null || point.newer === null ? '#b5c0d0' : '#6b7a92';
          },
          formatter: (value: string, index: number) => {
            const point = points[index];
            if (point === undefined) {
              return `{code|${this.escape(value)}}`;
            }
            if (isPhone) {
              return `{code|${this.escape(point.code)}}`;
            }
            const name = this.pointName(point);
            return name.length > 0
              ? `{code|${this.escape(point.code)}}\n{name|${this.escape(name)}}`
              : `{code|${this.escape(point.code)}}`;
          },
          rich,
        },
      },
      yAxis: {
        type: 'value',
        min: yMin,
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
          type: 'line',
          z: 2,
          data: olderData.map((v, i) => ({ value: v, itemStyle: getItemStyle(OLDER_COLOR, sameValueCodes.includes(points[i].code)) })),
          connectNulls: false,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: isPhone ? 10 : 12,
          lineStyle: { opacity: 0 },
          emphasis: {
            scale: 1.4,
            itemStyle: { color: '#fff', borderColor: OLDER_COLOR, borderWidth: 2 },
          },
          animationDelay: (index: number) => index * 80,
          animationDuration: reducedMotion ? 0 : 600,
          animationEasing: 'cubicOut',
        },
        {
          name: newer,
          type: 'line',
          z: 3,
          data: newerData.map((v, i) => ({ value: v, itemStyle: getItemStyle(NEWER_COLOR, sameValueCodes.includes(points[i].code)) })),
          connectNulls: false,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: isPhone ? 7 : 8,
          lineStyle: { opacity: 0 },
          emphasis: {
            scale: 1.4,
            itemStyle: { color: NEWER_COLOR, borderColor: NEWER_COLOR, borderWidth: 0 },
          },
          animationDelay: (index: number) => index * 80 + 120,
          animationDuration: reducedMotion ? 0 : 600,
          animationEasing: 'cubicOut',
        },
      ],
    };
  }

  private pointName(point: ChartPoint): string {
    const prefix = `${point.code} `;
    if (point.category.startsWith(prefix)) {
      return point.category.slice(prefix.length);
    }
    return point.category === point.code ? '' : point.category;
  }

  private escape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
