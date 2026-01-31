import { ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, RefreshCw } from 'lucide-react';
import { useScreenerStore } from '../stores';
import { DEFAULT_TABLE_COLUMNS, formatCellValue, getRatingLetter, RATING_CONFIGS } from '../constants';
import type { Stock, TableColumn } from '../types';

interface ResultsTableProps {
  data: Stock[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * ResultsTable Component
 *
 * Displays filtered stock results in an Excel-like table with:
 * - Sortable columns
 * - Fixed header on scroll
 * - Loading skeleton
 * - Empty/error states
 */
export function ResultsTable({ data, isLoading, error, onRetry }: ResultsTableProps) {
  const sortBy = useScreenerStore((state) => state.sortBy);
  const sortOrder = useScreenerStore((state) => state.sortOrder);
  const toggleSort = useScreenerStore((state) => state.toggleSort);

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

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          {/* Header */}
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {DEFAULT_TABLE_COLUMNS.map((column) => (
                <TableHeader
                  key={column.key}
                  column={column}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={toggleSort}
                />
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 10 }).map((_, idx) => (
                <TableRowSkeleton key={idx} columns={DEFAULT_TABLE_COLUMNS} />
              ))
            ) : (
              // Data rows
              data.map((stock) => (
                <TableRow key={stock.symbol_id} stock={stock} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Table Header Cell
 */
interface TableHeaderProps {
  column: TableColumn;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}

function TableHeader({ column, sortBy, sortOrder, onSort }: TableHeaderProps) {
  const isSorted = sortBy === column.key;

  return (
    <th
      className={`
        px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider
        ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}
        ${column.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''}
      `}
      style={{ width: column.width }}
      onClick={() => column.sortable && onSort(column.key)}
    >
      <div className={`flex items-center gap-1 ${column.align === 'right' ? 'justify-end' : ''}`}>
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

/**
 * Table Data Row
 */
interface TableRowProps {
  stock: Stock;
}

function TableRow({ stock }: TableRowProps) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {DEFAULT_TABLE_COLUMNS.map((column) => (
        <TableCell key={column.key} stock={stock} column={column} />
      ))}
    </tr>
  );
}

/**
 * Table Cell
 */
interface TableCellProps {
  stock: Stock;
  column: TableColumn;
}

function TableCell({ stock, column }: TableCellProps) {
  const value = formatCellValue(stock, column);

  // Special rendering for rating column
  if (column.key === 'rating') {
    const letter = getRatingLetter(stock.rating);
    const config = letter ? RATING_CONFIGS.find((c) => c.letter === letter) : null;

    return (
      <td className="px-4 py-3 text-center">
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

  // Special styling for return columns (positive/negative)
  if (column.key.startsWith('return_')) {
    const numValue = stock[column.key] as number | null;
    const colorClass =
      numValue === null
        ? 'text-gray-400'
        : numValue >= 0
        ? 'text-green-600'
        : 'text-red-600';

    return (
      <td className={`px-4 py-3 text-right font-medium ${colorClass}`}>
        {value}
      </td>
    );
  }

  return (
    <td
      className={`
        px-4 py-3 text-sm text-gray-700
        ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}
      `}
    >
      {column.key === 'ticker' ? (
        <span className="font-semibold text-gray-900">{value}</span>
      ) : column.key === 'name' ? (
        <span className="truncate block max-w-[200px]" title={value}>
          {value}
        </span>
      ) : (
        value
      )}
    </td>
  );
}

/**
 * Loading Skeleton Row
 */
interface TableRowSkeletonProps {
  columns: TableColumn[];
}

function TableRowSkeleton({ columns }: TableRowSkeletonProps) {
  return (
    <tr>
      {columns.map((column) => (
        <td key={column.key} className="px-4 py-3">
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
      ))}
    </tr>
  );
}
