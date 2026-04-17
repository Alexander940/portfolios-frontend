import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Loader2 } from 'lucide-react';
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
import { PortfoliosTable } from './PortfoliosTable';
import { PortfolioPositionsTable } from './PortfolioPositionsTable';

/**
 * Portfolio feature root — renders the Portfolio Analysis page.
 *
 * URL /dashboard/analysis        → list of portfolios (table view).
 * URL /dashboard/analysis/:id    → detail: header + positions table.
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
  }, []);

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
    if (!portfolioId) return;
    setPositionsLoading(true);
    setPositionsError(null);
    listPortfolioPositions(portfolioId, {
      sort_by: sortBy,
      sort_order: sortOrder,
      limit: 500,
    })
      .then((res) => setPositions(res.items))
      .catch((err) => setPositionsError(resolveError(err)))
      .finally(() => setPositionsLoading(false));
  }

  // ===== List view (no portfolioId) =====
  if (!portfolioId) {
    if (portfoliosLoading) {
      return (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      );
    }
    if (portfoliosError) {
      return (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-600">{portfoliosError}</p>
        </div>
      );
    }
    return <PortfoliosTable portfolios={portfolios} />;
  }

  // ===== Detail view =====
  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate('/dashboard/analysis')}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#1e3a5f] transition-colors"
      >
        <ArrowLeft size={16} />
        Back to all portfolios
      </button>

      {portfolio && <PortfolioHeader portfolio={portfolio} />}

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
