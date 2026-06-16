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
}

export function EquityChart({ data, name }: { data: Row[]; name: string }) {
  const hasBench = data.some((r) => r.benchmark != null);
  return (
    <ResponsiveContainer width="100%" height={280}>
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
          width={44}
          domain={['auto', 'auto']}
          tickFormatter={(v: number) => v.toFixed(0)}
        />
        <Tooltip
          formatter={(v) => (typeof v === 'number' ? v.toFixed(1) : String(v))}
          labelStyle={{ fontSize: 11 }}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        <Line type="monotone" dataKey="portfolio" name={name} stroke="var(--c-accent)" strokeWidth={2.25} dot={false} />
        {hasBench && (
          <Line
            type="monotone"
            dataKey="benchmark"
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
