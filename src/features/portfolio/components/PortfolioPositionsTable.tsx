import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import type {
  PortfolioPositionDetail,
  PositionSortField,
  SortOrder,
} from '@/services/portfolioService';

interface Column {
  key: string;
  label: string;
  align: 'left' | 'right' | 'center';
  width: string;
  sortBy?: PositionSortField;
  sortable: boolean;
}

const PINNED_COUNT = 2;

const COLUMNS: Column[] = [
  { key: 'ticker',           label: 'Ticker',   align: 'left',   width: '110px', sortBy: 'ticker',         sortable: true },
  { key: 'name',             label: 'Name',     align: 'left',   width: '220px',                           sortable: false },
  { key: 'sector',           label: 'Sector',   align: 'left',   width: '150px',                           sortable: false },
  { key: 'weight_pct',       label: 'Weight %', align: 'right',  width: '100px', sortBy: 'weight',         sortable: true },
  { key: 'quantity',         label: 'Quantity', align: 'right',  width: '120px',                           sortable: false },
  { key: 'average_cost',     label: 'Avg Cost', align: 'right',  width: '110px',                           sortable: false },
  { key: 'current_price',    label: 'Current',  align: 'right',  width: '110px',                           sortable: false },
  { key: 'current_value',    label: 'Value',    align: 'right',  width: '130px', sortBy: 'current_value',  sortable: true },
  { key: 'unrealized_pnl',   label: 'P&L ($)',  align: 'right',  width: '130px',                           sortable: false },
  { key: 'unrealized_pnl_pct', label: 'P&L %',  align: 'right',  width: '110px', sortBy: 'pnl_pct',        sortable: true },
  { key: 'rating',           label: 'Rating',   align: 'center', width: '140px',                           sortable: false },
  { key: 'entry_date',       label: 'Entry',    align: 'left',   width: '120px', sortBy: 'entry_date',     sortable: true },
];

const RATING_CONFIG: Record<number, { color: string }> = {
  3:    { color: 'var(--c-pos)' },
  2:    { color: 'var(--c-pos)' },
  1:    { color: 'var(--c-pos)' },
  [-1]: { color: 'var(--c-neg)' },
  [-2]: { color: 'var(--c-neg)' },
  [-3]: { color: 'var(--c-neg)' },
};

function formatRatingLabel(rating: number): string {
  return rating > 0 ? `+${rating}` : `${rating}`;
}

