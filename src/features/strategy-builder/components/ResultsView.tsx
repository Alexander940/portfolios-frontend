import { useState } from 'react';

import { useBaskets } from '../hooks/useBaskets';
import { Icon } from '../icons';
import { formatUsd, type DisplayResult } from '../mapping';
import { downloadTradesCsv } from '../service';
import { Tip } from './formBits';
import { EquityChart, type EquityChartMode } from './EquityChart';
import { RebalancesView } from './RebalancesView';
import { SelectionTraceView } from './SelectionTraceView';

const fmtPct = (v: number, d = 1) => `${v > 0 ? '+' : ''}${v.toFixed(d)}%`;
// Magnitude percent (turnover / cost drag) — no forced sign, they aren't gains.
const fmtPctPlain = (v: number, d = 1) => `${v.toFixed(d)}%`;
/** Threshold (%, two-sided/annualized) above which turnover is "high" for the
 *  zero-cost warning — 100% = the whole book turned over once in a year. */
const HIGH_TURNOVER_PCT_ANNUAL = 100;

// Chart base toggle — mirrors the portfolio performance chart (#134).
const BASE_MODES: { value: EquityChartMode; label: string }[] = [
  { value: 'index_100', label: 'Base 100' },
  { value: 'capital', label: 'Capital inicial' },
];

type Status = 'running' | 'error' | 'done';

interface Props {
  status: Status;
  result: DisplayResult | null;
  strategyName: string;
  errorMsg?: string | null;
  /** Informational banner over the results — e.g. "dates haven't changed,
   *  showing the existing result" when the run deduped to a cached backtest. */
  notice?: string | null;
  /** Whether the spec this result ran with has `costs.commission_bps === 0 &&
   *  costs.slippage_bps === 0` (issue #156) — feeds the zero-friction warning
   *  when paired with high turnover. */
  costsAreZero?: boolean;
  /** The completed backtest's job id — feeds the Selection tab's
   *  `GET /backtests/{job_id}/selection-trace` call (#174). Null for a result
   *  the tab can't identify a job for (shouldn't happen once status is
   *  'done', but the tab degrades to an empty state rather than crashing). */
  jobId?: string | null;
  progressStep?: string;
  /** Rebalance cadence of the spec behind this result (header of the
   *  «Rebalanceos» tab, #278). */
  cadence?: string | null;
  /** #296 — the basket the run's universe came from (null/absent = filters).
   *  Feeds the «Universe: Basket · {name}» badge; the name is looked up in the
   *  caller's basket list. */
  universeBasketId?: string | null;
  /** Re-run the active strategy skipping the dedupe (`force: true`) — the
   *  «Volver a correr» button of a result saved before the rebalances table
   *  (#278, D2). */
  onRerun?: () => void;
  onRetry: () => void;
  onEdit: () => void;
}

type ResultsTab = 'overview' | 'selection' | 'rebalances';

/** Readable label for a warning's `code:` prefix (#292/#294); the rest of the
 *  string is the backend's own explanation and is shown as-is. */
const WARNING_LABELS: Record<string, string> = {
  basket_user_static: 'Custom basket — survivorship bias',
  basket_weight: 'Index weight fallback',
};

function splitWarning(w: string): { label: string | null; text: string } {
  const m = w.match(/^([a-z0-9_]+):\s*(.*)$/s);
  if (!m) return { label: null, text: w };
  return { label: WARNING_LABELS[m[1]] ?? m[1].replace(/_/g, ' '), text: m[2] };
}

function UniverseBadge({ basketId }: { basketId: string | null }) {
  const { baskets } = useBaskets(!!basketId);
  if (!basketId) {
    return (
      <span className="sb-universe-badge" data-testid="sb-universe-badge">
        Universe: Filters
      </span>
    );
  }
  const name = baskets.find((b) => b.basket_id === basketId)?.name;
  return (
    <span className="sb-universe-badge basket" data-testid="sb-universe-badge">
      {name ? `Universe: Basket · ${name}` : 'Universe: Basket'}
    </span>
  );
}

