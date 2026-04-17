import { Briefcase, Calendar, RefreshCw, Wallet } from 'lucide-react';
import type { PortfolioResponse } from '@/services/portfolioService';

interface PortfolioHeaderProps {
  portfolio: PortfolioResponse;
}

const WEIGHTING_LABELS: Record<string, string> = {
  equal: 'Equal Weight',
  rating_weighted: 'Rating Weighted',
  market_cap: 'Market Cap',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function PortfolioHeader({ portfolio }: PortfolioHeaderProps) {
  const weighting = WEIGHTING_LABELS[portfolio.weighting_method] ?? portfolio.weighting_method;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-[#1e3a5f]/10 rounded-lg flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-[#1e3a5f]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">
                {portfolio.name}
              </h1>
              {portfolio.description && (
                <p className="text-sm text-gray-500 truncate">{portfolio.description}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-1 bg-[#1e3a5f] text-white rounded text-xs font-semibold uppercase">
            {portfolio.portfolio_type}
          </span>
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
            {weighting}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="flex items-start gap-2">
          <Wallet size={16} className="text-gray-400 mt-0.5" />
          <div>
            <div className="text-xs text-gray-500">Initial capital</div>
            <div className="text-sm font-semibold text-gray-900">
              {portfolio.currency}{' '}
              {portfolio.initial_cash.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Calendar size={16} className="text-gray-400 mt-0.5" />
          <div>
            <div className="text-xs text-gray-500">Created</div>
            <div className="text-sm font-semibold text-gray-900">
              {formatDate(portfolio.created_at)}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <RefreshCw size={16} className="text-gray-400 mt-0.5" />
          <div>
            <div className="text-xs text-gray-500">Last rebalance</div>
            <div className="text-sm font-semibold text-gray-900">
              {portfolio.last_rebalance_date ? formatDate(portfolio.last_rebalance_date) : '—'}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Calendar size={16} className="text-gray-400 mt-0.5" />
          <div>
            <div className="text-xs text-gray-500">Last updated</div>
            <div className="text-sm font-semibold text-gray-900">
              {formatDate(portfolio.updated_at)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