interface PortfolioPositionsTableProps {
  positions: PortfolioPositionDetail[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  sortBy: PositionSortField;
  sortOrder: SortOrder;
  onSortChange: (sortBy: PositionSortField, sortOrder: SortOrder) => void;
}

function fmtNumber(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function parseWidth(w: string): number {
  const n = parseInt(w, 10);
  return Number.isNaN(n) ? 120 : n;
}

export function PortfolioPositionsTable({
  positions,
  isLoading,
  error,
  onRetry,
  sortBy,
  sortOrder,
  onSortChange,
}: PortfolioPositionsTableProps) {
  if (error) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <AlertCircle
          size={36}
          color="var(--c-neg)"
          style={{ margin: '0 auto 12px' }}
        />
        <h3
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--c-text)',
            margin: '0 0 6px',
          }}
        >
          Could not load positions
        </h3>
        <p style={{ color: 'var(--c-text-dim)', margin: '0 0 16px', fontSize: 13 }}>
          {error}
        </p>
        <button type="button" className="topbar-btn primary" onClick={onRetry}>
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  if (!isLoading && positions.length === 0) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--c-text)',
            margin: '0 0 6px',
          }}
        >
          No positions yet
        </h3>
        <p style={{ color: 'var(--c-text-dim)', margin: 0, fontSize: 13 }}>
          This portfolio has no stocks. Add positions from the Screener.
        </p>
      </div>
    );
  }

  // Compute pinned left offsets
  const pinnedOffsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < Math.min(PINNED_COUNT, COLUMNS.length); i++) {
    pinnedOffsets.push(acc);
    acc += parseWidth(COLUMNS[i].width);
  }

  function handleSort(col: Column) {
    if (!col.sortable || !col.sortBy) return;
    if (sortBy === col.sortBy) {
      onSortChange(col.sortBy, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(col.sortBy, 'desc');
    }
  }

  return (
    <div className="card">
      <div style={{ overflow: 'auto' }}>
        <table className="tbl" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {COLUMNS.map((col, idx) => {
                const pinned = idx < PINNED_COUNT;
                const isLastPinned = pinned && idx === PINNED_COUNT - 1;
                const isSorted = col.sortBy === sortBy;
                return (
                  <th
                    key={col.key}
                    className={`${col.sortable ? 'sortable' : ''} ${isSorted ? 'sorted' : ''}`}
                    style={{
                      width: col.width,
                      minWidth: col.width,
                      textAlign:
                        col.align === 'right'
                          ? 'right'
                          : col.align === 'center'
                          ? 'center'
                          : 'left',
                      position: pinned ? 'sticky' : undefined,
                      left: pinned ? pinnedOffsets[idx] : undefined,
                      top: 0,
                      zIndex: pinned ? 12 : 10,
                      borderRight: isLastPinned
                        ? '1px solid var(--c-border)'
                        : undefined,
                      boxShadow: isLastPinned
                        ? '2px 0 4px -2px rgba(16,24,40,0.06)'
                        : undefined,
                    }}
                    onClick={() => handleSort(col)}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {col.label}
                      {col.sortable && (
                        <span className="sort-icon">
                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp size={12} />
                            ) : (
                              <ArrowDown size={12} />
                            )
                          ) : (
                            <ArrowUpDown size={12} />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <PositionSkeletonRow key={i} pinnedOffsets={pinnedOffsets} />
                ))
              : positions.map((pos) => (
                  <PositionRow
                    key={pos.position_id}
                    pos={pos}
                    pinnedOffsets={pinnedOffsets}
                  />
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PositionRow({
  pos,
  pinnedOffsets,
}: {
  pos: PortfolioPositionDetail;
  pinnedOffsets: number[];
}) {
  const pnl = pos.unrealized_pnl;
  const pnlPct = pos.unrealized_pnl_pct;
  const pnlClass =
    pnl === null || pnl === undefined
      ? 'dim'
      : pnl > 0
      ? 'pos'
      : pnl < 0
      ? 'neg'
      : 'zero';

  const cellStyle = (idx: number): React.CSSProperties => {
    const pinned = idx < PINNED_COUNT;
    const isLastPinned = pinned && idx === PINNED_COUNT - 1;
    return {
      width: COLUMNS[idx].width,
      minWidth: COLUMNS[idx].width,
      position: pinned ? 'sticky' : undefined,
      left: pinned ? pinnedOffsets[idx] : undefined,
      background: 'var(--c-bg)',
      zIndex: pinned ? 5 : undefined,
      borderRight: isLastPinned ? '1px solid var(--c-border)' : undefined,
      boxShadow: isLastPinned ? '2px 0 4px -2px rgba(16,24,40,0.06)' : undefined,
      textAlign:
        COLUMNS[idx].align === 'right'
          ? 'right'
          : COLUMNS[idx].align === 'center'
          ? 'center'
          : 'left',
    };
  };

  return (
    <tr>
      <td
        className="name-cell"
        style={{ ...cellStyle(0), fontWeight: 600, color: 'var(--c-text)' }}
      >
        {pos.ticker}
      </td>
      <td className="name-cell" style={cellStyle(1)}>
        <span title={pos.name} style={{ color: 'var(--c-text)' }}>
          {pos.name}
        </span>
      </td>
      <td className="name-cell dim" style={cellStyle(2)}>
        {pos.sector ?? '—'}
      </td>
      <td style={cellStyle(3)}>
        {pos.weight_pct !== null ? `${fmtNumber(pos.weight_pct, 2)}%` : '—'}
      </td>
      <td style={cellStyle(4)}>{fmtNumber(pos.quantity, 4)}</td>
      <td style={cellStyle(5)}>${fmtNumber(pos.average_cost, 2)}</td>
      <td style={cellStyle(6)}>
        {pos.current_price !== null ? `$${fmtNumber(pos.current_price, 2)}` : '—'}
      </td>
      <td style={{ ...cellStyle(7), fontWeight: 500 }}>
        {pos.current_value !== null ? `$${fmtNumber(pos.current_value, 2)}` : '—'}
      </td>
      <td className={pnlClass} style={{ ...cellStyle(8), fontWeight: 600 }}>
        {pnl !== null && pnl !== undefined ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              justifyContent: 'flex-end',
            }}
          >
            {pnl > 0 ? (
              <TrendingUp size={11} />
            ) : pnl < 0 ? (
              <TrendingDown size={11} />
            ) : (
              <Minus size={11} />
            )}
            {pnl > 0 ? '+' : ''}${fmtNumber(Math.abs(pnl), 2)}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className={pnlClass} style={{ ...cellStyle(9), fontWeight: 600 }}>
        {pnlPct !== null && pnlPct !== undefined
          ? `${pnlPct > 0 ? '+' : ''}${fmtNumber(pnlPct, 2)}%`
          : '—'}
      </td>
      <td style={cellStyle(10)}>
        <RatingCell
          entry={pos.entry_rating}
          current={pos.current_rating}
          changed={pos.rating_changed}
        />
      </td>
      <td className="dim" style={cellStyle(11)}>
        {fmtDate(pos.entry_date)}
      </td>
    </tr>
  );
}

function RatingBadge({ rating }: { rating: number | null | undefined }) {
  if (rating === null || rating === undefined) {
    return <span style={{ color: 'var(--c-text-dim)', fontSize: 11 }}>—</span>;
  }
  const cfg = RATING_CONFIG[rating];
  if (!cfg)
    return <span style={{ color: 'var(--c-text-dim)', fontSize: 11 }}>—</span>;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 28,
        height: 22,
        padding: '0 6px',
        borderRadius: 11,
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        background: cfg.color,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {formatRatingLabel(rating)}
    </span>
  );
}

function RatingCell({
  entry,
  current,
  changed,
}: {
  entry: number | null;
  current: number | null;
  changed: boolean;
}) {
  if (entry === null && current === null) {
    return <span style={{ color: 'var(--c-text-dim)', fontSize: 11 }}>—</span>;
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        justifyContent: 'center',
      }}
    >
      <RatingBadge rating={entry} />
      <span style={{ color: 'var(--c-text-dim)', fontSize: 11 }}>→</span>
      <RatingBadge rating={current} />
      {changed && (
        <span
          style={{
            marginLeft: 4,
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--c-warn)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          changed
        </span>
      )}
    </span>
  );
}

function PositionSkeletonRow({ pinnedOffsets }: { pinnedOffsets: number[] }) {
  return (
    <tr>
      {COLUMNS.map((col, idx) => {
        const pinned = idx < PINNED_COUNT;
        const isLastPinned = pinned && idx === PINNED_COUNT - 1;
        return (
          <td
            key={col.key}
            style={{
              width: col.width,
              minWidth: col.width,
              position: pinned ? 'sticky' : undefined,
              left: pinned ? pinnedOffsets[idx] : undefined,
              background: 'var(--c-bg)',
              zIndex: pinned ? 5 : undefined,
              borderRight: isLastPinned
                ? '1px solid var(--c-border)'
                : undefined,
            }}
          >
            <div
              style={{
                height: 16,
                width: '100%',
                background: 'var(--c-bg-softer)',
                borderRadius: 4,
                animation: 'pulse 1.6s ease-in-out infinite',
              }}
            />
          </td>
        );
      })}
    </tr>
  );
}
