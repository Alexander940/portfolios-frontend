import { useParams } from 'react-router-dom';
import { Download, GitCompare } from 'lucide-react';
import { Portfolio, PortfolioStatCards } from '@/features/portfolio';

/**
 * PortfolioAnalysisPage
 *
 * List view: page header + stat cards + portfolios table.
 * Detail view (when :portfolioId is present): defers entirely to <Portfolio/>.
 */
export function PortfolioAnalysisPage() {
  const { portfolioId } = useParams<{ portfolioId: string }>();

  if (portfolioId) {
    return <Portfolio />;
  }

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
          <button type="button" className="chip">
            <Download size={12} />
            Export
          </button>
          <button type="button" className="chip">
            <GitCompare size={12} />
            Compare
          </button>
        </div>
      </div>

      <PortfolioStatCards />
      <Portfolio />
    </>
  );
}
