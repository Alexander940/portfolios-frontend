import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type AxisDomainItem,
} from 'recharts';
import type { ChatChart } from '../types';

/**
 * One interactive chart requested by the assistant (show_chart tool).
 *
 * Same visual language as the app's other recharts blocks
 * (EquityChart / PortfolioPerformanceChart / tracker PerformanceSection):
 * dashed CartesianGrid on --c-border, dimmed 10px ticks, no animation, and
 * the shared categorical palette. The payload is normalized in `useChat`
 * (`toChatChart`), so here `x` is non-empty and every series already has
 * exactly `x.length` values — `null` meaning "hueco".
 */

/**
 * Shared categorical palette (same order as ComparePortfoliosModal's
 * LINE_COLORS / PortfolioOverviewTab's SECTOR_COLORS). Assigned in fixed
 * order and never cycled: the backend caps `series` at 8, and anything past
 * the palette is dropped rather than repainted with a repeated hue.
 */
const SERIES_COLORS = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
];

/**
 * Secondary encoding for line series: the palette's adjacent pairs sit in the
 * "legal only with a second channel" band for red-green vision, so identity
 * never rests on hue alone (the repo already dashes its secondary lines).
 */
const SERIES_DASH: (string | undefined)[] = [
  undefined,
  '5 4',
  '2 3',
  '8 4',
  '1 3',
  '6 3 2 3',
  '4 2',
  '10 4',
];

/** Axis ticks: compact above 1.000 so the gutter stays narrow. */
function fmtAxis(v: number): string {
  if (!Number.isFinite(v)) return '';
  const abs = Math.abs(v);
  if (abs >= 1000) {
    return v.toLocaleString(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
    });
  }
  if (abs >= 1 || v === 0) {
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** Tooltip values keep their full precision (up to 4 decimals). */
function fmtValue(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** Long categories would collide, so they're clipped in the axis only. */
function fmtCategory(v: unknown): string {
  const s = String(v ?? '');
  return s.length > 12 ? `${s.slice(0, 11)}…` : s;
}

/**
 * A value whose two neighbours are both null draws no segment (`connectNulls`
 * is off), so with `dot={false}` recharts renders it as literally nothing.
 * Sparse series — a metric reported on different dates per ticker, or a single
 * point — need their markers to be visible at all.
 */
function hasIsolatedPoint(values: (number | null)[]): boolean {
  return values.some(
    (v, i) => v != null && values[i - 1] == null && values[i + 1] == null,
  );
}

export function ChatChartCard({ chart }: { chart: ChatChart }) {
  const series = useMemo(
    () => chart.series.slice(0, SERIES_COLORS.length),
    [chart.series],
  );

  /**
   * Recharts wants one row per category; series become the `s0..s7` keys so a
   * series name can never collide with `x` or with another series.
   */
  const rows = useMemo(
    () =>
      chart.x.map((category, i) => {
        const row: Record<string, string | number | null> = { x: category };
        series.forEach((s, si) => {
          row[`s${si}`] = s.values[i] ?? null;
        });
        return row;
      }),
    [chart.x, series],
  );

  // Thin the tick labels: keep both ends on short axes, and drop to ~12 ticks
  // once the series is long enough that every label wouldn't fit.
  const tickInterval: number | 'preserveStartEnd' =
    rows.length > 60 ? Math.ceil(rows.length / 12) : 'preserveStartEnd';

  const multi = series.length > 1;
  const margin = { top: 8, right: 16, bottom: chart.xLabel ? 22 : 4, left: 0 };
  const axisTick = { fontSize: 10, fill: 'var(--c-text-dim)' };

  // Bars are read by length, so their axis must ALWAYS contain zero: recharts
  // measures a bar from the edge of the domain when 0 falls outside it, so an
  // all-negative series (say three tickers' YTD returns) would draw no bar at
  // all for the smallest loss. Lines only care about the shape → 'auto'.
  const yDomain: [AxisDomainItem, AxisDomainItem] =
    chart.type === 'bar'
      ? [(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]
      : ['auto', 'auto'];

  const xAxis = (
    <XAxis
      dataKey="x"
      tick={axisTick}
      tickFormatter={fmtCategory}
      interval={tickInterval}
      minTickGap={16}
      label={
        chart.xLabel
          ? {
              value: chart.xLabel,
              position: 'insideBottom',
              offset: -12,
              fontSize: 11,
              fill: 'var(--c-text-dim)',
            }
          : undefined
      }
    />
  );

  const yAxis = (
    <YAxis
      tick={axisTick}
      width={chart.yLabel ? 68 : 52}
      domain={yDomain}
      tickFormatter={fmtAxis}
      label={
        chart.yLabel
          ? {
              value: chart.yLabel,
              angle: -90,
              position: 'insideLeft',
              fontSize: 11,
              fill: 'var(--c-text-dim)',
              style: { textAnchor: 'middle' },
            }
          : undefined
      }
    />
  );

  const grid = <CartesianGrid strokeDasharray="2 4" stroke="var(--c-border)" />;

  const tooltip = (
    <Tooltip
      formatter={fmtValue}
      labelStyle={{ fontSize: 11 }}
      contentStyle={{ fontSize: 12, borderRadius: 6 }}
      cursor={{ fill: 'var(--c-bg-soft)', stroke: 'var(--c-border-strong)' }}
    />
  );

  // A legend is redundant when the card title already names the only series.
  // It sits on top so it never collides with the X-axis label.
  const legend = multi ? (
    <Legend
      verticalAlign="top"
      align="left"
      wrapperStyle={{ fontSize: 12, paddingBottom: 10, paddingLeft: 8 }}
    />
  ) : null;

  return (
    <figure
      className="chart-card"
      aria-label={chart.title ?? 'Gráfico generado por el asistente'}
    >
      {chart.title && <figcaption className="chart-card-title">{chart.title}</figcaption>}
      <div className="chart-card-body">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === 'bar' ? (
            <BarChart data={rows} margin={margin} barGap={2} barCategoryGap="18%">
              {grid}
              {xAxis}
              {yAxis}
              {tooltip}
              {legend}
              {series.map((s, i) => (
                <Bar
                  key={s.name + i}
                  dataKey={`s${i}`}
                  name={s.name}
                  fill={SERIES_COLORS[i]}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart data={rows} margin={margin}>
              {grid}
              {xAxis}
              {yAxis}
              {tooltip}
              {legend}
              {series.map((s, i) => (
                <Line
                  key={s.name + i}
                  type="monotone"
                  dataKey={`s${i}`}
                  name={s.name}
                  stroke={SERIES_COLORS[i]}
                  strokeWidth={2}
                  strokeDasharray={SERIES_DASH[i]}
                  // Points with no neighbour draw no segment — show their marker.
                  dot={hasIsolatedPoint(s.values) ? { r: 3 } : false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
