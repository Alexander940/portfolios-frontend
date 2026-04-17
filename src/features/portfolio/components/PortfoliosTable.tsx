import { useNavigate } from 'react-router-dom';
import { Briefcase, ChevronRight, Star } from 'lucide-react';
import type { PortfolioResponse } from '@/services/portfolioService';

interface PortfoliosTableProps {
  portfolios: PortfolioResponse[];
}

const WEIGHTING_LABELS: Record<string, string> = {
  equal: 'Equal',
  rating_weighted: 'Rating',
  market_cap: 'Market Cap',
};

const TYPE_COLORS: Record<string, string> = {
  model: '#1e3a5f',
  custom: '#6366f1',
  virtual: '#14b8a6',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function fmtCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function PortfoliosTable({ portfolios }: PortfoliosTableProps) {
  const navigate = useNavigate();

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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Your portfolios</h2>
          <p className="text-sm text-gray-500">
            {portfolios.length} {portfolios.length === 1 ? 'portfolio' : 'portfolios'}.
            Click a row to view details.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Weighting
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Initial Capital
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Last Rebalance
              </th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {portfolios.map((p) => (
              <tr
                key={p.portfolio_id}
                onClick={() => navigate(`/dashboard/analysis/${p.portfolio_id}`)}
                className="hover:bg-[#f0f4fa] cursor-pointer transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {p.is_default && (
                      <Star
                        size={14}
                        className="text-[#c9a227] shrink-0"
                        fill="#c9a227"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {p.name}
                      </div>
                      {p.description && (
                        <div className="text-xs text-gray-500 truncate max-w-md">
                          {p.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase text-white"
                    style={{
                      backgroundColor: TYPE_COLORS[p.portfolio_type] ?? '#6b7280',
                    }}
                  >
                    {p.portfolio_type}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  {WEIGHTING_LABELS[p.weighting_method] ?? p.weighting_method}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900 font-medium text-right">
                  {fmtCurrency(p.initial_cash, p.currency)}
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  {fmtDate(p.created_at)}
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  {p.last_rebalance_date ? fmtDate(p.last_rebalance_date) : '—'}
                </td>
                <td className="px-4 py-4 text-right">
                  <ChevronRight size={16} className="text-gray-400 inline-block" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
