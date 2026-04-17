import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Briefcase, Loader2 } from 'lucide-react';
import {
  listPortfolios,
  getPortfolio,
  listPortfolioPositions,
  type PortfolioResponse,
  type PortfolioPositionDetail,
  type PositionSortField,
  type SortOrder,
} from '@/services/portfolioService';
import { PortfolioHeader } from './PortfolioHeader';
import { PortfolioSelector } from './PortfolioSelector';
import { PortfolioPositionsTable } from './PortfolioPositionsTable';

/**
 * Portfolio feature root — renders the Portfolio Analysis page.
 *
 * URL /dashboard/analysis/:portfolioId → loads that portfolio.
 * URL /dashboard/analysis (no id) → auto-redirects to the default /
 * first portfolio.
 */
export function Portfolio() {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const navigate = useNavigate();

  const [portfolios, setPortfolios] = useState<PortfolioResponse[]>([]);
  const [portfoliosLoading, setPortfoliosLoading] = useState(true);
  const [portfoliosError, setPortfoliosError] = useState<string | null>(null);

  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [positions, setPositions] = useState<PortfolioPositionDetail[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<PositionSortField>('weight');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const positionsAbortRef = useRef<AbortController | null>(null);

  // Load portfolios list once
  useEffect(() => {
    const controller = new AbortController();
    setPortfoliosLoading(true);
    setPortfoliosError(null);

    listPortfolios(50, 0, controller.signal)
      .then((res) => {
        setPortfolios(res.items);
        // Auto-select first portfolio if no id in URL
        if (!portfolioId && res.items.length > 0) {
          const defaultP = res.items.find((p) => p.is_default) ?? res.items[0];
          navigate(`/dashboard/analysis/${defaultP.portfolio_id}`, { replace: true });
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setPortfoliosError(resolveError(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPortfoliosLoading(false);
      });

    return () => controller.abort();
  }, [navigate, portfolioId]);

  // Load selected portfolio details + positions
  useEffect(() => {
    if (!portfolioId) {
      setPortfolio(null);
      setPositions([]);
      return;
    }

    const controller = new AbortController();
    positionsAbortRef.current?.abort();
    positionsAbortRef.current = controller;

    setPositionsLoading(true);
    setPositionsError(null);

    Promise.all([
      getPortfolio(portfolioId, controller.signal),
      listPortfolioPositions(
        portfolioId,
        { sort_by: sortBy, sort_order: sortOrder, limit: 500 },
        controller.signal,
      ),
    ])
      .then(([p, posList]) => {
        setPortfolio(p);
        setPositions(posList.items);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          navigate('/dashboard/analysis', { replace: true });
          return;
        }
        setPositionsError(resolveError(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPositionsLoading(false);
      });

    return () => controller.abort();
  }, [portfolioId, sortBy, sortOrder, navigate]);

  function handleSortChange(field: PositionSortField, order: SortOrder) {
    setSortBy(field);
    setSortOrder(order);
  }

  function handleRetry() {
    // Re-trigger the positions effect by toggling state
    setSortBy((s) => s);
    if (portfolioId) {
      setPositionsLoading(true);
      setPositionsError(null);
      listPortfolioPositions(
        portfolioId,
        { sort_by: sortBy, sort_order: sortOrder, limit: 500 },
      )
        .then((res) => setPositions(res.items))
        .catch((err) => setPositionsError(resolveError(err)))
        .finally(() => setPositionsLoading(false));
    }
  }

  // Full-page loading (initial portfolios fetch)
  if (portfoliosLoading && portfolios.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (portfoliosError && portfolios.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-600">{portfoliosError}</p>
      </div>
    );
  }

  // User has no portfolios at all
  if (portfolios.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 bg-[#1e3a5f]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Briefcase className="w-8 h-8 text-[#1e3a5f]" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No portfolios yet</h3>
        <p className="text-gray-500 mb-4">
          Create a portfolio from the Screener to see it here.
        </p>
        <button
          onClick={() => navigate('/dashboard/screening')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2d5a8a] transition-colors"
        >
          Go to Screener
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Selector + (future) actions row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PortfolioSelector portfolios={portfolios} currentId={portfolioId} />
        {/* Reserved space for future actions (e.g. Rebalance, Delete, Edit) */}
      </div>

      {/* Header */}
      {portfolio && <PortfolioHeader portfolio={portfolio} />}

      {/* Positions table */}
      <PortfolioPositionsTable
        positions={positions}
        isLoading={positionsLoading}
        error={positionsError}
        onRetry={handleRetry}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />
    </div>
  );
}

function resolveError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (err.response?.status === 404) return 'Portfolio not found.';
    if (err.response?.status === 401) return 'Not authenticated.';
  }
  return 'Could not load data. Please try again.';
}
