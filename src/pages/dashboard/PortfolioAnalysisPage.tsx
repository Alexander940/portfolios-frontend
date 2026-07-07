import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Briefcase, Download, GitCompare, Trash2, Users } from 'lucide-react';
import { Portfolio, PortfolioStatCards } from '@/features/portfolio';
import {
  deletePortfolio,
  exportPortfolios,
  listPortfolios,
  listSharedWithMe,
  type PortfolioResponse,
} from '@/services/portfolioService';
import { getErrorMessage } from '@/lib/apiErrors';
import { usePortfolioSelection } from '@/features/portfolio/store/selection';
import { ComparePortfoliosModal } from '@/features/portfolio/components/ComparePortfoliosModal';

/**
 * PortfolioAnalysisPage
 *
 * List view: page header (with bulk-action chips) + stat cards + portfolios
 * table. The portfolios list is owned here so the header chips and the table's
 * row checkboxes act on the same data; selection lives in a zustand store.
 * Detail view (when :portfolioId is present): defers entirely to <Portfolio/>.
 */
export function PortfolioAnalysisPage() {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const isList = !portfolioId;

  const [view, setView] = useState<'mine' | 'shared'>('mine');
  const [portfolios, setPortfolios] = useState<PortfolioResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const selectedIds = usePortfolioSelection((s) => s.selectedIds);
  const clearSelection = usePortfolioSelection((s) => s.clear);
  const retainSelection = usePortfolioSelection((s) => s.retain);

  useEffect(() => {
    if (!isList) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const request =
      view === 'shared'
        ? listSharedWithMe(50, 0, controller.signal)
        : listPortfolios(50, 0, controller.signal);
    request
      .then((res) => {
        if (!controller.signal.aborted) setPortfolios(res.items);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isList, view]);

  function handleViewChange(next: 'mine' | 'shared') {
    if (next === view) return;
    clearSelection();
    setView(next);
  }

  // Drop selected ids that no longer exist (e.g. after a delete).
  useEffect(() => {
    retainSelection(portfolios.map((p) => p.portfolio_id));
  }, [portfolios, retainSelection]);

  if (portfolioId) return <Portfolio />;

  const selected = portfolios.filter((p) => selectedIds.has(p.portfolio_id));
  // Bulk delete/export act on OWNED portfolios only; compare can include any
  // selected row. (Shared rows aren't selectable, so this is a safety net.)
  const ownedSelected = selected.filter((p) => p.is_owner !== false);
  const ownedIds = ownedSelected.map((p) => p.portfolio_id);
  const ownedCount = ownedIds.length;
  const compareCount = selected.length;

  async function handleDeleteOne(id: string) {
    await deletePortfolio(id);
    setPortfolios((prev) => prev.filter((p) => p.portfolio_id !== id));
  }

  function handleCreated(p: PortfolioResponse) {
    setPortfolios((prev) =>
      prev.some((x) => x.portfolio_id === p.portfolio_id) ? prev : [p, ...prev],
    );
  }

  async function handleExport() {
    if (ownedCount === 0 || busy) return;
    setBusy(true);
    try {
      const { blob, filename } = await exportPortfolios(ownedIds);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkDelete() {
    if (ownedCount === 0 || busy) return;
    const ok = window.confirm(
      `Delete ${ownedCount} portfolio${ownedCount > 1 ? 's' : ''}? This cannot be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    const failed: string[] = [];
    for (const id of ownedIds) {
      try {
        await deletePortfolio(id);
      } catch {
        failed.push(id);
      }
    }
    const deleted = new Set(ownedIds.filter((id) => !failed.includes(id)));
    setPortfolios((prev) => prev.filter((p) => !deleted.has(p.portfolio_id)));
    clearSelection();
    setBusy(false);
    if (failed.length > 0) {
      window.alert(`${failed.length} portfolio(s) could not be deleted.`);
    }
  }

  const disabledChipStyle = { opacity: 0.5, cursor: 'not-allowed' as const };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Portfolio Analysis</h1>
          <div className="page-sub">
            Monitor portfolios, react to rating events, and rebalance with context.
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className={`chip ${view === 'mine' ? 'active' : ''}`}
              onClick={() => handleViewChange('mine')}
            >
              <Briefcase size={12} />
              Mis portafolios
            </button>
            <button
              type="button"
              className={`chip ${view === 'shared' ? 'active' : ''}`}
              onClick={() => handleViewChange('shared')}
            >
              <Users size={12} />
              Compartidos conmigo
            </button>
          </div>

          {view === 'mine' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="chip"
                onClick={handleExport}
                disabled={ownedCount === 0 || busy}
                title="Export selected portfolios' holdings"
                style={ownedCount === 0 ? disabledChipStyle : undefined}
              >
                <Download size={12} />
                Export{ownedCount > 0 ? ` (${ownedCount})` : ''}
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => setCompareOpen(true)}
                disabled={compareCount < 2 || busy}
                title="Compare selected portfolios (pick at least 2)"
                style={compareCount < 2 ? disabledChipStyle : undefined}
              >
                <GitCompare size={12} />
                Compare{compareCount > 0 ? ` (${compareCount})` : ''}
              </button>
              <button
                type="button"
                className="chip"
                onClick={handleBulkDelete}
                disabled={ownedCount === 0 || busy}
                title="Delete selected portfolios"
                style={
                  ownedCount === 0
                    ? disabledChipStyle
                    : { borderColor: 'var(--c-neg)', color: 'var(--c-neg)' }
                }
              >
                <Trash2 size={12} />
                Delete{ownedCount > 0 ? ` (${ownedCount})` : ''}
              </button>
            </div>
          )}
        </div>
      </div>

      <PortfolioStatCards />
      <Portfolio
        portfolios={portfolios}
        portfoliosLoading={loading}
        portfoliosError={error}
        onDeletePortfolio={view === 'mine' ? handleDeleteOne : undefined}
        onImportCreated={handleCreated}
        showImport={view === 'mine'}
      />
      <ComparePortfoliosModal
        isOpen={compareOpen}
        onClose={() => setCompareOpen(false)}
        portfolios={selected}
      />
    </>
  );
}
