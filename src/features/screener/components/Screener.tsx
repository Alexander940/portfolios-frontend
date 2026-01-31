import { PrimaryFilters } from './PrimaryFilters';
import { AdditionalFiltersMenu } from './AdditionalFiltersMenu';
import { ActiveFilters } from './ActiveFilters';
import { FilterModal } from './FilterModal';
import { ResultsTable } from './ResultsTable';
import { TablePagination } from './TablePagination';
import { useScreenerData, useScreenerUrlSync } from '../hooks';

/**
 * Screener Component
 *
 * Main container that orchestrates all screener components:
 * - Primary filters (Market, Sector, Rating)
 * - Additional filters menu and modal
 * - Active filters display
 * - Results table with pagination
 */
export function Screener() {
  // Sync URL with filter state
  useScreenerUrlSync();

  // Fetch screener data
  const { data, totalCount, isLoading, error, refresh } = useScreenerData();

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="space-y-4">
          {/* Primary Filters Row */}
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex-1">
              <PrimaryFilters />
            </div>
            <div className="flex-shrink-0">
              <AdditionalFiltersMenu />
            </div>
          </div>

          {/* Active Filters */}
          <ActiveFilters />
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-4">
        {/* Results Table */}
        <ResultsTable
          data={data}
          isLoading={isLoading}
          error={error}
          onRetry={refresh}
        />

        {/* Pagination */}
        {!error && (data.length > 0 || isLoading) && (
          <TablePagination totalCount={totalCount} />
        )}
      </div>

      {/* Filter Configuration Modal */}
      <FilterModal />
    </div>
  );
}
