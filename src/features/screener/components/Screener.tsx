import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, Bookmark, Download, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  parseCreationSpec,
  type PortfolioRankingSpec,
  type RebalanceRedirectState,
  type RebalanceWeighting,
} from '@/services/portfolioService';
import { PrimaryFilters } from './PrimaryFilters';
import { AdditionalFiltersMenu } from './AdditionalFiltersMenu';
import { ActiveFilters } from './ActiveFilters';
import { FilterModal } from './FilterModal';
import { ResultsTable } from './ResultsTable';
import { TablePagination } from './TablePagination';
import { ColumnPresetTabs } from './ColumnPresetTabs';
import { SavedScreensBar } from './SavedScreensBar';
import { SavePortfolioModal } from './SavePortfolioModal';
import { RebalancePortfolioModal } from './RebalancePortfolioModal';
import { useScreenerData, useScreenerUrlSync } from '../hooks';
import {
  isKnownRankingSortField,
  screenerService,
  specFiltersToCriteria,
} from '../services';
import { useScreenerStore } from '../stores';

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

  const location = useLocation();
  const navigate = useNavigate();

  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isRebalanceOpen, setIsRebalanceOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Redirect flow from the portfolio view's "Rebalance" button (US6 #114):
  // preselected target + prefills restored from the portfolio's saved spec.
  const [rebalanceTarget, setRebalanceTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [initialRanking, setInitialRanking] =
    useState<PortfolioRankingSpec | null>(null);
  const [initialWeighting, setInitialWeighting] =
    useState<RebalanceWeighting | null>(null);
  /** Saved filter keys the current UI catalog couldn't load (old/new specs). */
  const [preloadIgnored, setPreloadIgnored] = useState<string[] | null>(null);

  const getApiRequest = useScreenerStore((s) => s.getApiRequest);
  const applyPreset = useScreenerStore((s) => s.applyPreset);
  const clearAllFilters = useScreenerStore((s) => s.clearAllFilters);

  // Consume the router state exactly once: preload the recognized filters into
  // the store (same applyPreset mechanism saved screens use), collect the
  // unrecognized ones for the notice, open the modal with the target
  // preselected, then clear the history state so a refresh doesn't replay it.
  const redirectConsumedRef = useRef(false);
  useEffect(() => {
    const payload = (location.state as Partial<RebalanceRedirectState> | null)
      ?.rebalanceRedirect;
    if (!payload || redirectConsumedRef.current) return;
    redirectConsumedRef.current = true;

    const parsed = parseCreationSpec(payload.screenerFilters);
    const ignored: string[] = [];
    if (parsed) {
      const { criteria, ignored: ignoredFilters } = specFiltersToCriteria(
        parsed.filters,
        useScreenerStore.getState().columnPreset,
      );
      applyPreset(criteria);
      ignored.push(...ignoredFilters);
    } else {
      // No saved spec (from-tickers/import portfolio): land on a clean
      // screener and let the user build the selection from scratch.
      clearAllFilters();
    }

    // Ranking prefill — validate the sort field against the current catalog.
    let ranking: PortfolioRankingSpec | null = null;
    if (parsed?.ranking) {
      const r = parsed.ranking;
      const topN = Math.floor(Number(r.top_n));
      if (Number.isFinite(topN) && topN >= 1) {
        let sortField = typeof r.sort_by === 'string' && r.sort_by ? r.sort_by : 'rating';
        if (!isKnownRankingSortField(sortField)) {
          ignored.push(`ranking field "${sortField}" (replaced with Rating)`);
          sortField = 'rating';
        }
        ranking = {
          sort_by: sortField,
          sort_order: r.sort_order === 'asc' ? 'asc' : 'desc',
          top_n: topN,
        };
      }
    }

    setRebalanceTarget({ id: payload.portfolioId, name: payload.portfolioName });
    setInitialRanking(ranking);
    setInitialWeighting(
      payload.weightingMethod && payload.weightingMethod !== 'manual'
        ? payload.weightingMethod
        : null,
    );
    setPreloadIgnored(ignored.length > 0 ? ignored : null);
    setIsRebalanceOpen(true);

    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate, applyPreset, clearAllFilters]);

  const canSaveAsPortfolio = !error && !isLoading && totalCount > 0;
  const canExport = !error && !isLoading && totalCount > 0;

  async function handleExport() {
    setExportError(null);
    setIsExporting(true);
    try {
      // The backend ignores limit/offset on export, but we still strip them
      // here so the request body matches what users see in the filter panel.
      const filters = { ...getApiRequest() };
      delete filters.limit;
      delete filters.offset;
      const { blob, filename } = await screenerService.exportToExcel(filters);
      triggerDownload(blob, filename);
    } catch (err) {
      let message = 'Could not export. Try again in a moment.';
      if (axios.isAxiosError(err) && err.response?.data) {
        // The backend returns JSON on errors even though success is a blob;
        // axios still parses .data to a Blob, so peel off the text to inspect.
        const data = err.response.data;
        if (data instanceof Blob) {
          try {
            const text = await data.text();
            const parsed = JSON.parse(text);
            if (typeof parsed?.detail === 'string') message = parsed.detail;
          } catch {
            // Fall through to default message
          }
        } else if (typeof data?.detail === 'string') {
          message = data.detail;
        }
      }
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SavedScreensBar />

      {preloadIgnored && preloadIgnored.length > 0 && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            fontSize: 12,
            color: '#92400e',
            background: '#fffbeb',
            padding: '10px 12px',
            border: '1px solid #fcd34d',
            borderRadius: 8,
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ flex: 1 }}>
            <strong>
              {preloadIgnored.length} saved filter
              {preloadIgnored.length === 1 ? '' : 's'} could not be loaded
            </strong>{' '}
            (no longer offered by the screener) and{' '}
            {preloadIgnored.length === 1 ? 'was' : 'were'} ignored:{' '}
            {preloadIgnored.join(', ')}. The rest of the saved filters were
            applied.
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setPreloadIgnored(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#92400e',
              padding: 0,
              lineHeight: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 20, overflow: 'visible' }}>
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
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={!canExport || isExporting}
              leftIcon={
                isExporting ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <Download size={14} />
                )
              }
              title={
                canExport
                  ? 'Download all filtered results as an Excel workbook'
                  : 'Run a search with at least one result to export'
              }
            >
              {isExporting ? 'Exporting...' : 'Export to Excel'}
            </Button>
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsRebalanceOpen(true)}
              disabled={!canSaveAsPortfolio}
              leftIcon={<RefreshCw size={14} />}
              title={
                canSaveAsPortfolio
                  ? 'Rebalance an existing portfolio toward the current filter results'
                  : 'Run a search with at least one result to rebalance a portfolio'
              }
            >
              Rebalance Portfolio
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

      {exportError && (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: 'var(--c-danger, #ef4444)',
            padding: '8px 10px',
            border: '1px solid var(--c-danger, #ef4444)',
            borderRadius: 6,
          }}
        >
          {exportError}
        </div>
      )}

      <FilterModal />

      <SavePortfolioModal
        isOpen={isSaveOpen}
        onClose={() => setIsSaveOpen(false)}
        totalCount={totalCount}
      />

      <RebalancePortfolioModal
        isOpen={isRebalanceOpen}
        onClose={() => setIsRebalanceOpen(false)}
        totalCount={totalCount}
        resultsLoading={isLoading}
        initialPortfolioId={rebalanceTarget?.id ?? null}
        initialRanking={initialRanking}
        initialWeighting={initialWeighting}
      />
    </div>
  );
}

/**
 * Trigger a browser download for an in-memory blob. Mounted to document.body
 * before the click for cross-browser compatibility, then removed; the object
 * URL is revoked on the next tick to give Safari time to start the download.
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
