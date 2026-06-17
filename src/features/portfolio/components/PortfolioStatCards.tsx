/**
 * PortfolioStatCards
 *
 * Top-of-page summary tiles for the Portfolio Analysis view. Fetches aggregate
 * metrics across all of the user's portfolios from GET /portfolios/summary.
 *
 * This is a non-critical widget: on fetch failure it falls back to dashes
 * rather than surfacing an error or crashing the page.
 */
import { useEffect, useState } from 'react';
import {
  getPortfolioSummary,
  type PortfolioSummary,
} from '@/services/portfolioService';
import { fmtDate } from '../lib/format';

const DASH = '—';

const compactCurrency = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

/** Compact currency, e.g. 3495475.07 -> "$3.5M" (null -> "—"). */
function fmtCompactCurrency(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return DASH;
  return `$${compactCurrency.format(n)}`;
}

/** Signed compact currency, e.g. -68436.92 -> "-$68.44K", 1.2e6 -> "+$1.2M". */
function fmtSignedCompactCurrency(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return DASH;
  const sign = n < 0 ? '-' : '+';
  return `${sign}$${compactCurrency.format(Math.abs(n))}`;
}

/** Signed percent, e.g. 6.55 -> "+6.55%", -1.92 -> "-1.92%" (null -> "—"). */
function fmtSignedPercent(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return DASH;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

/** ".pos" / ".neg" / "" by sign of a (possibly null) number. */
function signClass(n: number | null): string {
  if (n === null || !Number.isFinite(n) || n === 0) return '';
  return n > 0 ? 'pos' : 'neg';
}

export function PortfolioStatCards() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // isLoading starts true; this effect runs once on mount, so there's no
    // need to reset it here (and doing so trips react-hooks/set-state-in-effect).
    const controller = new AbortController();

    getPortfolioSummary(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setSummary(data);
      })
      .catch((err) => {
        // Aborted on unmount — ignore. axios flattens AbortError/ERR_CANCELED
        // into a generic ApiError, so the signal is the reliable marker.
        if (controller.signal.aborted) return;
        // Non-critical widget: keep dashes, log for diagnostics.
        console.error('Failed to load portfolio summary:', err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, []);

  const ready = !isLoading && summary !== null;

  const totalAum = ready ? fmtCompactCurrency(summary.total_aum) : DASH;

  const ytdPct = ready ? summary.ytd_pct : null;
  const ytdValue = ready ? fmtSignedPercent(ytdPct) : DASH;
  const ytdSub =
    ready && summary.ytd_anchor_date
      ? `desde ${fmtDate(summary.ytd_anchor_date)} · ponderado por AUM`
      : 'Ponderado por AUM';

  const pnlAbs = ready ? summary.todays_pnl_abs : null;
  const pnlPct = ready ? summary.todays_pnl_pct : null;
  const pnlValue = ready ? fmtSignedCompactCurrency(pnlAbs) : DASH;
  const pnlDelta = ready ? fmtSignedPercent(pnlPct) : DASH;

  const eventsTotal = ready ? summary.events_24h.total : null;
  const eventsValue = ready ? String(summary.events_24h.total) : DASH;
  const eventsDelta = ready
    ? `↑${summary.events_24h.upgrades} · ↓${summary.events_24h.downgrades}`
    : DASH;

  return (
    <div className="stat-row">
      {/* Total AUM */}
      <div className="stat-card">
        <div className="stat-label">Total AUM</div>
        <div className={`stat-value${totalAum === DASH ? ' placeholder' : ''}`}>
          {totalAum}
        </div>
        <div className="stat-delta">
          <span>Aggregated across portfolios</span>
        </div>
      </div>

      {/* Avg. YTD */}
      <div className="stat-card">
        <div className="stat-label">Avg. YTD</div>
        <div
          className={`stat-value${ytdValue === DASH ? ' placeholder' : ''} ${signClass(ytdPct)}`}
        >
          {ytdValue}
        </div>
        <div className="stat-delta">
          <span>{ytdSub}</span>
        </div>
      </div>

      {/* Today's P&L */}
      <div className="stat-card">
        <div className="stat-label">Today&apos;s P&amp;L</div>
        <div
          className={`stat-value${pnlValue === DASH ? ' placeholder' : ''} ${signClass(pnlAbs)}`}
        >
          {pnlValue}
        </div>
        <div className={`stat-delta ${signClass(pnlPct)}`}>
          <span>{pnlDelta}</span>
        </div>
      </div>

      {/* Events (24h) */}
      <div className="stat-card">
        <div className="stat-label">Events (24h)</div>
        <div
          className={`stat-value${eventsTotal === null ? ' placeholder' : ''}`}
        >
          {eventsValue}
        </div>
        <div className="stat-delta">
          <span>{eventsDelta}</span>
        </div>
        <div className="stat-delta">
          <span>Upgrades · Downgrades</span>
        </div>
      </div>
    </div>
  );
}