function MetricsGrid({ m, fillsCount }: { m: DisplayResult['metrics']; fillsCount: number }) {
  const cells: {
    k: string;
    v: string;
    cls: string;
    sub: string;
    flag?: boolean;
    tip?: string;
    testId?: string;
  }[] = [
    { k: 'Total return', v: fmtPct(m.totalReturn, 1), cls: m.totalReturn >= 0 ? 'pos' : 'neg', sub: `vs ${fmtPct(m.benchReturn, 1)} SPY` },
    { k: 'CAGR', v: fmtPct(m.cagr, 1), cls: m.cagr >= 0 ? 'pos' : 'neg', sub: 'annualized' },
    { k: 'Sharpe', v: m.sharpe.toFixed(2), cls: '', sub: 'risk-adjusted', flag: m.lowConf },
    { k: 'Sortino', v: m.sortino.toFixed(2), cls: '', sub: 'downside-adj.', flag: m.lowConf },
    { k: 'Calmar', v: m.calmar.toFixed(2), cls: '', sub: 'return / max DD', flag: m.lowConf },
    { k: 'Max drawdown', v: fmtPct(m.maxDD, 1), cls: 'neg', sub: 'peak to trough' },
    { k: 'Alpha / Beta', v: fmtPct(m.alpha, 1), cls: m.alpha >= 0 ? 'pos' : 'neg', sub: `β ${m.beta.toFixed(2)}` },
    // #283: `n_trades` counts positions OPENED (0 → >0), not fills — the card
    // says so and shows the fill count underneath so the two never get mixed up.
    {
      k: 'Entradas',
      v: String(m.trades),
      cls: '',
      sub: `${fillsCount} fills`,
      flag: m.lowConf,
      tip: 'Posiciones abiertas (0 → >0). low_sample_trades se evalúa sobre este número, no sobre los fills.',
      testId: 'sb-metric-entries',
    },
  ];
  return (
    <div className="sb-metrics-grid" data-testid="sb-metrics">
      {cells.map((c, i) => (
        <div key={i} className={`sb-metric-cell ${c.flag ? 'flagged' : ''}`} data-testid={c.testId}>
          <div className="mk">
            {c.k}
            {c.tip && <Tip text={c.tip} />}
            {c.flag && (
              <span className="sb-lowconf-pip" title="Low confidence — few trades">
                <Icon name="warn" size={11} />
              </span>
            )}
          </div>
          <div className={`mv ${c.cls}`}>{c.v}</div>
          <div className="msub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

/** Turnover / cost-drag row (issue #156). Renders nothing for a legacy result
 *  (no `turnoverPctAnnual`) — the 174 backtests saved before #155 shipped don't
 *  carry these fields, and this must not render NaN/undefined for them. Every
 *  other field falls back to an em dash rather than crashing if it's somehow
 *  missing on its own. */
function TurnoverGrid({ m }: { m: DisplayResult['metrics'] }) {
  if (m.turnoverPctAnnual == null) return null;
  const cells: {
    k: string;
    v: string;
    sub: string;
    tip?: string;
    cls?: string;
    extra?: string | null;
    testId?: string;
  }[] = [
    {
      k: 'Turnover',
      tip: 'Annualized two-sided turnover: (Σ sells + Σ buys) / (2 × average equity). 100% = the whole portfolio turned over once in a year.',
      v: fmtPctPlain(m.turnoverPctAnnual, 0),
      sub: 'annualized, two-sided',
    },
    {
      k: 'Total costs',
      v: m.totalCosts != null ? formatUsd(m.totalCosts) : '—',
      sub: 'commission + slippage',
    },
    {
      k: 'Cost drag',
      v: m.costDragPctAnnual != null ? fmtPctPlain(m.costDragPctAnnual, 2) : '—',
      cls: m.costDragPctAnnual ? 'neg' : '',
      sub: 'return given up / yr',
    },
    {
      k: 'Avg. holding',
      tip: 'Días de calendario entre la entrada y la salida completa de cada posición cerrada; los recortes parciales no cuentan.',
      v: m.avgHoldingDays != null ? `${m.avgHoldingDays.toFixed(0)}d` : '—',
      sub: 'entry to exit',
      // #283: the pre-#283 FIFO-lot definition, only on results computed after
      // it shipped — older results carry no `avg_lot_days` and show nothing.
      extra:
        m.avgLotDays != null && Number.isFinite(m.avgLotDays)
          ? `por lote FIFO: ${m.avgLotDays.toFixed(0)} d`
          : null,
      testId: 'sb-metric-avg-holding',
    },
    {
      k: 'Exits',
      v: m.nExits != null ? String(m.nExits) : '—',
      sub: 'positions closed',
    },
  ];
  return (
    <div className="sb-metrics-grid" data-testid="sb-turnover-metrics">
      {cells.map((c, i) => (
        <div key={i} className="sb-metric-cell" data-testid={c.testId}>
          <div className="mk">
            {c.k}
            {c.tip && <Tip text={c.tip} />}
          </div>
          <div className={`mv ${c.cls ?? ''}`}>{c.v}</div>
          <div className="msub">{c.sub}</div>
          {c.extra && (
            <div className="msub" data-testid="sb-avg-lot-days">
              {c.extra}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ResultsView({
  status,
  result,
  strategyName,
  errorMsg,
  notice,
  costsAreZero,
  jobId,
  progressStep,
  cadence,
  universeBasketId,
  onRerun,
  onRetry,
  onEdit,
}: Props) {
  const [baseMode, setBaseMode] = useState<EquityChartMode>('index_100');
  const [tab, setTab] = useState<ResultsTab>('overview');
  const [csvBusy, setCsvBusy] = useState(false);

  if (status === 'running') {
    return (
      <div className="sb-running">
        <div className="sb-running-spinner" />
        <h3>Running backtest…</h3>
        <p>
          Simulating <b>{strategyName}</b> over the validation window. A full run can take a few minutes — you can keep this tab open.
        </p>
        <div className="sb-progress-track">
          <div className="sb-progress-fill" style={{ width: '70%' }} />
        </div>
        <div className="sb-running-step">{progressStep ?? 'Running event-driven simulation…'}</div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="sb-error">
        <div className="sb-error-mark">
          <Icon name="warn" size={22} />
        </div>
        <h3>Backtest failed</h3>
        <p>{errorMsg ?? 'The engine could not complete this run. Try widening the universe or shortening the date range.'}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="sb-btn" style={{ width: 'auto' }} onClick={onEdit}>
            Edit strategy
          </button>
          <button className="sb-btn accent" style={{ width: 'auto' }} onClick={onRetry}>
            <Icon name="refresh" size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!result) return null;
  const m = result.metrics;
  const turnoverPctAnnual = m.turnoverPctAnnual;
  const zeroCostHighTurnover =
    !!costsAreZero && turnoverPctAnnual != null && turnoverPctAnnual >= HIGH_TURNOVER_PCT_ANNUAL;

  return (
    <div className="sb-results" data-testid="sb-results">
      <div className="sb-results-head">
        <UniverseBadge basketId={universeBasketId ?? null} />
      </div>

      {result.warnings.length > 0 && (
        <div className="sb-lowconf-banner" data-testid="sb-backtest-warnings">
          <span className="ic">
            <Icon name="warn" size={18} />
          </span>
          <span>
            <b>Warnings</b>
            <ul className="sb-warnings-list">
              {result.warnings.map((w, i) => {
                const { label, text } = splitWarning(w);
                return (
                  <li key={i} data-testid="sb-backtest-warning">
                    {label && <b>{label}: </b>}
                    {text}
                  </li>
                );
              })}
            </ul>
          </span>
        </div>
      )}

      {notice && (
        <div className="sb-lowconf-banner" data-testid="sb-cached-notice">
          <span className="ic">
            <Icon name="warn" size={18} />
          </span>
          <span>{notice}</span>
        </div>
      )}

      {zeroCostHighTurnover && turnoverPctAnnual != null && (
        <div className="sb-lowconf-banner" data-testid="sb-zero-cost-warning">
          <span className="ic">
            <Icon name="warn" size={18} />
          </span>
          <span>
            <b>Zero-friction result.</b> Commission and slippage are both set to{' '}
            <b>0 bps</b> while this strategy turns over{' '}
            <b>{fmtPctPlain(turnoverPctAnnual, 0)}</b> of the book a year — real-world
            trading costs would materially cut this return. Add realistic costs in{' '}
            <b>Section 6 (Costs)</b> to sanity-check the result.
          </span>
        </div>
      )}

      {m.lowConf && (
        <div className="sb-lowconf-banner">
          <span className="ic">
            <Icon name="warn" size={18} />
          </span>
          <span>
            <b>Low-confidence result.</b> This strategy opened only <b>{m.trades} entradas</b> (positions, not fills) — below the minimum threshold for statistical significance. Risk-adjusted ratios (Sharpe, Sortino, Calmar) are flagged and should be treated as indicative.
          </span>
        </div>
      )}

      <MetricsGrid m={m} fillsCount={result.fills.length} />
      <TurnoverGrid m={m} />

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'overview'}
          className={`tab ${tab === 'overview' ? 'active' : ''}`}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'selection'}
          className={`tab ${tab === 'selection' ? 'active' : ''}`}
          onClick={() => setTab('selection')}
          data-testid="sb-tab-selection"
        >
          Selection
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'rebalances'}
          className={`tab ${tab === 'rebalances' ? 'active' : ''}`}
          onClick={() => setTab('rebalances')}
          data-testid="sb-tab-rebalances"
        >
          Rebalanceos
        </button>
      </div>

      {tab === 'overview' && (
        <>
          <div className="sb-chart-card" data-testid="sb-equity-chart">
            <div className="sb-chart-head">
              <div className="sb-chart-title">Equity curve</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div className="sb-chart-legend">
                  <span>
                    <span className="dot" style={{ background: 'var(--c-accent)' }} />
                    {strategyName}
                  </span>
                  <span>
                    <span className="dot dash" />
                    S&amp;P 500 (SPY)
                  </span>
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
            </div>
            <EquityChart data={result.curve} name={strategyName} mode={baseMode} />
          </div>

          {/* #278 fase 4: the flat trade log moved to the per-rebalance detail;
              the full log stays one click away as a CSV. */}
          <div className="sb-rb-overview-links" data-testid="sb-trades-links">
            <button
              type="button"
              className="sb-link"
              disabled={!jobId || csvBusy}
              onClick={() => {
                if (!jobId) return;
                setCsvBusy(true);
                downloadTradesCsv(jobId)
                  .catch(() => window.alert('No se pudo descargar el CSV.'))
                  .finally(() => setCsvBusy(false));
              }}
            >
              Trade log completo (CSV)
            </button>
            <span className="dim">·</span>
            <button type="button" className="sb-link" onClick={() => setTab('rebalances')}>
              Ver por rebalanceo
            </button>
            <span className="dim">{result.fills.length} fills en total</span>
          </div>
        </>
      )}

      {tab === 'selection' && <SelectionTraceView jobId={jobId ?? null} />}

      {tab === 'rebalances' && (
        <RebalancesView jobId={jobId ?? null} cadence={cadence} onRerun={onRerun} />
      )}
    </div>
  );
}
