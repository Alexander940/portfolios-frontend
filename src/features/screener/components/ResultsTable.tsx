import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useScreenerStore } from '../stores';
import {
  formatCellValue,
  formatRatingValue,
  getColumnPreset,
  getRatingConfig,
  isValidRating,
} from '../constants';
import type { Stock, TableColumn } from '../types';

interface ResultsTableProps {
  data: Stock[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

const PINNED_COLUMNS_COUNT = 2;

export function ResultsTable({
  data,
  isLoading,
  error,
  onRetry,
}: ResultsTableProps) {
  const sortBy = useScreenerStore((state) => state.sortBy);
  const sortOrder = useScreenerStore((state) => state.sortOrder);
  const toggleSort = useScreenerStore((state) => state.toggleSort);
  const columnPreset = useScreenerStore((state) => state.columnPreset);

  const preset = getColumnPreset(columnPreset);
  const columns = preset.columns;

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
          Error loading data
        </h3>
        <p style={{ color: 'var(--c-text-dim)', margin: '0 0 16px', fontSize: 13 }}>
          {error}
        </p>
        <button type="button" className="topbar-btn primary" onClick={onRetry}>
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    );
  }

  if (!isLoading && data.length === 0) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            background: 'var(--c-bg-soft)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
          }}
        >
          <ArrowUpDown size={24} color="var(--c-text-dim)" />
        </div>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--c-text)',
            margin: '0 0 6px',
          }}
        >
          No results found
        </h3>
        <p style={{ color: 'var(--c-text-dim)', margin: 0, fontSize: 13 }}>
          Try adjusting your filters to find more stocks.
        </p>
      </div>
    );
  }

  // Cumulative left offsets for sticky pinned columns
  const pinnedOffsets: number[] = [];
  let accumulated = 0;
  for (let i = 0; i < Math.min(PINNED_COLUMNS_COUNT, columns.length); i++) {
    pinnedOffsets.push(accumulated);
    accumulated += parseWidth(columns[i].width);
  }

  return (
    <div className="card">
      <div style={{ overflow: 'auto' }}>
        <table
          className="tbl"
          style={{ borderCollapse: 'separate', borderSpacing: 0 }}
        >
          <thead>
            <tr>
              {columns.map((column, idx) => {
                const pinned = idx < PINNED_COLUMNS_COUNT;
                return (
                  <TableHeader
                    key={column.key}
                    column={column}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={toggleSort}
                    pinned={pinned}
                    pinnedLeft={pinned ? pinnedOffsets[idx] : undefined}
                    isLastPinned={pinned && idx === PINNED_COLUMNS_COUNT - 1}
                  />
                );
              })}
            </tr>
          </thead>

          <tbody>
            {isLoading
              ? Array.from({ length: 10 }).map((_, idx) => (
                  <TableRowSkeleton
                    key={idx}
                    columns={columns}
                    pinnedOffsets={pinnedOffsets}
                  />
                ))
              : data.map((stock) => (
                  <TableRow
                    key={stock.symbol_id}
                    stock={stock}
                    columns={columns}
                    pinnedOffsets={pinnedOffsets}
                  />
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseWidth(width: string | undefined): number {
  if (!width) return 120;
  const n = parseInt(width, 10);
  return Number.isNaN(n) ? 120 : n;
}

// =============================================================================
// Header
// =============================================================================

interface TableHeaderProps {
  column: TableColumn;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  pinned: boolean;
  pinnedLeft?: number;
  isLastPinned: boolean;
}

function TableHeader({
  column,
  sortBy,
  sortOrder,
  onSort,
  pinned,
  pinnedLeft,
  isLastPinned,
}: TableHeaderProps) {
  const isSorted = sortBy === column.key;

  return (
    <th
      className={`${column.sortable ? 'sortable' : ''} ${isSorted ? 'sorted' : ''}`}
      style={{
        width: column.width,
        minWidth: column.width,
        textAlign:
          column.align === 'right'
            ? 'right'
            : column.align === 'center'
            ? 'center'
            : 'left',
        position: pinned ? 'sticky' : undefined,
        left: pinned ? pinnedLeft : undefined,
        top: 0,
        zIndex: pinned ? 12 : 10,
        borderRight: isLastPinned ? '1px solid var(--c-border)' : undefined,
        boxShadow: isLastPinned
          ? '2px 0 4px -2px rgba(16,24,40,0.06)'
          : undefined,
      }}
      onClick={() => column.sortable && onSort(column.key)}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {column.label}
        {column.sortable && (
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
}

// =============================================================================
// Row
// =============================================================================

interface TableRowProps {
  stock: Stock;
  columns: TableColumn[];
  pinnedOffsets: number[];
}

function TableRow({ stock, columns, pinnedOffsets }: TableRowProps) {
  return (
    <tr className="clickable">
      {columns.map((column, idx) => {
        const pinned = idx < PINNED_COLUMNS_COUNT;
        return (
          <TableCell
            key={column.key}
            stock={stock}
            column={column}
            pinned={pinned}
            pinnedLeft={pinned ? pinnedOffsets[idx] : undefined}
            isLastPinned={pinned && idx === PINNED_COLUMNS_COUNT - 1}
          />
        );
      })}
    </tr>
  );
}

// =============================================================================
// Cell
// =============================================================================

interface TableCellProps {
  stock: Stock;
  column: TableColumn;
  pinned: boolean;
  pinnedLeft?: number;
  isLastPinned: boolean;
}

function TableCell({
  stock,
  column,
  pinned,
  pinnedLeft,
  isLastPinned,
}: TableCellProps) {
  const style: React.CSSProperties = {
    width: column.width,
    minWidth: column.width,
    position: pinned ? 'sticky' : undefined,
    left: pinned ? pinnedLeft : undefined,
    background: 'var(--c-bg)',
    zIndex: pinned ? 5 : undefined,
    borderRight: isLastPinned ? '1px solid var(--c-border)' : undefined,
    boxShadow: isLastPinned
      ? '2px 0 4px -2px rgba(16,24,40,0.06)'
      : undefined,
    textAlign:
      column.align === 'right'
        ? 'right'
        : column.align === 'center'
        ? 'center'
        : 'left',
  };

  // Rating (numeric badge)
  if (column.key === 'rating') {
    const raw = stock.rating;
    const valid = typeof raw === 'number' && isValidRating(raw);
    const config = valid ? getRatingConfig(raw) : null;
    return (
      <td style={style}>
        {valid && config ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 32,
              height: 22,
              padding: '0 6px',
              borderRadius: 11,
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              backgroundColor: config.color,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatRatingValue(raw)}
          </span>
        ) : (
          <span style={{ color: 'var(--c-text-dim)' }}>—</span>
        )}
      </td>
    );
  }

  // New High / Low badge
  if (column.key === 'new_high_low') {
    const val = stock.new_high_low;
    return (
      <td style={style}>
        {val === 'high' ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '1px 8px',
              borderRadius: 100,
              background: 'color-mix(in oklch, var(--c-pos) 14%, transparent)',
              color: 'var(--c-pos)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <TrendingUp size={11} /> High
          </span>
        ) : val === 'low' ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '1px 8px',
              borderRadius: 100,
              background: 'color-mix(in oklch, var(--c-neg) 14%, transparent)',
              color: 'var(--c-neg)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <TrendingDown size={11} /> Low
          </span>
        ) : (
          <span style={{ color: 'var(--c-text-dim)' }}>—</span>
        )}
      </td>
    );
  }

  // Return / growth columns: colored by sign
  if (
    column.key.startsWith('return_') ||
    column.key.startsWith('revenue_growth') ||
    column.key.startsWith('earnings_growth')
  ) {
    const numValue = stock[column.key] as number | null;
    const colorClass =
      numValue === null || numValue === undefined
        ? 'dim'
        : numValue >= 0
        ? 'pos'
        : 'neg';
    return (
      <td className={colorClass} style={{ ...style, fontWeight: 500 }}>
        {formatCellValue(stock, column)}
      </td>
    );
  }

  // Ticker: bold
  if (column.key === 'ticker') {
    return (
      <td
        className="name-cell"
        style={{ ...style, fontWeight: 600, color: 'var(--c-text)' }}
      >
        {formatCellValue(stock, column)}
      </td>
    );
  }

  // Name: truncate
  if (column.key === 'name') {
    const value = formatCellValue(stock, column);
    return (
      <td className="name-cell" style={style}>
        <span title={String(value)} style={{ color: 'var(--c-text-soft)' }}>
          {value}
        </span>
      </td>
    );
  }

  // Default cell
  return <td style={style}>{formatCellValue(stock, column)}</td>;
}

// =============================================================================
// Skeleton Row
// =============================================================================

interface TableRowSkeletonProps {
  columns: TableColumn[];
  pinnedOffsets: number[];
}

function TableRowSkeleton({
  columns,
  pinnedOffsets,
}: TableRowSkeletonProps) {
  return (
    <tr>
      {columns.map((column, idx) => {
        const pinned = idx < PINNED_COLUMNS_COUNT;
        const isLastPinned = pinned && idx === PINNED_COLUMNS_COUNT - 1;
        return (
          <td
            key={column.key}
            style={{
              width: column.width,
              minWidth: column.width,
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
                width:
                  column.key === 'ticker'
                    ? 56
                    : column.key === 'name'
                    ? 128
                    : column.key === 'rating'
                    ? 24
                    : 64,
                background: 'var(--c-bg-softer)',
                borderRadius: 4,
                animation: 'pulse 1.6s ease-in-out infinite',
                marginLeft:
                  column.align === 'right'
                    ? 'auto'
                    : column.align === 'center'
                    ? 'auto'
                    : undefined,
                marginRight: column.align === 'center' ? 'auto' : undefined,
              }}
            />
          </td>
        );
      })}
    </tr>
  );
}
