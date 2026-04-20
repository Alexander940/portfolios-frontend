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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 280 }}>
              <PrimaryFilters />
            </div>
            <div style={{ flexShrink: 0 }}>
              <AdditionalFiltersMenu />
            </div>
          </div>

          <ActiveFilters />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <ColumnPresetTabs />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!error && !isLoading && data.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--c-text-dim)' }}>
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

        <ResultsTable
          data={data}
          isLoading={isLoading}
          error={error}
          onRetry={refresh}
        />

        {!error && (data.length > 0 || isLoading) && (
          <TablePagination totalCount={totalCount} />
        )}
      </div>

      <FilterModal />

      <SavePortfolioModal
        isOpen={isSaveOpen}
        onClose={() => setIsSaveOpen(false)}
        totalCount={totalCount}
      />
    </div>
  );
}
