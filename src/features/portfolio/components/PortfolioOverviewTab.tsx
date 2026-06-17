import { useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Loader2 } from 'lucide-react';
import {
  getPerformanceCurve,
  listPortfolioPositions,
  type PerformanceCurveResponse,
  type PortfolioPositionDetail,
} from '@/services/portfolioService';
import { isApiError } from '@/lib/apiErrors';
import { PortfolioPerformanceChart } from './PortfolioPerformanceChart';
import { fmtNumber } from '../lib/format';

interface PortfolioOverviewTabProps {
  portfolioId: string;
}

/** Distinct palette for sector donut + swatches. */
const SECTOR_COLORS = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#ea580c',
  '#0d9488',
  '#6b7280',
];

const DASH = '—';

/**
 * PortfolioOverviewTab
 *
 * Overview tab of the portfolio detail page. Three blocks:
 *  1. Performance vs benchmark chart (PortfolioPerformanceChart, self-fetching).
 *  2. A perf-stat strip computed from a second curve fetch (Portfolio %,
 *     Benchmark %, Alpha %, Sharpe, Max DD, Vol — annualized from daily returns).
 *  3. Sector allocation donut + list, aggregated from the portfolio positions.
 */
export function PortfolioOverviewTab({ portfolioId }: PortfolioOverviewTabProps) {
  return (
    <>
      <div className="detail-sect">
        <div className="detail-sect-head">
          <div className="detail-sect-title">Performance vs benchmark</div>
          <div className="perf-legend">
            <span>
              <span className="dot" style={{ background: 'var(--c-accent)' }} />
              Portfolio
            </span>
            <span>
              <span
                className="dot"
                style={{ background: 'var(--c-text-dim)' }}
              />
              Benchmark
            </span>
          </div>
        </div>
        <PortfolioPerformanceChart portfolioId={portfolioId} />
        <PerfStatStrip portfolioId={portfolioId} />
      </div>

      <div className="detail-sect">
        <div className="detail-sect-head">
          <div className="detail-sect-title">Sector Allocation</div>
        </div>
        <SectorAllocation portfolioId={portfolioId} />
      </div>
    </>
  );
}

// =============================================================================
// Perf-stat strip
// =============================================================================

interface PerfStats {
  portfolioPct: number | null;
  benchmarkPct: number | null;
  alphaPct: number | null;
  sharpe: number | null;
  maxDdPct: number | null;
  volPct: number | null;
}

function computeStats(data: PerformanceCurveResponse): PerfStats {
  const points = data.points;
  const last = points.length > 0 ? points[points.length - 1] : null;

  const portfolioPct = last ? Number(last.portfolio_return_pct) : null;
  const benchmarkPct =
    data.benchmark_available && last && last.benchmark_return_pct != null
      ? Number(last.benchmark_return_pct)
      : null;
  const alphaPct =
    last && last.relative_return_pct != null
      ? Number(last.relative_return_pct)
      : portfolioPct != null && benchmarkPct != null
        ? portfolioPct - benchmarkPct
        : null;

  // Daily returns from the portfolio_value series.
  const values = points
    .map((p) => Number(p.portfolio_value))
    .filter((v) => Number.isFinite(v));

  if (values.length < 2) {
    return {
      portfolioPct,
      benchmarkPct,
      alphaPct,
      sharpe: null,
      maxDdPct: null,
      volPct: null,
    };
  }

  const returns: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1];
    if (prev !== 0) returns.push(values[i] / prev - 1);
  }

  let sharpe: number | null = null;
  let volPct: number | null = null;
  if (returns.length >= 1) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
    const stdev = Math.sqrt(variance);
    if (stdev > 0) {
      volPct = stdev * Math.sqrt(252) * 100;
      sharpe = (mean / stdev) * Math.sqrt(252);
    }
  }

  // Max drawdown over the value series (most negative v/runningMax - 1).
  let runningMax = values[0];
  let maxDd = 0;
  for (const v of values) {
    if (v > runningMax) runningMax = v;
    if (runningMax > 0) {
      const dd = v / runningMax - 1;
      if (dd < maxDd) maxDd = dd;
    }
  }
  const maxDdPct = maxDd * 100;

  return { portfolioPct, benchmarkPct, alphaPct, sharpe, maxDdPct, volPct };
}

function signClass(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return n >= 0 ? 'pos' : 'neg';
}

function pctLabel(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  const sign = n > 0 ? '+' : '';
  return `${sign}${fmtNumber(n, decimals)}%`;
}

