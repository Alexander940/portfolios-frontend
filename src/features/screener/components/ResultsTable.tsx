import { ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useScreenerStore } from '../stores';
import { formatCellValue, getColumnPreset, getRatingLetter, RATING_CONFIGS } from '../constants';
import type { Stock, TableColumn } from '../types';

interface ResultsTableProps {
  data: Stock[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * How many columns are pinned to the left.
 * First N columns of every preset are treated as pinned (sticky).
 */
const PINNED_COLUMNS_COUNT = 2;

/**
 * ResultsTable Component
 *
 * Displays filtered stock results with:
 * - Column visibility presets (Overview / TrendRating / Performance / Fundamentals / All)
 * - Ticker + Name pinned to the left (stay visible during horizontal scroll)
 * - Sortable columns
 * - Sticky header on vertical scroll
 * - Loading skeleton, empty and error states
 */
export function ResultsTable({ data, isLoading, error, onRetry }: ResultsTableProps) {
  const sortBy = useScreenerStore((state) => state.sortBy);
  const sortOrder = useScreenerStore((state) => state.sortOrder);
  const toggleSort = useScreenerStore((state) => state.toggleSort);
  const columnPreset = useScreenerStore((state) => state.columnPreset);

  const preset = getColumnPreset(columnPreset);
  const columns = preset.columns;

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading data</h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2d5a8a] transition-colors"
        >
          <RefreshCw size={16} />
          Try again
        </button>
      </div>
    );
  }

  // Empty state
  if (!isLoading && data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ArrowUpDown className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
        <p className="text-gray-500">
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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          {/* Header */}
          <thead className="sticky top-0 z-20">
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

          {/* Body */}
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, idx) => (
                <TableRowSkeleton key={idx} columns={columns} pinnedOffsets={pinnedOffsets} />
              ))
            ) : (
              data.map((stock, rowIdx) => (
                <TableRow
                  key={stock.symbol_id}
                  stock={stock}
                  columns={columns}
                  pinnedOffsets={pinnedOffsets}
                  zebra={rowIdx % 2 === 1}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseWidth(width: string | undefined): number {
  if (!width) return 120;
  const n = parseInt(width, 10);
  return isNaN(n) ? 120 : n;
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

function TableHeader({ column, sortBy, sortOrder, onSort, pinned, pinnedLeft, isLastPinned }: TableHeaderProps) {
  const isSorted = sortBy === column.key;

  return (
    <th
      className={`
        px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider
        bg-gray-50 border-b border-gray-200
        ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}
        ${column.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''}
        ${pinned ? 'sticky z-10' : ''}
        ${isLastPinned ? 'border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]' : ''}
      `}
      style={{
        width: column.width,
        minWidth: column.width,
        left: pinned ? pinnedLeft : undefined,
      }}
      onClick={() => column.sortable && onSort(column.key)}
    >
      <div className={`flex items-center gap-1 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : ''}`}>
        <span>{column.label}</span>
        {column.sortable && (
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
}

// =============================================================================
// Row
// =============================================================================

interface TableRowProps {
  stock: Stock;
  columns: TableColumn[];
  pinnedOffsets: number[];
  zebra: boolean;
}

function TableRow({ stock, columns, pinnedOffsets, zebra }: TableRowProps) {
  const rowBg = zebra ? 'bg-gray-50/40' : 'bg-white';
  return (
    <tr className="group">
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
            rowBg={rowBg}
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
  rowBg: string;
}

function TableCell({ stock, column, pinned, pinnedLeft, isLastPinned, rowBg }: TableCellProps) {
  const baseClasses = `
    px-4 py-3 text-sm border-b border-gray-100
    ${rowBg}
    group-hover:bg-[#f0f4fa]
    ${pinned ? 'sticky z-[5]' : ''}
    ${isLastPinned ? 'border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]' : ''}
  `;
  const alignClass =
    column.align === 'right' ? 'text-right' :
    column.align === 'center' ? 'text-center' : 'text-left';

  const style: React.CSSProperties = {
    width: column.width,
    minWidth: column.width,
    left: pinned ? pinnedLeft : undefined,
  };

  // Rating (letter badge)
  if (column.key === 'rating') {
    const letter = getRatingLetter(stock.rating);
    const config = letter ? RATING_CONFIGS.find((c) => c.letter === letter) : null;
    return (
      <td className={`${baseClasses} text-center`} style={style}>
        {letter && config ? (
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-sm font-bold"
            style={{ backgroundColor: config.color }}
          >
            {letter}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
    );
  }

  // New High / Low badge
  if (column.key === 'new_high_low') {
    const val = stock.new_high_low;
    return (
      <td className={`${baseClasses} text-center`} style={style}>
        {val === 'high' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
            <TrendingUp size={12} /> High
          </span>
        ) : val === 'low' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold">
            <TrendingDown size={12} /> Low
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
    );
  }

  // Return / growth columns: colored by sign
  if (column.key.startsWith('return_') || column.key.startsWith('revenue_growth') || column.key.startsWith('earnings_growth')) {
    const numValue = stock[column.key] as number | null;
    const colorClass =
      numValue === null || numValue === undefined
        ? 'text-gray-400'
        : numValue >= 0
        ? 'text-green-600'
        : 'text-red-600';
    return (
      <td className={`${baseClasses} ${alignClass} font-medium ${colorClass}`} style={style}>
        {formatCellValue(stock, column)}
      </td>
    );
  }

  // Ticker: bold, highlighted
  if (column.key === 'ticker') {
    return (
      <td className={`${baseClasses} ${alignClass} font-semibold text-gray-900`} style={style}>
        {formatCellValue(stock, column)}
      </td>
    );
  }

  // Name: truncate
  if (column.key === 'name') {
    const value = formatCellValue(stock, column);
    return (
      <td className={`${baseClasses} ${alignClass} text-gray-700`} style={style}>
        <span className="truncate block" title={value}>
          {value}
        </span>
      </td>
    );
  }

  // Default cell
  return (
    <td className={`${baseClasses} ${alignClass} text-gray-700`} style={style}>
      {formatCellValue(stock, column)}
    </td>
  );
}

// =============================================================================
// Skeleton Row
// =============================================================================

interface TableRowSkeletonProps {
  columns: TableColumn[];
  pinnedOffsets: number[];
}

function TableRowSkeleton({ columns, pinnedOffsets }: TableRowSkeletonProps) {
  return (
    <tr>
      {columns.map((column, idx) => {
        const pinned = idx < PINNED_COLUMNS_COUNT;
        const isLastPinned = pinned && idx === PINNED_COLUMNS_COUNT - 1;
        return (
          <td
            key={column.key}
            className={`
              px-4 py-3 bg-white border-b border-gray-100
              ${pinned ? 'sticky z-[5]' : ''}
              ${isLastPinned ? 'border-r border-gray-200' : ''}
            `}
            style={{
              width: column.width,
              minWidth: column.width,
              left: pinned ? pinnedOffsets[idx] : undefined,
            }}
          >
            <div
              className={`
                h-5 bg-gray-200 rounded animate-pulse
                ${column.key === 'ticker' ? 'w-16' : ''}
                ${column.key === 'name' ? 'w-32' : ''}
                ${column.key === 'rating' ? 'w-7 h-7 rounded-full mx-auto' : ''}
                ${!['ticker', 'name', 'rating'].includes(column.key) ? 'w-16 ml-auto' : ''}
              `}
            />
          </td>
        );
      })}
    </tr>
  );
}
