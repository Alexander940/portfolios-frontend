import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Calendar, RefreshCw, Share2, Users, Wallet } from 'lucide-react';
import type {
  PortfolioResponse,
  RebalanceRedirectState,
} from '@/services/portfolioService';
import { toLocalDate } from '@/features/portfolio/lib/format';
import { SharePortfolioModal } from './SharePortfolioModal';

interface PortfolioHeaderProps {
  portfolio: PortfolioResponse;
  /** Bubble up the reshaped portfolio after an ownership transfer. */
  onTransferred?: (updated: PortfolioResponse) => void;
}

const WEIGHTING_LABELS: Record<string, string> = {
  equal: 'Equal Weight',
  rating_weighted: 'Rating Weighted',
  market_cap: 'Market Cap',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  // toLocalDate keeps date-only values (e.g. last_rebalance_date) on their
  // real calendar day for UTC-3 users; full timestamps are parsed as-is.
  return toLocalDate(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PortfolioHeader({ portfolio, onTransferred }: PortfolioHeaderProps) {
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);

  const weighting =
    WEIGHTING_LABELS[portfolio.weighting_method] ?? portfolio.weighting_method;
  const typeClass = portfolio.portfolio_type.toLowerCase();

  const isOwner = portfolio.is_owner === true;
  const isShared = portfolio.is_owner === false;
  // Owner manages every grant + transfer; a co_owner can still open the dialog
  // to invite/remove viewers, so both get the "Compartir" affordance.
  const canManageShares = isOwner || portfolio.permission === 'co_owner';
  // Rebalancing needs write access: owner or co_owner (viewers never see it).
  const canRebalance = isOwner || portfolio.permission === 'co_owner';
  const sharedRoleLabel =
    portfolio.permission === 'co_owner' ? 'Co-propietario' : 'Solo lectura';

  /**
   * US6 (#114): jump to the screener carrying the portfolio's saved creation
   * spec (raw — the screener parses/preloads it) and the target preselected.
   * Portfolios without a spec land on a clean screener.
   */
  function handleRebalanceClick() {
    const state: RebalanceRedirectState = {
      rebalanceRedirect: {
        portfolioId: portfolio.portfolio_id,
        portfolioName: portfolio.name,
        screenerFilters: portfolio.screener_filters,
        weightingMethod: portfolio.weighting_method,
      },
    };
    navigate('/dashboard/screening', { state });
  }

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
    // Never rebalanced → the item is omitted entirely (no dash placeholder).
    ...(portfolio.last_rebalance_date
      ? [
          {
            icon: RefreshCw,
            label: 'Last rebalance',
            value: formatDate(portfolio.last_rebalance_date),
          },
        ]
      : []),
    {
      icon: Calendar,
      label: 'Last updated',
      value: formatDate(portfolio.updated_at),
    },
  ];

  return (
    <>
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

        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {isShared && (
            <span
              className="type-badge"
              title={portfolio.owner_email ?? undefined}
              style={{
                background: 'var(--c-bg-soft)',
                color: 'var(--c-text-soft)',
                border: '1px solid var(--c-border)',
                textTransform: 'none',
                letterSpacing: 'normal',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                maxWidth: 320,
              }}
            >
              <Users size={12} style={{ flexShrink: 0 }} />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                Compartido por {portfolio.owner_email ?? 'el propietario'} ·{' '}
                {sharedRoleLabel}
              </span>
            </span>
          )}
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
          {canRebalance && (
            <button
              type="button"
              className="topbar-btn"
              onClick={handleRebalanceClick}
              title="Open the screener with this portfolio's saved filters preloaded and rebalance it"
              style={{ border: '1px solid var(--c-border)' }}
            >
              <RefreshCw size={14} />
              Rebalance
            </button>
          )}
          {canManageShares && (
            <button
              type="button"
              className="topbar-btn"
              onClick={() => setShareOpen(true)}
              style={{ border: '1px solid var(--c-border)' }}
            >
              <Share2 size={14} />
              Compartir
            </button>
          )}
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
    {canManageShares && (
      <SharePortfolioModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        portfolio={portfolio}
        onTransferred={onTransferred}
      />
    )}
    </>
  );
}