function PerfStatStrip({ portfolioId }: { portfolioId: string }) {
  const [data, setData] = useState<PerformanceCurveResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    // Reset loading/error synchronously when the fetch key changes — same
    // request-lifecycle pattern as PortfolioPerformanceChart.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);

    getPerformanceCurve(
      portfolioId,
      { base_mode: 'index_100' },
      controller.signal,
    )
      .then((res) => {
        if (!controller.signal.aborted) setData(res);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(
          isApiError(err)
            ? err.message
            : 'No se pudieron calcular las métricas.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [portfolioId]);

  if (isLoading) {
    return (
      <div className="perf-stat" data-testid="perf-stat-loading">
        <Loader2
          size={16}
          color="var(--c-text-dim)"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="perf-stat" style={{ color: 'var(--c-text-dim)' }}>
        {error ?? 'Sin métricas.'}
      </div>
    );
  }

  const stats = computeStats(data);

  return (
    <div className="perf-stat" data-testid="perf-stat">
      <span>
        <span className="k">Portfolio:</span>
        <span className={signClass(stats.portfolioPct)}>
          {pctLabel(stats.portfolioPct)}
        </span>
      </span>
      <span>
        <span className="k">Benchmark:</span>
        <span>{pctLabel(stats.benchmarkPct)}</span>
      </span>
      <span>
        <span className="k">Alpha:</span>
        <span className={signClass(stats.alphaPct)}>
          {pctLabel(stats.alphaPct)}
        </span>
      </span>
      <span>
        <span className="k">Sharpe:</span>
        <span>
          {stats.sharpe == null ? DASH : fmtNumber(stats.sharpe, 2)}
        </span>
      </span>
      <span>
        <span className="k">Max DD:</span>
        <span className="neg">
          {stats.maxDdPct == null ? DASH : pctLabel(stats.maxDdPct)}
        </span>
      </span>
      <span>
        <span className="k">Vol:</span>
        <span>
          {stats.volPct == null ? DASH : `${fmtNumber(stats.volPct, 1)}%`}
        </span>
      </span>
    </div>
  );
}

// =============================================================================
// Sector allocation
// =============================================================================

interface SectorSlice {
  name: string;
  value: number;
  pct: number;
}

function aggregateSectors(
  positions: PortfolioPositionDetail[],
): SectorSlice[] {
  const totals = new Map<string, number>();
  for (const p of positions) {
    const sector = p.sector ?? 'Other';
    const value =
      p.current_value != null && Number.isFinite(Number(p.current_value))
        ? Number(p.current_value)
        : p.weight_pct != null && Number.isFinite(Number(p.weight_pct))
          ? Number(p.weight_pct)
          : 0;
    if (value <= 0) continue;
    totals.set(sector, (totals.get(sector) ?? 0) + value);
  }

  const total = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  if (total <= 0) return [];

  return Array.from(totals.entries())
    .map(([name, value]) => ({ name, value, pct: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}

function SectorAllocation({ portfolioId }: { portfolioId: string }) {
  const [positions, setPositions] = useState<PortfolioPositionDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    // Reset loading/error synchronously when the fetch key changes — same
    // request-lifecycle pattern as PortfolioPerformanceChart.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);

    listPortfolioPositions(
      portfolioId,
      { limit: 500, sort_by: 'weight', sort_order: 'desc' },
      controller.signal,
    )
      .then((res) => {
        if (!controller.signal.aborted) setPositions(res.items);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(
          isApiError(err)
            ? err.message
            : 'No se pudo cargar la asignación por sector.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [portfolioId]);

  const sectors = useMemo(() => aggregateSectors(positions), [positions]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 180,
        }}
      >
        <Loader2
          size={22}
          color="var(--c-text-dim)"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <p style={{ color: 'var(--c-text-soft)', margin: 0, fontSize: 13 }}>
        {error}
      </p>
    );
  }

  if (sectors.length === 0) {
    return (
      <p style={{ color: 'var(--c-text-soft)', margin: 0, fontSize: 13 }}>
        No hay posiciones para mostrar la asignación por sector.
      </p>
    );
  }

  return (
    <div className="sector-grid">
      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={sectors}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={84}
              paddingAngle={1}
              isAnimationActive={false}
            >
              {sectors.map((s, i) => (
                <Cell
                  key={s.name}
                  fill={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [fmtNumber(Number(value), 0), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="sector-list">
        {sectors.map((s, i) => (
          <div key={s.name} className="sector-row">
            <span
              className="sector-swatch"
              style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
            />
            <span className="sector-name">{s.name}</span>
            <span className="sector-wt">{fmtNumber(s.pct, 1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
