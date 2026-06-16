import { useMemo, useState } from 'react';

import { Icon } from '../icons';
import type { DisplayResult } from '../mapping';
import { EquityChart } from './EquityChart';

const fmtPct = (v: number, d = 1) => `${v > 0 ? '+' : ''}${v.toFixed(d)}%`;
const fmtNum = (v: number, d = 2) =>
  v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

type Status = 'running' | 'error' | 'done';

interface Props {
  status: Status;
  result: DisplayResult | null;
  strategyName: string;
  errorMsg?: string | null;
  progressStep?: string;
  onRetry: () => void;
  onEdit: () => void;
}

function MetricsGrid({ m }: { m: DisplayResult['metrics'] }) {
  const cells = [
    { k: 'Total return', v: fmtPct(m.totalReturn, 1), cls: m.totalReturn >= 0 ? 'pos' : 'neg', sub: `vs ${fmtPct(m.benchReturn, 1)} SPY` },
    { k: 'CAGR', v: fmtPct(m.cagr, 1), cls: m.cagr >= 0 ? 'pos' : 'neg', sub: 'annualized' },
    { k: 'Sharpe', v: m.sharpe.toFixed(2), cls: '', sub: 'risk-adjusted', flag: m.lowConf },
    { k: 'Sortino', v: m.sortino.toFixed(2), cls: '', sub: 'downside-adj.', flag: m.lowConf },
    { k: 'Calmar', v: m.calmar.toFixed(2), cls: '', sub: 'return / max DD', flag: m.lowConf },
    { k: 'Max drawdown', v: fmtPct(m.maxDD, 1), cls: 'neg', sub: 'peak to trough' },
    { k: 'Alpha / Beta', v: fmtPct(m.alpha, 1), cls: m.alpha >= 0 ? 'pos' : 'neg', sub: `β ${m.beta.toFixed(2)}` },
    { k: 'Trades', v: String(m.trades), cls: '', sub: m.lowConf ? 'low sample' : 'executed', flag: m.lowConf },
  ];
  return (
    <div className="sb-metrics-grid" data-testid="sb-metrics">
      {cells.map((c, i) => (
        <div key={i} className={`sb-metric-cell ${c.flag ? 'flagged' : ''}`}>
          <div className="mk">
            {c.k}
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

function FillsTable({ fills }: { fills: DisplayResult['fills'] }) {
  const [page, setPage] = useState(0);
  const perPage = 10;
  const pages = Math.ceil(fills.length / perPage);
  const rows = useMemo(() => fills.slice(page * perPage, page * perPage + perPage), [fills, page]);

  if (fills.length === 0) {
    return <div className="sb-trades-empty">No trades were generated for this configuration.</div>;
  }

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Date</th>
              <th>Side</th>
              <th className="num">Shares</th>
              <th className="num">Price</th>
              <th className="num">Value</th>
              <th className="num">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={`${t.symbol_id}-${t.date}-${i}`}>
                <td style={{ fontWeight: 600 }}>{t.ticker ?? '—'}</td>
                <td className="dim">{t.date}</td>
                <td className={t.side === 'buy' ? 'pos' : 'neg'}>{t.side}</td>
                <td className="num">{fmtNum(t.shares)}</td>
                <td className="num">${fmtNum(t.price)}</td>
                <td className="num">${fmtNum(t.value)}</td>
                <td className="num dim">${fmtNum(t.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sb-pagination">
        <button className="sb-page-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          ← Prev
        </button>
        <button className="sb-page-btn" disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>
          Next →
        </button>
        <div style={{ flex: 1 }} />
        <span className="sb-page-info">
          {page * perPage + 1}–{Math.min((page + 1) * perPage, fills.length)} of {fills.length} fills
        </span>
      </div>
    </>
  );
}

export function ResultsView({ status, result, strategyName, errorMsg, progressStep, onRetry, onEdit }: Props) {
  if (status === 'running') {
    return (
      <div className="sb-running">
        <div className="sb-running-spinner" />
        <h3>Running backtest…</h3>
        <p>
          Simulating <b>{strategyName}</b> over the validation window. This can take a moment.
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

  return (
    <div className="sb-results" data-testid="sb-results">
      {m.lowConf && (
        <div className="sb-lowconf-banner">
          <span className="ic">
            <Icon name="warn" size={18} />
          </span>
          <span>
            <b>Low-confidence result.</b> This strategy executed only <b>{m.trades} trades</b> — below the minimum threshold for statistical significance. Risk-adjusted ratios (Sharpe, Sortino, Calmar) are flagged and should be treated as indicative.
          </span>
        </div>
      )}

      <MetricsGrid m={m} />

      <div className="sb-chart-card" data-testid="sb-equity-chart">
        <div className="sb-chart-head">
          <div className="sb-chart-title">Equity curve</div>
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
        </div>
        <EquityChart data={result.curve} name={strategyName} />
      </div>

      <div className="card">
        <div className="card-head sb-trades-head">
          <div>
            <div className="card-title">Trade log</div>
            <div className="card-sub">Every fill the strategy executed (next-open, net of costs)</div>
          </div>
        </div>
        <FillsTable fills={result.fills} />
      </div>
    </div>
  );
}
