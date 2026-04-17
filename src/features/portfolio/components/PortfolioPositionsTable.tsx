import { ArrowUp, ArrowDown, ArrowUpDown, AlertCircle, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
  { key: 'ticker', label: 'Ticker', align: 'left', width: '110px', sortBy: 'ticker', sortable: true },
  { key: 'name', label: 'Name', align: 'left', width: '220px', sortable: false },
  { key: 'sector', label: 'Sector', align: 'left', width: '150px', sortable: false },
  { key: 'weight_pct', label: 'Weight %', align: 'right', width: '100px', sortBy: 'weight', sortable: true },
  { key: 'quantity', label: 'Quantity', align: 'right', width: '120px', sortable: false },
  { key: 'average_cost', label: 'Avg Cost', align: 'right', width: '110px', sortable: false },
  { key: 'current_price', label: 'Current', align: 'right', width: '110px', sortable: false },
  { key: 'current_value', label: 'Value', align: 'right', width: '130px', sortBy: 'current_value', sortable: true },
  { key: 'unrealized_pnl', label: 'P&L ($)', align: 'right', width: '130px', sortable: false },
  { key: 'unrealized_pnl_pct', label: 'P&L %', align: 'right', width: '110px', sortBy: 'pnl_pct', sortable: true },
  { key: 'rating', label: 'Rating', align: 'center', width: '140px', sortable: false },
  { key: 'entry_date', label: 'Entry', align: 'left', width: '120px', sortBy: 'entry_date', sortable: true },
];

