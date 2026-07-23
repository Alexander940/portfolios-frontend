import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { getErrorMessage } from '@/lib/apiErrors';
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from '@/lib/format';
import {
  getRebalanceDetail,
  type RebalanceDiffAction,
  type RebalanceHistoryDetail,
  type RebalanceHistoryItem,
  type RebalancePreStateHolding,
  type RebalanceSkipReason,
  type RebalanceSpecUsed,
} from '@/services/portfolioService';

interface RebalanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioId: string;
  /** The history row being inspected; null renders nothing (modal closed). */
  item: RebalanceHistoryItem | null;
}

/** Same palette the rebalance-preview modal uses for the diff actions. */
const ACTION_BADGE: Record<RebalanceDiffAction, { text: string; cls: string }> = {
  entry: { text: 'entries', cls: 'bg-green-100 text-green-700' },
  increase: { text: 'increases', cls: 'bg-blue-100 text-blue-700' },
  reduction: { text: 'reductions', cls: 'bg-amber-100 text-amber-800' },
  exit: { text: 'exits', cls: 'bg-red-100 text-red-700' },
  unchanged: { text: 'unchanged', cls: 'bg-gray-100 text-gray-500' },
};

const SINGULAR: Record<RebalanceDiffAction, string> = {
  entry: 'entry',
  increase: 'increase',
  reduction: 'reduction',
  exit: 'exit',
  unchanged: 'unchanged',
};

const SKIP_REASON: Record<RebalanceSkipReason, string> = {
  no_price: 'no current price data',
  too_small: 'allocation too small to buy one share',
};

const WEIGHTING_LABELS: Record<string, string> = {
  equal: 'Equal Weight',
  rating_weighted: 'Rating Weighted',
  market_cap: 'Market Cap',
};

const DASH = '—';

/**
 * Human-readable one-liner for the stored selection spec, e.g.
 * "Weighting: Equal Weight · Top 20 by rating desc". Null when the spec
 * carries neither weighting nor ranking (nothing worth showing).
 */
