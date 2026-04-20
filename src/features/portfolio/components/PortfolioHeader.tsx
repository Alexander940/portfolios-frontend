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
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PortfolioHeader({ portfolio }: PortfolioHeaderProps) {
  const weighting =
    WEIGHTING_LABELS[portfolio.weighting_method] ?? portfolio.weighting_method;
  const typeClass = portfolio.portfolio_type.toLowerCase();

  const meta = [
    {
      icon: Wallet,
      label: 'Initial capital',
      value: `${portfolio.currency} ${portfolio.initial_cash.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`,
    },
    {
      icon: Calendar,
      label: 'Created',
      value: formatDate(portfolio.created_at),
    },
    {
      icon: RefreshCw,
      label: 'Last rebalance',
      value: portfolio.last_rebalance_date
        ? formatDate(portfolio.last_rebalance_date)
        : '—',
    },
    {
      icon: Calendar,
      label: 'Last updated',
      value: formatDate(portfolio.updated_at),
    },
  ];

  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 12, minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 40,
              height: 40,
              background: 'var(--c-accent-soft)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Briefcase size={18} color="var(--c-accent-text)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1
              className="page-title"
              style={{ marginBottom: 2, fontSize: 20 }}
            >
              {portfolio.name}
            </h1>
            {portfolio.description && (
              <div className="page-sub">{portfolio.description}</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span
            className={`type-badge ${
              ['model', 'custom', 'virtual'].includes(typeClass)
                ? typeClass
                : 'custom'
            }`}
          >
            {portfolio.portfolio_type}
          </span>
          <span
            className="type-badge"
            style={{
              background: 'var(--c-bg-soft)',
              color: 'var(--c-text-soft)',
              border: '1px solid var(--c-border)',
            }}
          >
            {weighting}
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          paddingTop: 16,
          borderTop: '1px solid var(--c-border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
        }}
      >
        {meta.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} style={{ display: 'flex', gap: 8 }}>
              <Icon
                size={14}
                color="var(--c-text-dim)"
                style={{ marginTop: 3, flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--c-text-dim)',
                    fontWeight: 500,
                    marginBottom: 3,
                  }}
                >
                  {m.label}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--c-text)',
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {m.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
