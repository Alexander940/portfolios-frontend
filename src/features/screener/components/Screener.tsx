import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { Button } from '@/components/ui';
import { PrimaryFilters } from './PrimaryFilters';
import { AdditionalFiltersMenu } from './AdditionalFiltersMenu';
import { ActiveFilters } from './ActiveFilters';
import { FilterModal } from './FilterModal';
import { ResultsTable } from './ResultsTable';
import { TablePagination } from './TablePagination';
import { ColumnPresetTabs } from './ColumnPresetTabs';
import { SavePortfolioModal } from './SavePortfolioModal';
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

  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const canSaveAsPortfolio = !error && !isLoading && totalCount > 0;

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
        {/* Column preset tabs + Save as Portfolio */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <ColumnPresetTabs />
          <div className="flex items-center gap-3">
            {!error && !isLoading && data.length > 0 && (
              <span className="text-xs text-gray-500">
                {totalCount.toLocaleString()} results
              </span>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsSaveOpen(true)}
              disabled={!canSaveAsPortfolio}
              leftIcon={<Bookmark size={14} />}
              title={
                canSaveAsPortfolio
                  ? 'Create a portfolio from the current filter results'
                  : 'Run a search with at least one result to save as portfolio'
              }
            >
              Save as Portfolio
            </Button>
          </div>
        </div>

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

      {/* Save as Portfolio Modal */}
      <SavePortfolioModal
        isOpen={isSaveOpen}
        onClose={() => setIsSaveOpen(false)}
        totalCount={totalCount}
      />
    </div>
  );
}
