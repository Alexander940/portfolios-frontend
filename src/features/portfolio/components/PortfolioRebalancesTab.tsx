import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Shield,
} from 'lucide-react';
import {
  listRebalanceHistory,
  type RebalanceDiffSummary,
  type RebalanceHistoryItem,
} from '@/services/portfolioService';
import { getErrorMessage } from '@/lib/apiErrors';
import { fmtDate, fmtNumber } from '../lib/format';
import { RebalanceDetailModal } from './RebalanceDetailModal';

interface PortfolioRebalancesTabProps {
  portfolioId: string;
}

const PAGE_SIZE = 25;
const DASH = '—';

/**
 * Compact per-row description of the diff: "2 entries · 1 exit · 3 adjusted".
 * "Adjusted" folds increases + reductions together; zero-count parts are
 * omitted, and an all-unchanged run reads "no changes".
 */
function diffLabelParts(
  s: RebalanceDiffSummary,
): { text: string; className: string }[] {
  const adjusted = s.increases + s.reductions;
  const parts: { text: string; className: string }[] = [];
  if (s.entries > 0) {
    parts.push({
      text: `${s.entries} ${s.entries === 1 ? 'entry' : 'entries'}`,
      className: 'pos',
    });
  }
  if (s.exits > 0) {
    parts.push({
      text: `${s.exits} ${s.exits === 1 ? 'exit' : 'exits'}`,
      className: 'neg',
    });
  }
  if (adjusted > 0) {
    parts.push({ text: `${adjusted} adjusted`, className: '' });
  }
  if (parts.length === 0) {
    parts.push({ text: 'no changes', className: 'dim' });
  }
  return parts;
}

/**
 * PortfolioRebalancesTab (US7 #115)
 *
 * "Rebalance history" tab of the portfolio detail page: paginated list of the
 * applied rebalances (date, who, compact diff summary, turnover) from
 * GET /portfolios/{id}/rebalances. Clicking a row opens the read-only detail
 * modal (pre-rebalance snapshot + full diff). Visible to every role with
 * access to the portfolio — viewers included.
 */
export function PortfolioRebalancesTab({
  portfolioId,
}: PortfolioRebalancesTabProps) {
  const [items, setItems] = useState<RebalanceHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<RebalanceHistoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    // Reset loading/error synchronously when the fetch key changes — same
    // request-lifecycle pattern as the other self-fetching portfolio blocks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);

    listRebalanceHistory(
      portfolioId,
      { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
      controller.signal,
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [portfolioId, page, attempt]);

  function openDetail(item: RebalanceHistoryItem) {
    setSelected(item);
    setDetailOpen(true);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  let body;
  if (isLoading) {
    body = (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 0',
        }}
      >
        <Loader2
          size={22}
          color="var(--c-text-dim)"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>
    );
  } else if (error) {
    body = (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <AlertCircle
          size={30}
          color="var(--c-neg)"
          style={{ margin: '0 auto 10px' }}
        />
        <p style={{ color: 'var(--c-text-soft)', margin: '0 0 14px', fontSize: 13 }}>
          {error}
        </p>
        <button
          type="button"
          className="topbar-btn primary"
          onClick={() => setAttempt((n) => n + 1)}
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  } else if (total === 0) {
    // Discreet empty state — a rebalance-less portfolio is the normal case.
    body = (
      <p style={{ color: 'var(--c-text-soft)', margin: 0, fontSize: 13 }}>
        This portfolio has not been rebalanced yet. Every applied rebalance
        will show up here with its before/after summary.
      </p>
    );
  } else {
    body = (
      <div className="card">
        <div style={{ overflow: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Date</th>
                <th>Executed by</th>
                <th>Changes</th>
                <th className="num" style={{ width: 110 }}>
                  Turnover
                </th>
                <th style={{ width: 40 }} aria-label="Open detail" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const parts = diffLabelParts(item.diff_summary);
                return (
                  <tr
                    key={item.rebalance_id}
                    className="clickable"
                    onClick={() => openDetail(item)}
                  >
                    <td style={{ fontWeight: 500 }}>
                      {fmtDate(item.rebalance_date)}
                    </td>
                    <td className="name-cell dim">
                      {item.executed_by_email ?? DASH}
                    </td>
                    <td className="name-cell">
                      {parts.map((p, i) => (
                        <span key={p.text}>
                          {i > 0 && (
                            <span style={{ color: 'var(--c-text-dim)' }}>
                              {' · '}
                            </span>
                          )}
                          <span className={p.className || undefined}>
                            {p.text}
                          </span>
                        </span>
                      ))}
                      {item.diff_summary.skipped.length > 0 && (
                        <span
                          style={{ color: 'var(--c-warn)', marginLeft: 6 }}
                          title={item.diff_summary.skipped
                            .map((s) => `${s.ticker} (${s.reason})`)
                            .join(', ')}
                        >
                          · {item.diff_summary.skipped.length} skipped
                        </span>
                      )}
                      {item.diff_summary.prioritize_held && (
                        <span
                          data-testid="rebalance-priority-chip"
                          style={{
                            color: 'var(--c-pos, #16a34a)',
                            marginLeft: 6,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                          title="Rebalanced with priority for current holdings"
                        >
                          · <Shield size={11} style={{ flexShrink: 0 }} />
                          {item.diff_summary.held_kept ?? 0} kept
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {fmtNumber(item.diff_summary.turnover_pct, 1)}%
                    </td>
                    <td className="num" style={{ color: 'var(--c-text-dim)' }}>
                      <ChevronRight size={14} style={{ verticalAlign: 'middle' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {total > PAGE_SIZE && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 16px',
              borderTop: '1px solid var(--c-border)',
              fontSize: 12,
              color: 'var(--c-text-soft)',
            }}
          >
            <span>
              Showing{' '}
              <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>
                {(safePage - 1) * PAGE_SIZE + 1}
              </span>
              {' – '}
              <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>
                {Math.min(safePage * PAGE_SIZE, total)}
              </span>{' '}
              of{' '}
              <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>
                {total.toLocaleString()}
              </span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <PagerButton
                onClick={() => setPage(safePage - 1)}
                disabled={safePage <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </PagerButton>
              <span
                style={{ padding: '0 8px', fontVariantNumeric: 'tabular-nums' }}
              >
                Page{' '}
                <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>
                  {safePage}
                </span>{' '}
                of {totalPages}
              </span>
              <PagerButton
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </PagerButton>
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="detail-sect">
      <div className="detail-sect-head">
        <div className="detail-sect-title">Rebalance History</div>
      </div>

      {body}

      <RebalanceDetailModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        portfolioId={portfolioId}
        item={selected}
      />
    </div>
  );
}

function PagerButton({
  onClick,
  disabled,
  children,
  'aria-label': ariaLabel,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  'aria-label': string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
        border: '1px solid var(--c-border)',
        borderRadius: 4,
        background: 'var(--c-bg)',
        color: disabled ? 'var(--c-text-dim)' : 'var(--c-text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
