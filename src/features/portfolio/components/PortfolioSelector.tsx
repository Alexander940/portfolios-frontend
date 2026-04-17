import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import type { PortfolioResponse } from '@/services/portfolioService';

interface PortfolioSelectorProps {
  portfolios: PortfolioResponse[];
  currentId: string | undefined;
}

export function PortfolioSelector({ portfolios, currentId }: PortfolioSelectorProps) {
  const navigate = useNavigate();

  if (portfolios.length === 0) return null;

  return (
    <div className="relative inline-block">
      <select
        value={currentId ?? ''}
        onChange={(e) => {
          const id = e.target.value;
          if (id) navigate(`/dashboard/analysis/${id}`);
        }}
        className="
          appearance-none w-full min-w-[240px] pl-3 pr-9 py-2
          bg-white border border-gray-200 rounded-lg
          text-sm text-gray-900 font-medium
          focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent
          cursor-pointer
        "
      >
        {!currentId && <option value="">Select a portfolio...</option>}
        {portfolios.map((p) => (
          <option key={p.portfolio_id} value={p.portfolio_id}>
            {p.name}
            {p.is_default ? '  ★' : ''}
          </option>
        ))}
      </select>
      <ChevronDown
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        size={16}
      />
    </div>
  );
}
