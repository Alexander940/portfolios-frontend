import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, FlaskConical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { getErrorMessage } from '@/lib/apiErrors';
import { fmtDate, fmtPct } from '@/lib/format';
import {
  getPerformanceCurve,
  type PerformanceCurveResponse,
} from '@/services/portfolioService';
import { getBacktestJob, getVsBacktest, runBacktest } from '../service';
import { useTrackerStore } from '../store';
import type { SeriesPoint, VsBacktestResponse } from '../types';

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 240; // ~10 min

const TRACKER_COLOR = 'var(--c-accent)';
const BENCHMARK_COLOR = 'var(--c-text-dim)';
const BACKTEST_COLOR = 'var(--c-warn)';

interface ChartRow {
  date: string;
  tracker?: number;
  spy?: number;
  backtest?: number;
}

/** Merge de series por fecha; grafica `rebased` (base 100). */
function buildRows(
  live: SeriesPoint[],
  benchmark: SeriesPoint[] | null,
  backtest: SeriesPoint[] | null,
): ChartRow[] {
  const byDate = new Map<string, ChartRow>();
  const upsert = (date: string) => {
    let row = byDate.get(date);
    if (!row) {
      row = { date };
      byDate.set(date, row);
    }
    return row;
  };
  for (const p of live) upsert(p.date).tracker = Number(p.rebased);
  for (const p of benchmark ?? []) upsert(p.date).spy = Number(p.rebased);
  for (const p of backtest ?? []) upsert(p.date).backtest = Number(p.rebased);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function curveToRows(curve: PerformanceCurveResponse): ChartRow[] {
  return curve.points.map((p) => ({
    date: p.date,
    tracker: Number(p.portfolio_value),
    spy: p.benchmark_value === null ? undefined : Number(p.benchmark_value),
  }));
}

function deltaClass(n: unknown): string {
  const num = Number(n);
  if (!Number.isFinite(num) || num === 0) return '';
  return num > 0 ? 'pos' : 'neg';
}

export function PerformanceSection() {
  const tracker = useTrackerStore((s) => s.tracker);
  const portfolioId = tracker?.portfolio_id;
  const strategyId = tracker?.strategy_id;

  const [curve, setCurve] = useState<PerformanceCurveResponse | null>(null);
  const [curveError, setCurveError] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [overlay, setOverlay] = useState<VsBacktestResponse | null>(null);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [backtestRunning, setBacktestRunning] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!portfolioId) return;
    const controller = new AbortController();
    getPerformanceCurve(portfolioId, {}, controller.signal)
      .then((data) => setCurve(data))
      .catch((err) => {
        if (!controller.signal.aborted) setCurveError(getErrorMessage(err));
      });
    return () => controller.abort();
  }, [portfolioId]);

  const fetchOverlay = useCallback(async () => {
    if (!strategyId) return;
    setOverlayLoading(true);
    setOverlayError(null);
    try {
      const data = await getVsBacktest(strategyId);
      if (aliveRef.current) {
        setOverlay(data);
        setOverlayLoading(false);
      }
    } catch (err) {
      if (aliveRef.current) {
        setOverlayError(getErrorMessage(err));
        setOverlayLoading(false);
      }
    }
  }, [strategyId]);

  const handleToggle = () => {
    const next = !compare;
    setCompare(next);
    if (next && !overlay) void fetchOverlay();
  };

  const handleRunBacktest = async () => {
    if (!strategyId) return;
    setBacktestRunning(true);
    setOverlayError(null);
    try {
      const job = await runBacktest(strategyId);
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        if (!aliveRef.current) return;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const status = (await getBacktestJob(job.job_id)).status.toLowerCase();
        if (status === 'done' || status === 'completed' || status === 'success') {
          await fetchOverlay();
          if (aliveRef.current) setBacktestRunning(false);
          return;
        }
        if (status === 'failed' || status === 'error') {
          throw new Error('El backtest terminó con error.');
        }
      }
      throw new Error('El backtest no terminó a tiempo. Reintenta más tarde.');
    } catch (err) {
      if (aliveRef.current) {
        setOverlayError(getErrorMessage(err));
        setBacktestRunning(false);
      }
    }
  };

  if (!tracker) return null;

  const showOverlay = compare && overlay !== null;
  const backtestMissing = showOverlay && overlay.backtest === null;
  const rows: ChartRow[] = showOverlay
    ? buildRows(overlay.live, overlay.benchmark, overlay.backtest)
    : curve
      ? curveToRows(curve)
      : [];
  const divergence = showOverlay ? overlay.divergence : null;
  const overlayWarnings = showOverlay ? (overlay.warnings ?? []) : [];
  const conventions = showOverlay ? (overlay.conventions ?? {}) : {};

  return (
    <div className="card" style={{ marginBottom: 16 }} data-testid="performance-section">
      <div className="card-head">
        <div>
          <div className="card-title">Performance</div>
          <div className="card-sub">Equity del tracker vs S&P 500 (base 100)</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {overlayLoading && <Loader2 className="animate-spin" size={16} aria-hidden />}
          <Button
            size="sm"
            variant={compare ? 'secondary' : 'ghost'}
            leftIcon={<FlaskConical size={14} />}
            onClick={handleToggle}
            aria-pressed={compare}
          >
            {compare ? 'Ocultar backtest' : 'Comparar con backtest'}
          </Button>
        </div>
      </div>

      {curveError && !showOverlay ? (
        <div className="trk-error-box" data-testid="performance-error">
          {curveError}
        </div>
      ) : rows.length === 0 && !backtestMissing ? (
        <div className="trk-error-box" data-testid="performance-empty">
          Aún no hay datos de la curva.
        </div>
      ) : (
        <>
          {backtestMissing ? (
            <div className="trk-empty" data-testid="backtest-missing">
              <FlaskConical size={28} style={{ color: 'var(--c-text-dim)' }} aria-hidden />
              <h3>No existe un backtest para la versión trackeada</h3>
              <p>{overlay.backtest_missing_reason}</p>
              <Button
                size="sm"
                onClick={() => void handleRunBacktest()}
                isLoading={backtestRunning}
                data-testid="run-backtest-cta"
              >
                Correr backtest
              </Button>
            </div>
          ) : (
            <div style={{ padding: '8px 14px 0' }} data-testid="tracker-performance-chart">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="var(--c-border)" strokeDasharray="2 4" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--c-text-dim)' }}
                    tickFormatter={(d: string) => fmtDate(d)}
                    minTickGap={40}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--c-text-dim)' }}
                    domain={['auto', 'auto']}
                    width={44}
                  />
                  <Tooltip
                    labelFormatter={(d) => fmtDate(String(d))}
                    formatter={(value) => Number(value ?? 0).toFixed(2)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="tracker"
                    name="Tracker"
                    stroke={TRACKER_COLOR}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="spy"
                    name="SPY"
                    stroke={BENCHMARK_COLOR}
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                  {showOverlay && overlay.backtest !== null && (
                    <Line
                      type="monotone"
                      dataKey="backtest"
                      name="Backtest"
                      stroke={BACKTEST_COLOR}
                      strokeWidth={1.5}
                      strokeDasharray="1 4"
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {overlayError && (
            <div className="trk-banner error" style={{ margin: '10px 14px' }} data-testid="overlay-error">
              <AlertTriangle size={16} aria-hidden />
              <div className="trk-banner-body">{overlayError}</div>
            </div>
          )}

          {divergence && (
            <div className="trk-divergence" data-testid="divergence-card">
              <div>
                <div className="trk-date-label">Retorno live</div>
                <div className={`trk-date-value ${deltaClass(divergence.live_return_pct)}`}>
                  {fmtPct(divergence.live_return_pct, 2, true)}
                </div>
              </div>
              <div>
                <div className="trk-date-label">Retorno backtest</div>
                <div
                  className={`trk-date-value ${deltaClass(divergence.backtest_return_pct)}`}
                >
                  {fmtPct(divergence.backtest_return_pct, 2, true)}
                </div>
              </div>
              <div>
                <div className="trk-date-label">Delta</div>
                <div className={`trk-date-value ${deltaClass(divergence.delta_pct)}`}>
                  {fmtPct(divergence.delta_pct, 2, true)}
                </div>
              </div>
              <div className="trk-divergence-window">
                {divergence.common_days} días en común ·{' '}
                {fmtDate(divergence.window_start)} — {fmtDate(divergence.window_end)}
              </div>
            </div>
          )}

          {showOverlay &&
            overlayWarnings.map((w) => (
              <div
                className="trk-banner warn"
                style={{ margin: '10px 14px' }}
                key={w}
                data-testid="overlay-warning"
              >
                <AlertTriangle size={16} aria-hidden />
                <div className="trk-banner-body">{w}</div>
              </div>
            ))}

          {showOverlay && Object.keys(conventions).length > 0 && (
            <div className="trk-conventions" data-testid="conventions-disclaimer">
              Convenciones:{' '}
              {Object.entries(conventions)
                .map(([serie, conv]) => `${serie}: ${conv}`)
                .join(' · ')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
