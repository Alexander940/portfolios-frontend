import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import {
  deletePortfolio,
  listPortfolios,
  getPortfolio,
  listPortfolioPositions,
  type PortfolioResponse,
  type PortfolioPositionDetail,
  type PositionSortField,
  type SortOrder,
} from '@/services/portfolioService';
import { isApiError } from '@/lib/apiErrors';
import { PortfolioHeader } from './PortfolioHeader';
import { PortfoliosTable } from './PortfoliosTable';
import { PortfolioPositionsTable } from './PortfolioPositionsTable';
import { PortfolioOverviewTab } from './PortfolioOverviewTab';
import { PortfolioEventsTab } from './PortfolioEventsTab';
import { ImportPortfolioFromExcelModal } from './ImportPortfolioFromExcelModal';

const DETAIL_TABS = ['overview', 'holdings', 'events'] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

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
  const [positionsTotal, setPositionsTotal] = useState(0);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<PositionSortField>('weight');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [importModalOpen, setImportModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

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
      setPositionsTotal(0);
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
        {
          sort_by: sortBy,
          sort_order: sortOrder,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        },
        controller.signal,
      ),
    ])
      .then(([p, posList]) => {
        setPortfolio(p);
        setPositions(posList.items);
        setPositionsTotal(posList.total);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (isApiError(err) && err.status === 404) {
          navigate('/dashboard/analysis', { replace: true });
          return;
        }
        setPositionsError(resolveError(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPositionsLoading(false);
      });

    return () => controller.abort();
  }, [portfolioId, sortBy, sortOrder, page, pageSize, navigate]);

  function handleSortChange(field: PositionSortField, order: SortOrder) {
    setSortBy(field);
    setSortOrder(order);
    setPage(1);
  }

  function handlePageSizeChange(size: number) {
    setPageSize(size);
    setPage(1);
  }

  async function handleDeletePortfolio(id: string) {
    await deletePortfolio(id);
    setPortfolios((prev) => prev.filter((p) => p.portfolio_id !== id));
  }

  function handleRetry() {
    if (!portfolioId) return;
    setPositionsLoading(true);
    setPositionsError(null);
    listPortfolioPositions(portfolioId, {
      sort_by: sortBy,
      sort_order: sortOrder,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then((res) => {
        setPositions(res.items);
        setPositionsTotal(res.total);
      })
      .catch((err) => setPositionsError(resolveError(err)))
      .finally(() => setPositionsLoading(false));
  }

  // ===== List view (no portfolioId) =====
  if (!portfolioId) {
    if (portfoliosLoading) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 0',
          }}
        >
          <Loader2
            size={28}
            color="var(--c-text-dim)"
            style={{ animation: 'spin 1s linear infinite' }}
          />
        </div>
      );
    }
    if (portfoliosError) {
      return (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ color: 'var(--c-text-soft)', margin: 0 }}>
            {portfoliosError}
          </p>
        </div>
      );
    }
    return (
      <>
        <PortfoliosTable
          portfolios={portfolios}
          onDelete={handleDeletePortfolio}
          onImportClick={() => setImportModalOpen(true)}
        />
        <ImportPortfolioFromExcelModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onCreated={(p) =>
            setPortfolios((prev) =>
              prev.some((x) => x.portfolio_id === p.portfolio_id)
                ? prev
                : [p, ...prev],
            )
          }
        />
      </>
    );
  }

  // ===== Detail view =====
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button
        type="button"
        onClick={() => navigate('/dashboard/analysis')}
        className="topbar-btn"
        style={{ alignSelf: 'flex-start', padding: '6px 0' }}
      >
        <ArrowLeft size={14} />
        Back to all portfolios
      </button>

      {portfolio && <PortfolioHeader portfolio={portfolio} />}

      <div className="tabs" role="tablist">
        {DETAIL_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={activeTab === t}
            className={`tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <PortfolioOverviewTab portfolioId={portfolioId} />
      )}

      {activeTab === 'holdings' && (
        <PortfolioPositionsTable
          positions={positions}
          isLoading={positionsLoading}
          error={positionsError}
          onRetry={handleRetry}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          page={page}
          pageSize={pageSize}
          total={positionsTotal}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {activeTab === 'events' && <PortfolioEventsTab portfolioId={portfolioId} />}
    </div>
  );
}

function resolveError(err: unknown): string {
  if (isApiError(err)) {
    if (err.status === 404) return 'Portfolio not found.';
    if (err.status === 401) return 'Your session has expired. Please sign in again.';
    return err.message;
  }
  return 'Could not load data. Please try again.';
}
