import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Loader2, Play } from 'lucide-react';

import {
  runCompositeBacktest,
  type CompositeApproximationKey,
  type CompositeBacktestChild,
  type CompositeBacktestDone,
  type CompositeBacktestPendingChild,
} from '@/services/portfolioService';
import { getBacktest, listStrategies } from '@/features/strategy-builder/service';
import {
  EquityChart,
  type EquityChartMode,
  type EquityChartSeries,
} from '@/features/strategy-builder/components/EquityChart';
import type { BacktestMetrics, EquityPoint } from '@/features/strategy-builder/types';
import { isApiError } from '@/lib/apiErrors';
import {
  buildCompositeChartRows,
  capitalKey,
  type CompositeChildCurve,
} from '../lib/compositeCurve';

interface CompositeBacktestViewProps {
  portfolioId: string;
  portfolioName: string;
}

const DASH = '—';

/** Sleeve line colors — distinct from the composite (accent) and SPY (dim). */
const SLEEVE_COLORS = [
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

const BASE_MODES: { value: EquityChartMode; label: string }[] = [
  { value: 'index_100', label: 'Base 100' },
  { value: 'capital', label: 'Capital' },
];

/**
 * What the blended curve does NOT model. Rendered expanded, never behind a
 * disclosure: the whole point of #206/#209 is that this result cannot be read
 * as a real backtest of the composite. An unknown key from a future backend
 * still renders (as its raw key) instead of disappearing.
 */
const APPROXIMATION_TEXT: Record<CompositeApproximationKey, string> = {
  no_overlap_netting:
    'No netea el solapamiento: un nombre que está en dos mangas se cuenta dos veces, en lugar de consolidarse en una sola posición como hace el portafolio real.',
  double_counted_costs_on_shared_names:
    'Costos duplicados en los nombres compartidos: cada manga paga su propia comisión y su propio slippage por el mismo papel.',
  fractional_shares:
    'Acciones fraccionarias: la mezcla de curvas no redondea a acciones enteras; el portafolio real sí.',
  composite_cap_not_applied:
    'No aplica el tope por nombre del compuesto: cada manga respeta el suyo, así que la suma de las dos puede pasarse del máximo configurado.',
  no_remix_costs:
    'Sin costos de la re-mezcla: volver a las asignaciones objetivo en cada frontera de la cadencia no paga comisión ni slippage.',
};

// Polling of the children's jobs (202): same idea as the builder, with backoff.
const POLL_START_MS = 2000;
const POLL_MAX_MS = 15000;
const POLL_BACKOFF = 1.5;
/** Give up polling after ~12 min and tell the user to come back. */
const POLL_DEADLINE_MS = 12 * 60 * 1000;

type Phase = 'idle' | 'loading' | 'pending' | 'done' | 'error';

interface ErrorState {
  message: string;
  /** HTTP status when the failure came from the API (422/400/404/…). */
  status: number | null;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const pct = (v: number | null | undefined, d = 1): string =>
  v == null || !Number.isFinite(v) ? DASH : `${v > 0 ? '+' : ''}${(v * 100).toFixed(d)}%`;

const num = (v: number | null | undefined, d = 2): string =>
  v == null || !Number.isFinite(v) ? DASH : v.toFixed(d);

const signClass = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(v) ? '' : v >= 0 ? 'pos' : 'neg';

/** Total return of the SPY series inside the composite window (last/first − 1). */
function benchmarkReturn(equity: readonly EquityPoint[]): number | null {
  const first = equity.find((p) => p.benchmark_value != null)?.benchmark_value ?? null;
  let last: number | null = null;
  for (let i = equity.length - 1; i >= 0; i -= 1) {
    if (equity[i].benchmark_value != null) {
      last = equity[i].benchmark_value;
      break;
    }
  }
  if (first == null || last == null || !first) return null;
  return last / first - 1;
}

/**
 * CompositeBacktestView — the composite portfolio's blended backtest (#209).
 *
 * `POST /portfolios/{id}/composite-backtest` either answers 200 with the blend
 * or 202 with one job per sleeve; on 202 this view shows the per-sleeve progress
 * and re-POSTs (with backoff) after polling the pending children, exactly the
 * way the builder waits for a backtest.
 *
 * It draws the composite, every sleeve and SPY on one rebased chart, tabulates
 * the same metrics the builder shows, and states — expanded — what the blend
 * approximates.
 */
export function CompositeBacktestView({
  portfolioId,
  portfolioName,
}: CompositeBacktestViewProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<CompositeBacktestDone | null>(null);
  const [pending, setPending] = useState<CompositeBacktestPendingChild[]>([]);
  const [error, setError] = useState<ErrorState | null>(null);
  const [baseMode, setBaseMode] = useState<EquityChartMode>('index_100');
  /** Sleeve curves for the overlay, by job id (fetched after the 200). */
  const [childCurves, setChildCurves] = useState<Record<string, EquityPoint[]>>({});
  const [curvesIncomplete, setCurvesIncomplete] = useState(false);
  /** strategy_id → name, so the 202 progress can name each sleeve. */
  const [strategyNames, setStrategyNames] = useState<Record<string, string>>({});

  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight request (and stop the poll loop) when the view goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Sleeve names for the pending progress list (the 202 payload has ids only).
  // Decoration: a failure here just falls back to the id.
  useEffect(() => {
    const controller = new AbortController();
    listStrategies()
      .then((items) => {
        if (controller.signal.aborted) return;
        setStrategyNames(
          Object.fromEntries(items.map((s) => [s.strategy_id, s.name])),
        );
      })
      .catch(() => {
        /* names are cosmetic — the ids still render */
      });
    return () => controller.abort();
  }, []);

  const loadChildCurves = useCallback(
    async (children: CompositeBacktestChild[], signal: AbortSignal) => {
      const settled = await Promise.all(
        children.map(async (c) => {
          try {
            const job = await getBacktest(c.job_id);
            return [c.job_id, job.result?.equity ?? null] as const;
          } catch {
            return [c.job_id, null] as const;
          }
        }),
      );
      if (signal.aborted) return;
      const curves: Record<string, EquityPoint[]> = {};
      let missing = false;
      for (const [jobId, equity] of settled) {
        if (equity && equity.length > 0) curves[jobId] = equity;
        else missing = true;
      }
      setChildCurves(curves);
      setCurvesIncomplete(missing);
    },
    [],
  );

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setPhase('loading');
    setError(null);
    setResult(null);
    setPending([]);
    setChildCurves({});
    setCurvesIncomplete(false);

    const deadline = Date.now() + POLL_DEADLINE_MS;
    let delay = POLL_START_MS;

    try {
      for (;;) {
        const res = await runCompositeBacktest(portfolioId, signal);
        if (signal.aborted) return;

        if (res.status === 'done') {
          setResult(res);
          setPending([]);
          setPhase('done');
          await loadChildCurves(res.children, signal);
          return;
        }

        setPending(res.children);
        setPhase('pending');

        if (Date.now() > deadline) {
          setError({
            message:
              'Los backtests de las mangas siguen corriendo. Volvé a esta pestaña en unos minutos y ejecutá el compuesto de nuevo — los resultados de cada manga quedan cacheados.',
            status: null,
          });
          setPhase('error');
          return;
        }

        await sleep(delay);
        if (signal.aborted) return;
        delay = Math.min(delay * POLL_BACKOFF, POLL_MAX_MS);

        // Poll every child that is not done yet; the per-sleeve status feeds the
        // progress list. The composite itself is re-requested above: the backend
        // is the only one that decides when the blend can be computed.
        const statuses = await Promise.all(
          res.children.map(async (child) => {
            if (child.status === 'done' || child.status === 'error') return child;
            try {
              const job = await getBacktest(child.job_id);
              return { ...child, status: job.status };
            } catch {
              return child;
            }
          }),
        );
        if (signal.aborted) return;
        setPending(statuses);
      }
    } catch (err) {
      if (signal.aborted) return;
      if (isApiError(err)) {
        setError({ message: err.detail ?? err.message, status: err.status });
      } else {
        setError({
          message: 'No se pudo calcular el backtest compuesto. Intentá de nuevo.',
          status: null,
        });
      }
      setPhase('error');
    }
  }, [portfolioId, loadChildCurves]);

  // ---- Chart data -----------------------------------------------------------

  const childCurveInputs: CompositeChildCurve[] = useMemo(() => {
    if (!result) return [];
    return result.children
      .map((child, i) => ({
        key: `sleeve${i}`,
        label: child.name,
        points: childCurves[child.job_id] ?? [],
      }))
      .filter((c) => c.points.length > 0);
  }, [result, childCurves]);

  const rows = useMemo(
    () => (result ? buildCompositeChartRows(result.equity, childCurveInputs) : []),
    [result, childCurveInputs],
  );

  const series: EquityChartSeries[] = useMemo(
    () =>
      childCurveInputs.map((c, i) => ({
        key: c.key,
        capitalKey: capitalKey(c.key),
        label: c.label,
        color: SLEEVE_COLORS[i % SLEEVE_COLORS.length],
      })),
    [childCurveInputs],
  );

  // ---- Render ---------------------------------------------------------------

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="detail-sect-head">
        <div>
          <div className="detail-sect-title">Backtest compuesto</div>
          <div className="card-sub" style={{ marginTop: 4 }}>
            Mezcla las curvas de los backtests de cada manga según su asignación.
            No es un backtest del portafolio compuesto — mirá «Aproximaciones».
          </div>
        </div>
        <button
          type="button"
          className="topbar-btn"
          onClick={run}
          disabled={phase === 'loading' || phase === 'pending'}
          data-testid="composite-backtest-run"
        >
          {phase === 'loading' || phase === 'pending' ? (
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Play size={14} />
          )}
          {phase === 'done' ? 'Recalcular' : 'Backtest compuesto'}
        </button>
      </div>

      {phase === 'idle' && (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ color: 'var(--c-text-soft)', margin: 0, fontSize: 13 }}>
            Ejecutá el backtest compuesto para comparar la mezcla contra cada
            estrategia por separado y contra el S&amp;P 500. Si alguna manga no
            tiene su backtest calculado, se encola y esta vista espera.
          </p>
        </div>
      )}

      {(phase === 'loading' || phase === 'pending') && (
        <PendingPanel
          items={pending}
          strategyNames={strategyNames}
          portfolioName={portfolioName}
        />
      )}

      {phase === 'error' && error && <ErrorPanel error={error} onRetry={run} />}

      {phase === 'done' && result && (
        <>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Curva compuesta vs. mangas vs. SPY</div>
                <div className="card-sub">
                  Ventana común {result.window_start} → {result.window_end} ·
                  re-mezcla {result.cadence} ({result.on}) ·{' '}
                  {result.fill_convention}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }} role="group" aria-label="Base de la curva">
                {BASE_MODES.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    className="chip"
                    aria-pressed={baseMode === b.value}
                    onClick={() => setBaseMode(b.value)}
                    style={
                      baseMode === b.value
                        ? { borderColor: 'var(--c-accent)', color: 'var(--c-accent)' }
                        : undefined
                    }
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: '12px 8px 4px' }}>
              <div className="perf-legend" style={{ padding: '0 8px 8px', flexWrap: 'wrap' }}>
                <span>
                  <span className="dot" style={{ background: 'var(--c-accent)' }} />
                  {portfolioName} (compuesto)
                </span>
                {series.map((s) => (
                  <span key={s.key}>
                    <span className="dot" style={{ background: s.color }} />
                    {s.label}
                  </span>
                ))}
                <span>
                  <span className="dot" style={{ background: 'var(--c-text-dim)' }} />
                  S&amp;P 500 (SPY)
                </span>
              </div>
              <EquityChart
                data={rows}
                name={`${portfolioName} (compuesto)`}
                mode={baseMode}
                extraSeries={series}
                height={320}
              />
              {curvesIncomplete && (
                <p
                  style={{
                    margin: '4px 8px 8px',
                    fontSize: 11.5,
                    color: 'var(--c-text-dim)',
                  }}
                >
                  Alguna manga no devolvió su curva: el gráfico muestra las que sí
                  llegaron; la tabla de métricas está completa.
                </p>
              )}
            </div>
          </div>

          <MetricsTable result={result} />
          <ApproximationsBlock keys={result.approximations} />
        </>
      )}
    </div>
  );
}

