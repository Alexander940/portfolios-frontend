import { Portfolio } from '@/features/portfolio';

/**
 * PortfolioAnalysisPage
 *
 * Dashboard entry point for viewing a model portfolio's positions
 * with current prices, P&L and rating info.
 */
export function PortfolioAnalysisPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Portfolio Analysis</h1>
        <p className="text-gray-600 mt-1">
          Detailed performance view of your portfolio positions.
        </p>
      </div>
      <Portfolio />
    </div>
  );
}
