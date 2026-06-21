import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, GitCompare, Trash2 } from 'lucide-react';
import { Portfolio, PortfolioStatCards } from '@/features/portfolio';
import {
  deletePortfolio,
  exportPortfolios,
  listPortfolios,
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
    listPortfolios(50, 0, controller.signal)
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
  }, [isList]);

  // Drop selected ids that no longer exist (e.g. after a delete).
  useEffect(() => {
    retainSelection(portfolios.map((p) => p.portfolio_id));
  }, [portfolios, retainSelection]);

  if (portfolioId) return <Portfolio />;

  const selected = portfolios.filter((p) => selectedIds.has(p.portfolio_id));
  const ids = selected.map((p) => p.portfolio_id);
  const count = ids.length;

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
    if (count === 0 || busy) return;
    setBusy(true);
    try {
      const { blob, filename } = await exportPortfolios(ids);
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
    if (count === 0 || busy) return;
    const ok = window.confirm(
      `Delete ${count} portfolio${count > 1 ? 's' : ''}? This cannot be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    const failed: string[] = [];
    for (const id of ids) {
      try {
        await deletePortfolio(id);
      } catch {
        failed.push(id);
      }
    }
    const deleted = new Set(ids.filter((id) => !failed.includes(id)));
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="chip"
            onClick={handleExport}
            disabled={count === 0 || busy}
            title="Export selected portfolios' holdings"
            style={count === 0 ? disabledChipStyle : undefined}
          >
            <Download size={12} />
            Export{count > 0 ? ` (${count})` : ''}
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => setCompareOpen(true)}
            disabled={count < 2 || busy}
            title="Compare selected portfolios (pick at least 2)"
            style={count < 2 ? disabledChipStyle : undefined}
          >
            <GitCompare size={12} />
            Compare{count > 0 ? ` (${count})` : ''}
          </button>
          <button
            type="button"
            className="chip"
            onClick={handleBulkDelete}
            disabled={count === 0 || busy}
            title="Delete selected portfolios"
            style={
              count === 0
                ? disabledChipStyle
                : { borderColor: 'var(--c-neg)', color: 'var(--c-neg)' }
            }
          >
            <Trash2 size={12} />
            Delete{count > 0 ? ` (${count})` : ''}
          </button>
        </div>
      </div>

      <PortfolioStatCards />
      <Portfolio
        portfolios={portfolios}
        portfoliosLoading={loading}
        portfoliosError={error}
        onDeletePortfolio={handleDeleteOne}
        onImportCreated={handleCreated}
      />
      <ComparePortfoliosModal
        isOpen={compareOpen}
        onClose={() => setCompareOpen(false)}
        portfolios={selected}
      />
    </>
  );
}