// =============================================================================
// Pending (202) — per-sleeve progress
// =============================================================================

const STATUS_LABEL: Record<string, string> = {
  queued: 'En cola',
  running: 'Corriendo',
  done: 'Listo',
  error: 'Error',
};

function PendingPanel({
  items,
  strategyNames,
  portfolioName,
}: {
  items: CompositeBacktestPendingChild[];
  strategyNames: Record<string, string>;
  portfolioName: string;
}) {
  const doneCount = items.filter((c) => c.status === 'done').length;
  return (
    <div className="card" data-testid="composite-backtest-pending">
      <div className="card-head">
        <div>
          <div className="card-title">Calculando las mangas de {portfolioName}…</div>
          <div className="card-sub">
            {items.length > 0
              ? `${doneCount} de ${items.length} backtests listos. Cada manga se corre una sola vez y queda cacheada.`
              : 'Encolando los backtests de cada manga…'}
          </div>
        </div>
        <Loader2
          size={18}
          color="var(--c-text-dim)"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>
      {items.length > 0 && (
        <table className="tbl">
          <thead>
            <tr>
              <th>Manga</th>
              <th>Versión</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.job_id}>
                <td className="name-cell">
                  {strategyNames[c.strategy_id] ?? c.strategy_id.slice(0, 8)}
                </td>
                <td className="dim">v{c.version}</td>
                <td className={c.status === 'error' ? 'neg' : c.status === 'done' ? 'pos' : 'dim'}>
                  {STATUS_LABEL[c.status] ?? c.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// =============================================================================
// Error (422 / 400 / 404 / network)
// =============================================================================

function errorTitle(status: number | null): string {
  if (status === 400) return 'Este portafolio no es compuesto';
  if (status === 404) return 'No se encontró el portafolio';
  if (status === 422) return 'No se puede componer la curva';
  return 'No se pudo calcular el backtest compuesto';
}

function ErrorPanel({ error, onRetry }: { error: ErrorState; onRetry: () => void }) {
  return (
    <div className="card" style={{ padding: 24 }} data-testid="composite-backtest-error">
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <AlertTriangle size={18} color="var(--c-warn)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            {errorTitle(error.status)}
          </div>
          <p style={{ margin: 0, color: 'var(--c-text-soft)', fontSize: 13 }}>
            {error.message}
          </p>
          {error.status === 422 && (
            <p style={{ margin: '8px 0 0', color: 'var(--c-text-dim)', fontSize: 12 }}>
              La ventana del compuesto es la intersección de las ventanas de sus
              mangas: si una estrategia tiene poca historia, la mezcla se queda sin
              días suficientes (mínimo 60).
            </p>
          )}
          {error.status !== 400 && error.status !== 404 && (
            <button
              type="button"
              className="topbar-btn"
              style={{ marginTop: 12 }}
              onClick={onRetry}
            >
              Reintentar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Metrics — composite + one row per sleeve + SPY, same columns as the builder
// =============================================================================

interface MetricsRow {
  label: string;
  strategyId: string | null;
  allocation: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  metrics: BacktestMetrics | null;
  /** SPY row: only the total return over the composite window is known. */
  totalReturnOnly?: number | null;
  emphasis?: boolean;
}

function MetricsTable({ result }: { result: CompositeBacktestDone }) {
  const rows: MetricsRow[] = [
    {
      label: 'Compuesto',
      strategyId: null,
      allocation: 1,
      windowStart: result.window_start,
      windowEnd: result.window_end,
      metrics: result.metrics,
      emphasis: true,
    },
    ...result.children.map((c) => ({
      label: c.name,
      strategyId: c.strategy_id,
      allocation: c.allocation,
      windowStart: c.window_start,
      windowEnd: c.window_end,
      metrics: c.metrics,
    })),
    {
      label: 'S&P 500 (SPY)',
      strategyId: null,
      allocation: null,
      windowStart: result.window_start,
      windowEnd: result.window_end,
      metrics: null,
      totalReturnOnly: benchmarkReturn(result.equity),
    },
  ];

  return (
    <div className="card" data-testid="composite-backtest-metrics">
      <div className="card-head">
        <div>
          <div className="card-title">Métricas</div>
          <div className="card-sub">
            El compuesto sobre la ventana común; cada manga sobre su propia ventana
            completa (por eso las fechas no coinciden). El gráfico sí recorta todo a
            la ventana común.
          </div>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Serie</th>
              <th className="num">Asignación</th>
              <th>Ventana</th>
              <th className="num">Total return</th>
              <th className="num">CAGR</th>
              <th className="num">Sharpe</th>
              <th className="num">Sortino</th>
              <th className="num">Calmar</th>
              <th className="num">Max DD</th>
              <th className="num">Alpha</th>
              <th className="num">Beta</th>
              <th className="num">Trades</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = r.metrics;
              const totalReturn = m ? m.total_return : (r.totalReturnOnly ?? null);
              return (
                <tr key={`${r.label}-${r.strategyId ?? 'none'}`}>
                  <td
                    className="name-cell"
                    style={r.emphasis ? { fontWeight: 600 } : undefined}
                  >
                    {r.strategyId ? (
                      <Link
                        to={`/dashboard/strategy/${r.strategyId}`}
                        style={{
                          color: 'var(--c-accent)',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {r.label}
                        <ExternalLink size={11} />
                      </Link>
                    ) : (
                      r.label
                    )}
                  </td>
                  <td className="num dim">
                    {r.allocation == null ? DASH : `${(r.allocation * 100).toFixed(0)}%`}
                  </td>
                  <td className="dim" style={{ whiteSpace: 'nowrap', fontSize: 11.5 }}>
                    {r.windowStart && r.windowEnd
                      ? `${r.windowStart} → ${r.windowEnd}`
                      : DASH}
                  </td>
                  <td className={`num ${signClass(totalReturn)}`}>{pct(totalReturn)}</td>
                  <td className={`num ${signClass(m?.cagr)}`}>{m ? pct(m.cagr) : DASH}</td>
                  <td className="num">{m ? num(m.sharpe) : DASH}</td>
                  <td className="num">{m ? num(m.sortino) : DASH}</td>
                  <td className="num">{m ? num(m.calmar) : DASH}</td>
                  <td className="num neg">{m ? pct(m.max_drawdown) : DASH}</td>
                  <td className={`num ${signClass(m?.alpha)}`}>{m ? pct(m.alpha) : DASH}</td>
                  <td className="num">{m ? num(m.beta) : DASH}</td>
                  <td className="num">
                    {m ? m.n_trades : DASH}
                    {m?.low_sample_trades && (
                      <span title="Pocos trades — ratios indicativos"> ⚠</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// Approximations — always expanded (#209)
// =============================================================================

function ApproximationsBlock({ keys }: { keys: string[] }) {
  return (
    <div
      className="card"
      style={{ borderColor: 'var(--c-warn)' }}
      data-testid="composite-backtest-approximations"
    >
      <div className="card-head">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={16} color="var(--c-warn)" />
          <div>
            <div className="card-title">Aproximaciones</div>
            <div className="card-sub">
              Esta curva mezcla los backtests de las mangas; el motor nunca corrió
              el compuesto como una sola cartera.
            </div>
          </div>
        </div>
      </div>
      <ul style={{ margin: 0, padding: '12px 16px 14px 32px', display: 'grid', gap: 8 }}>
        {keys.map((k) => (
          <li key={k} style={{ fontSize: 13, color: 'var(--c-text-soft)' }}>
            {APPROXIMATION_TEXT[k as CompositeApproximationKey] ?? k}
          </li>
        ))}
        {keys.length === 0 && (
          <li style={{ fontSize: 13, color: 'var(--c-text-dim)' }}>
            El backend no declaró aproximaciones para este resultado.
          </li>
        )}
      </ul>
    </div>
  );
}
