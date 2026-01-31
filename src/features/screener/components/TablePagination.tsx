import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useScreenerStore } from '../stores';
import { PAGE_SIZE_OPTIONS } from '../constants';

interface TablePaginationProps {
  totalCount: number;
}

/**
 * TablePagination Component
 *
 * Pagination controls for the results table:
 * - Page navigation (first, prev, next, last)
 * - Current page info
 * - Page size selector
 */
export function TablePagination({ totalCount }: TablePaginationProps) {
  const page = useScreenerStore((state) => state.page);
  const pageSize = useScreenerStore((state) => state.pageSize);
  const setPage = useScreenerStore((state) => state.setPage);
  const setPageSize = useScreenerStore((state) => state.setPageSize);

  const totalPages = Math.ceil(totalCount / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white border border-gray-200 rounded-lg">
      {/* Results info */}
      <div className="text-sm text-gray-600">
        {totalCount > 0 ? (
          <>
            Showing <span className="font-medium">{startItem}</span> to{' '}
            <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{totalCount.toLocaleString()}</span> results
          </>
        ) : (
          'No results'
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="page-size" className="text-sm text-gray-600">
            Per page:
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          {/* First page */}
          <PaginationButton
            onClick={() => setPage(1)}
            disabled={!canGoPrev}
            aria-label="First page"
          >
            <ChevronsLeft size={18} />
          </PaginationButton>

          {/* Previous page */}
          <PaginationButton
            onClick={() => setPage(page - 1)}
            disabled={!canGoPrev}
            aria-label="Previous page"
          >
            <ChevronLeft size={18} />
          </PaginationButton>

          {/* Page number input */}
          <div className="flex items-center gap-1 px-2">
            <span className="text-sm text-gray-600">Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={page}
              onChange={(e) => {
                const newPage = parseInt(e.target.value, 10);
                if (!isNaN(newPage) && newPage >= 1 && newPage <= totalPages) {
                  setPage(newPage);
                }
              }}
              className="w-12 border border-gray-300 rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
              aria-label="Current page"
            />
            <span className="text-sm text-gray-600">of {totalPages || 1}</span>
          </div>

          {/* Next page */}
          <PaginationButton
            onClick={() => setPage(page + 1)}
            disabled={!canGoNext}
            aria-label="Next page"
          >
            <ChevronRight size={18} />
          </PaginationButton>

          {/* Last page */}
          <PaginationButton
            onClick={() => setPage(totalPages)}
            disabled={!canGoNext}
            aria-label="Last page"
          >
            <ChevronsRight size={18} />
          </PaginationButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Pagination Button
 */
interface PaginationButtonProps {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  'aria-label': string;
}

function PaginationButton({
  onClick,
  disabled,
  children,
  'aria-label': ariaLabel,
}: PaginationButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`
        p-1.5 rounded-md transition-colors
        ${
          disabled
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }
        focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:ring-offset-1
      `}
    >
      {children}
    </button>
  );
}
