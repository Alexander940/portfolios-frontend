import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Row {
  date: string;
  portfolio: number;
  benchmark: number | null;
  totalValue: number;
  benchmarkValue: number | null;
  /** Extra series read by `extraSeries` dataKeys (composite view, #209). */
  [series: string]: string | number | null;
}

/** Chart base: rebased index (both series start at 100) or capital in $ (#134). */
export type EquityChartMode = 'index_100' | 'capital';

/**
 * An additional line drawn under the main series — the composite backtest view
 * (#209) overlays one per sleeve. Each row must carry both dataKeys so the
 * Base 100 ↔ Capital toggle switches them together with the main series.
 */
export interface EquityChartSeries {
  /** dataKey of the rebased (base 100) values. */
  key: string;
  /** dataKey of the same series in capital. */
  capitalKey: string;
  label: string;
  color: string;
}

const fmtCapital = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

export function EquityChart({
  data,
  name,
  mode = 'index_100',
  extraSeries = [],
  height = 280,
}: {
  data: Row[];
  name: string;
  mode?: EquityChartMode;
  extraSeries?: EquityChartSeries[];
  height?: number;
}) {
  const capital = mode === 'capital';
  const portfolioKey = capital ? 'totalValue' : 'portfolio';
  const benchmarkKey = capital ? 'benchmarkValue' : 'benchmark';
  const hasBench = data.some((r) => r[benchmarkKey] != null);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="2 3" stroke="var(--c-border)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: 'var(--c-text-dim)' }}
          minTickGap={48}
          tickFormatter={(d: string) => d.slice(0, 7)}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--c-text-dim)' }}
          // Fixed width in both modes (same as PortfolioPerformanceChart) so the
          // plot never reflows when toggling Base 100 ↔ Capital.
          width={56}
          domain={['auto', 'auto']}
          tickFormatter={capital ? fmtCapital : (v: number) => v.toFixed(0)}
        />
        <Tooltip
          formatter={(v) =>
            typeof v === 'number' ? (capital ? fmtCapital(v) : v.toFixed(1)) : String(v)
          }
          labelStyle={{ fontSize: 11 }}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        {/* Sleeves first so the composite/main line stays on top of them. */}
        {extraSeries.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={capital ? s.capitalKey : s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={1.25}
            dot={false}
            // A sleeve can start after the composite window opens (or miss a
            // day): draw the gap instead of inventing a straight line.
            connectNulls={false}
          />
        ))}
        <Line
          type="monotone"
          dataKey={portfolioKey}
          name={name}
          stroke="var(--c-accent)"
          strokeWidth={2.25}
          dot={false}
        />
        {hasBench && (
          <Line
            type="monotone"
            dataKey={benchmarkKey}
            name="S&P 500 (SPY)"
            stroke="var(--c-text-dim)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