function specSummary(spec: RebalanceSpecUsed | null): string | null {
  if (!spec) return null;
  const parts: string[] = [];
  if (typeof spec.weighting_method === 'string' && spec.weighting_method) {
    parts.push(
      `Weighting: ${WEIGHTING_LABELS[spec.weighting_method] ?? spec.weighting_method}`,
    );
  }
  const ranking = spec.ranking;
  if (ranking && typeof ranking === 'object') {
    const topN = Number(ranking.top_n);
    const sortBy = typeof ranking.sort_by === 'string' ? ranking.sort_by : null;
    const sortOrder =
      typeof ranking.sort_order === 'string' ? ranking.sort_order : '';
    if (Number.isFinite(topN) && topN >= 1 && sortBy) {
      parts.push(`Top ${topN} by ${sortBy}${sortOrder ? ` ${sortOrder}` : ''}`);
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/** Sort holdings by pre-rebalance value desc, null-value rows last. */
function sortHoldings(
  holdings: RebalancePreStateHolding[],
): RebalancePreStateHolding[] {
  return [...holdings].sort((a, b) => {
    if (a.value === null && b.value === null)
      return a.ticker.localeCompare(b.ticker);
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return b.value - a.value;
  });
}

/**
 * RebalanceDetailModal (US7 #115)
 *
 * Read-only drill-down of one applied rebalance: the portfolio's totals,
 * holdings and sector mix just BEFORE the plan ran, plus the full diff summary
 * (incl. skipped/warnings) and the selection spec that produced it. Fetches
 * GET /portfolios/{id}/rebalances/{rebalance_id} each time it opens.
 */
export function RebalanceDetailModal({
  isOpen,
  onClose,
  portfolioId,
  item,
}: RebalanceDetailModalProps) {
  const [detail, setDetail] = useState<RebalanceHistoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const rebalanceId = item?.rebalance_id ?? null;

  useEffect(() => {
    if (!isOpen || !rebalanceId) return;

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    // Reset synchronously on open/retry — same request-lifecycle pattern as
    // the other self-fetching portfolio blocks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
    setIsLoading(true);
    setError(null);

    getRebalanceDetail(portfolioId, rebalanceId, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setDetail(res);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, portfolioId, rebalanceId, attempt]);

  const holdings = useMemo(
    () => (detail ? sortHoldings(detail.pre_state.holdings) : []),
    [detail],
  );

  if (!item) return null;

  const summary = detail?.diff_summary ?? item.diff_summary;
  const spec = detail ? specSummary(detail.spec_used) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Rebalance — ${fmtDate(item.rebalance_date)}`}
      description="Portfolio state right before the rebalance, and what changed."
      size="2xl"
    >
      <div className="space-y-4">
        {/* Run meta */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-500">Rebalance date</div>
            <div className="text-sm font-medium text-gray-900">
              {fmtDate(item.rebalance_date)}
            </div>
            <div className="text-xs text-gray-500">
              executed {fmtDate(item.executed_at)} {fmtTime(item.executed_at)}
            </div>
          </div>
          <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-500">Executed by</div>
            <div
              className="text-sm font-medium text-gray-900 truncate"
              title={item.executed_by_email ?? undefined}
            >
              {item.executed_by_email ?? DASH}
            </div>
          </div>
          <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-500">Turnover</div>
            <div className="text-sm font-medium text-gray-900">
              {fmtPct(summary.turnover_pct, 1)}
            </div>
          </div>
        </div>

        {/* Applied changes */}
        <div className="flex flex-wrap gap-2 text-xs">
          {(
            [
              ['entry', summary.entries],
              ['increase', summary.increases],
              ['reduction', summary.reductions],
              ['exit', summary.exits],
              ['unchanged', summary.unchanged],
            ] as [RebalanceDiffAction, number][]
          ).map(([action, count]) => (
            <span
              key={action}
              className={`inline-block px-2 py-0.5 rounded font-medium ${ACTION_BADGE[action].cls}`}
            >
              {count} {count === 1 ? SINGULAR[action] : ACTION_BADGE[action].text}
            </span>
          ))}
        </div>

        {/* Selection spec, when it says anything useful */}
        {spec && (
          <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
            {spec}
          </div>
        )}

        {/* Skipped target names */}
        {summary.skipped.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-sm">
            <div className="font-medium mb-1">
              {summary.skipped.length}{' '}
              {summary.skipped.length === 1 ? 'stock was' : 'stocks were'} skipped
            </div>
            <ul className="text-xs text-amber-800 space-y-0.5">
              {summary.skipped.map((s) => (
                <li key={s.ticker}>
                  <strong>{s.ticker}</strong> — {SKIP_REASON[s.reason] ?? s.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {summary.warnings.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-sm">
            <div className="font-medium mb-1">Warnings</div>
            <ul className="text-xs text-amber-800 space-y-0.5">
              {summary.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Pre-state (fetched detail) */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin" />
            Loading the pre-rebalance snapshot…
          </div>
        ) : error ? (
          <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAttempt((n) => n + 1)}
            >
              <RefreshCw size={14} />
              Retry
            </Button>
          </div>
        ) : detail ? (
          <>
            {/* Totals before the rebalance */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Portfolio before the rebalance
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <div className="text-xs text-gray-500">Total value</div>
                  <div className="text-sm font-medium text-gray-900">
                    {fmtMoney(detail.pre_state.totals.total_value)}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <div className="text-xs text-gray-500">Cash</div>
                  <div className="text-sm font-medium text-gray-900">
                    {fmtMoney(detail.pre_state.totals.cash)}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <div className="text-xs text-gray-500">Invested</div>
                  <div className="text-sm font-medium text-gray-900">
                    {fmtMoney(detail.pre_state.totals.invested)}
                  </div>
                </div>
              </div>
            </div>

            {/* Previous holdings */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Holdings ({holdings.length})
              </div>
              {holdings.length === 0 ? (
                <p className="text-sm text-gray-500 m-0">
                  The portfolio held no positions before this rebalance.
                </p>
              ) : (
                <div className="max-h-64 overflow-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-left text-gray-500">
                        <th className="px-3 py-2 font-medium">Ticker</th>
                        <th className="px-3 py-2 font-medium">Sector</th>
                        <th className="px-3 py-2 font-medium text-right">Qty</th>
                        <th className="px-3 py-2 font-medium text-right">Price</th>
                        <th className="px-3 py-2 font-medium text-right">Value</th>
                        <th className="px-3 py-2 font-medium text-right">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((h) => (
                        <tr key={h.symbol_id} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {h.ticker}
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {h.sector ?? DASH}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                            {fmtNumber(h.qty, 2)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                            {h.price !== null ? fmtMoney(h.price) : DASH}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                            {h.value !== null ? fmtMoney(h.value) : DASH}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                            {h.weight_pct !== null
                              ? `${fmtNumber(h.weight_pct, 2)}%`
                              : DASH}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sector mix before the rebalance */}
            {detail.pre_state.sector_breakdown.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Sector breakdown
                </div>
                <div className="space-y-1.5">
                  {detail.pre_state.sector_breakdown.map((s) => (
                    <div key={s.sector} className="flex items-center gap-3 text-sm">
                      <span className="w-40 shrink-0 truncate text-gray-700" title={s.sector}>
                        {s.sector}
                      </span>
                      <span className="flex-1 h-1.5 rounded bg-gray-100 overflow-hidden">
                        <span
                          className="block h-full rounded bg-[#1e3a5f]"
                          style={{
                            width: `${Math.max(0, Math.min(100, s.weight_pct))}%`,
                          }}
                        />
                      </span>
                      <span className="w-24 text-right text-gray-500 whitespace-nowrap">
                        {fmtMoney(s.value, 0)}
                      </span>
                      <span className="w-14 text-right font-medium text-gray-900 whitespace-nowrap">
                        {fmtNumber(s.weight_pct, 1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}

        <div className="flex items-center justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
