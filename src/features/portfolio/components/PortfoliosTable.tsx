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
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            background: 'var(--c-accent-soft)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Briefcase size={28} color="var(--c-accent-text)" />
        </div>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--c-text)',
            margin: '0 0 6px',
          }}
        >
          No portfolios yet
        </h3>
        <p
          style={{
            color: 'var(--c-text-dim)',
            margin: '0 0 16px',
            fontSize: 13,
          }}
        >
          Create a portfolio from the Screener to see it here.
        </p>
        <button
          type="button"
          className="topbar-btn primary"
          onClick={() => navigate('/dashboard/screening')}
        >
          Go to Screener
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Portfolio Monitoring</div>
          <div className="card-sub">
            {portfolios.length} {portfolios.length === 1 ? 'portfolio' : 'portfolios'}
          </div>
        </div>
      </div>

      <div style={{ overflow: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th>Name</th>
              <th>Type</th>
              <th>Weighting</th>
              <th className="num">Initial Capital</th>
              <th>Created</th>
              <th>Last Rebalance</th>
              <th style={{ width: 28 }}></th>
            </tr>
          </thead>
          <tbody>
            {portfolios.map((p) => {
              const typeClass = p.portfolio_type.toLowerCase();
              return (
                <tr
                  key={p.portfolio_id}
                  className="clickable"
                  onClick={() =>
                    navigate(`/dashboard/analysis/${p.portfolio_id}`)
                  }
                >
                  <td>
                    {p.is_default && (
                      <Star
                        size={14}
                        color="var(--c-warn)"
                        fill="var(--c-warn)"
                      />
                    )}
                  </td>
                  <td className="name-cell">
                    <div style={{ fontWeight: 500, color: 'var(--c-text)' }}>
                      {p.name}
                    </div>
                    {p.description && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--c-text-dim)',
                          marginTop: 2,
                          maxWidth: 360,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`type-badge ${
                        ['model', 'custom', 'virtual'].includes(typeClass)
                          ? typeClass
                          : 'custom'
                      }`}
                    >
                      {p.portfolio_type}
                    </span>
                  </td>
                  <td className="dim" style={{ fontFamily: 'var(--font-sans)' }}>
                    {WEIGHTING_LABELS[p.weighting_method] ?? p.weighting_method}
                  </td>
                  <td className="num">
                    {fmtCurrency(p.initial_cash, p.currency)}
                  </td>
                  <td className="dim">{fmtDate(p.created_at)}</td>
                  <td className="dim">
                    {p.last_rebalance_date ? fmtDate(p.last_rebalance_date) : '—'}
                  </td>
                  <td className="num">
                    <ChevronRight size={14} color="var(--c-text-dim)" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
