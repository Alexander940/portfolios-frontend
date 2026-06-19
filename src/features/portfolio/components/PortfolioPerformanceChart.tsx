import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import {
  getPerformanceCurve,
  type CurveBaseMode,
  type PerformanceCurveResponse,
} from '@/services/portfolioService';
import { isApiError } from '@/lib/apiErrors';
import { toLocalDate } from '@/features/portfolio/lib/format';

interface PortfolioPerformanceChartProps {
  portfolioId: string;
}

interface ChartRow {
  date: string;
  portfolio: number;
  benchmark: number | null;
}

const PORTFOLIO_COLOR = '#2563eb';
const BENCHMARK_COLOR = '#9ca3af';

const BASE_MODES: { value: CurveBaseMode; label: string }[] = [
  { value: 'index_100', label: 'Base 100' },
  { value: 'initial_cash', label: 'Capital inicial' },
];

function benchmarkLabel(ticker: string): string {
  return ticker === 'SPY' ? 'S&P 500' : ticker;
}

function formatDate(iso: string): string {
  // 2026-01-05 -> Jan 05, 26. Parse date-only strings as a LOCAL date
  // (toLocalDate) so the calendar day isn't shifted back for UTC-3 users.
  const d = toLocalDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

/**
 * PortfolioPerformanceChart
 *
 * Portfolio vs benchmark (total return) rebased equity curve. Both series start
 * at the same base — 100 or the portfolio's initial cash — so the chart compares
 * returns, not absolute levels. Fetches its own data from
 * GET /portfolios/{id}/performance/curve.
 */
export function PortfolioPerformanceChart({
  portfolioId,
}: PortfolioPerformanceChartProps) {
  const [baseMode, setBaseMode] = useState<CurveBaseMode>('index_100');
  const [data, setData] = useState<PerformanceCurveResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    getPerformanceCurve(portfolioId, { base_mode: baseMode }, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setData(res);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(
          isApiError(err)
            ? err.message
            : 'No se pudo cargar la curva de performance.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [portfolioId, baseMode]);

  const rows: ChartRow[] = useMemo(() => {
    if (!data) return [];
    return data.points.map((p) => ({
      date: p.date,
      portfolio: Number(p.portfolio_value),
      benchmark: p.benchmark_value == null ? null : Number(p.benchmark_value),
    }));
  }, [data]);

  const benchLabel = data ? benchmarkLabel(data.benchmark) : 'Benchmark';

  return (
    <div className="card" data-testid="portfolio-performance-chart" style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 14 }}>Performance vs {benchLabel}</h3>
          <div className="page-sub" style={{ fontSize: 12 }}>
            Total return — dividendos reinvertidos en ambos lados
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }} role="group" aria-label="Base de la comparación">
          {BASE_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              className="chip"
              aria-pressed={baseMode === m.value}
              onClick={() => setBaseMode(m.value)}
              style={
                baseMode === m.value
                  ? { borderColor: PORTFOLIO_COLOR, color: PORTFOLIO_COLOR }
                  : undefined
              }
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {data && !data.benchmark_available && !isLoading && !error && (
        <div
          className="page-sub"
          data-testid="benchmark-unavailable"
          style={{ fontSize: 12, marginBottom: 8 }}
        >
          Benchmark no disponible — mostrando sólo el portafolio.
        </div>
      )}

      <div style={{ width: '100%', height: 320 }} data-testid="portfolio-performance-chart-body">
        {isLoading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Loader2
              size={24}
              color="var(--c-text-dim)"
              style={{ animation: 'spin 1s linear infinite' }}
            />
          </div>
        ) : error ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'var(--c-text-soft)', margin: 0 }}>{error}</p>
          </div>
        ) : rows.length === 0 ? (
          <div
            data-testid="portfolio-performance-empty"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'var(--c-text-soft)', margin: 0 }}>
              No hay snapshots todavía. La curva aparece cuando el portafolio
              acumula valuaciones diarias.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11 }}
                minTickGap={32}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                width={56}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => v.toLocaleString()}
              />
              <Tooltip labelFormatter={(label: ReactNode) => formatDate(String(label))} />
              <Legend />
              <Line
                type="monotone"
                dataKey="portfolio"
                name="Portfolio"
                stroke={PORTFOLIO_COLOR}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="benchmark"
                name={benchLabel}
                stroke={BENCHMARK_COLOR}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