const RATING_CONFIG: Record<number, { letter: string; color: string }> = {
  3: { letter: 'A', color: '#10b981' },
  2: { letter: 'B', color: '#22c55e' },
  1: { letter: 'C', color: '#f59e0b' },
  [-1]: { letter: 'D', color: '#ef4444' },
};

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
  return isNaN(n) ? 120 : n;
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
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Could not load positions</h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2d5a8a] transition-colors"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }

  if (!isLoading && positions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No positions yet</h3>
        <p className="text-gray-500">
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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr>
              {COLUMNS.map((col, idx) => {
                const pinned = idx < PINNED_COUNT;
                const isLastPinned = pinned && idx === PINNED_COUNT - 1;
                const isSorted = col.sortBy === sortBy;
                return (
                  <th
                    key={col.key}
                    className={`
                      px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider
                      bg-gray-50 border-b border-gray-200
                      ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                      ${col.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''}
                      ${pinned ? 'sticky z-10' : ''}
                      ${isLastPinned ? 'border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]' : ''}
                    `}
                    style={{
                      width: col.width,
                      minWidth: col.width,
                      left: pinned ? pinnedOffsets[idx] : undefined,
                    }}
                    onClick={() => handleSort(col)}
                  >
                    <div
                      className={`flex items-center gap-1 ${
                        col.align === 'right'
                          ? 'justify-end'
                          : col.align === 'center'
                          ? 'justify-center'
                          : ''
                      }`}
                    >
                      <span>{col.label}</span>
                      {col.sortable && (
                        <span className="text-gray-400">
                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp size={14} className="text-[#1e3a5f]" />
                            ) : (
                              <ArrowDown size={14} className="text-[#1e3a5f]" />
                            )
                          ) : (
                            <ArrowUpDown size={14} />
                          )}
                        </span>
                      )}
                    </div>
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
              : positions.map((pos, idx) => (
                  <PositionRow
                    key={pos.position_id}
                    pos={pos}
                    pinnedOffsets={pinnedOffsets}
                    zebra={idx % 2 === 1}
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
  zebra,
}: {
  pos: PortfolioPositionDetail;
  pinnedOffsets: number[];
  zebra: boolean;
}) {
  const rowBg = zebra ? 'bg-gray-50/40' : 'bg-white';
  const pnl = pos.unrealized_pnl;
  const pnlPct = pos.unrealized_pnl_pct;
  const pnlColor =
    pnl === null || pnl === undefined
      ? 'text-gray-400'
      : pnl > 0
      ? 'text-green-600'
      : pnl < 0
      ? 'text-red-600'
      : 'text-gray-700';

  const makeCellClasses = (idx: number, align: 'left' | 'right' | 'center', extra = '') => {
    const pinned = idx < PINNED_COUNT;
    const isLastPinned = pinned && idx === PINNED_COUNT - 1;
    return `
      px-4 py-3 text-sm border-b border-gray-100
      ${rowBg}
      group-hover:bg-[#f0f4fa]
      ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}
      ${pinned ? 'sticky z-[5]' : ''}
      ${isLastPinned ? 'border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]' : ''}
      ${extra}
    `;
  };

  const makeStyle = (idx: number): React.CSSProperties => {
    const pinned = idx < PINNED_COUNT;
    return {
      width: COLUMNS[idx].width,
      minWidth: COLUMNS[idx].width,
      left: pinned ? pinnedOffsets[idx] : undefined,
    };
  };

  return (
    <tr className="group">
      <td className={makeCellClasses(0, 'left', 'font-semibold text-gray-900')} style={makeStyle(0)}>
        {pos.ticker}
      </td>
      <td className={makeCellClasses(1, 'left', 'text-gray-700')} style={makeStyle(1)}>
        <span className="truncate block" title={pos.name}>
          {pos.name}
        </span>
      </td>
      <td className={makeCellClasses(2, 'left', 'text-gray-700')} style={makeStyle(2)}>
        {pos.sector ?? '—'}
      </td>
      <td className={makeCellClasses(3, 'right', 'text-gray-700 font-medium')} style={makeStyle(3)}>
        {pos.weight_pct !== null ? `${fmtNumber(pos.weight_pct, 2)}%` : '—'}
      </td>
      <td className={makeCellClasses(4, 'right', 'text-gray-700')} style={makeStyle(4)}>
        {fmtNumber(pos.quantity, 4)}
      </td>
      <td className={makeCellClasses(5, 'right', 'text-gray-700')} style={makeStyle(5)}>
        ${fmtNumber(pos.average_cost, 2)}
      </td>
      <td className={makeCellClasses(6, 'right', 'text-gray-700')} style={makeStyle(6)}>
        {pos.current_price !== null ? `$${fmtNumber(pos.current_price, 2)}` : '—'}
      </td>
      <td className={makeCellClasses(7, 'right', 'text-gray-700 font-medium')} style={makeStyle(7)}>
        {pos.current_value !== null ? `$${fmtNumber(pos.current_value, 2)}` : '—'}
      </td>
      <td className={makeCellClasses(8, 'right', `font-semibold ${pnlColor}`)} style={makeStyle(8)}>
        {pnl !== null && pnl !== undefined ? (
          <span className="inline-flex items-center gap-1 justify-end w-full">
            {pnl > 0 ? <TrendingUp size={12} /> : pnl < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
            {pnl > 0 ? '+' : ''}${fmtNumber(Math.abs(pnl), 2)}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className={makeCellClasses(9, 'right', `font-semibold ${pnlColor}`)} style={makeStyle(9)}>
        {pnlPct !== null && pnlPct !== undefined
          ? `${pnlPct > 0 ? '+' : ''}${fmtNumber(pnlPct, 2)}%`
          : '—'}
      </td>
      <td className={makeCellClasses(10, 'center')} style={makeStyle(10)}>
        <RatingCell entry={pos.entry_rating} current={pos.current_rating} changed={pos.rating_changed} />
      </td>
      <td className={makeCellClasses(11, 'left', 'text-gray-600')} style={makeStyle(11)}>
        {fmtDate(pos.entry_date)}
      </td>
    </tr>
  );
}

function RatingBadge({ rating }: { rating: number | null | undefined }) {
  if (rating === null || rating === undefined) {
    return <span className="text-gray-300 text-xs">—</span>;
  }
  const cfg = RATING_CONFIG[rating];
  if (!cfg) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold"
      style={{ backgroundColor: cfg.color }}
    >
      {cfg.letter}
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
    return <span className="text-gray-300 text-xs">—</span>;
  }
  return (
    <div className="inline-flex items-center gap-1">
      <RatingBadge rating={entry} />
      <span className="text-gray-300 text-xs">→</span>
      <RatingBadge rating={current} />
      {changed && (
        <span className="ml-1 text-[10px] font-semibold text-amber-600 uppercase">
          changed
        </span>
      )}
    </div>
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
            className={`
              px-4 py-3 bg-white border-b border-gray-100
              ${pinned ? 'sticky z-[5]' : ''}
              ${isLastPinned ? 'border-r border-gray-200' : ''}
            `}
            style={{
              width: col.width,
              minWidth: col.width,
              left: pinned ? pinnedOffsets[idx] : undefined,
            }}
          >
            <div className="h-5 w-full bg-gray-200 rounded animate-pulse" />
          </td>
        );
      })}
    </tr>
  );
}
