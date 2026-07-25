import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Briefcase,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import type { PortfolioResponse } from '@/services/portfolioService';
import { usePortfolioSelection } from '../store/selection';

interface PortfoliosTableProps {
  portfolios: PortfolioResponse[];
  onDelete?: (portfolioId: string) => Promise<void>;
  onImportClick?: () => void;
}

const WEIGHTING_LABELS: Record<string, string> = {
  equal: 'Equal',
  rating_weighted: 'Rating',
  market_cap: 'Market Cap',
  sector_equal: 'Sector · Equal',
  sector_rating_weighted: 'Sector · Rating',
  sector_inverse_atr_calm: 'Sector · Inv. Volatility',
  sector_market_cap: 'Sector · Market Cap',
};

const stickyHeaderStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 10,
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

export function PortfoliosTable({
  portfolios,
  onDelete,
  onImportClick,
}: PortfoliosTableProps) {
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const selectedIds = usePortfolioSelection((s) => s.selectedIds);
  const toggle = usePortfolioSelection((s) => s.toggle);
  const setMany = usePortfolioSelection((s) => s.setMany);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  // Only owned rows are selectable / deletable; shared rows have no checkbox,
  // so bulk actions can never target a portfolio the user doesn't own.
  const selectableIds = portfolios
    .filter((p) => p.is_owner !== false)
    .map((p) => p.portfolio_id);
  const selectedCount = selectableIds.filter((id) => selectedIds.has(id)).length;
  const allSelected =
    selectableIds.length > 0 && selectedCount === selectableIds.length;
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  async function handleDeleteClick(
    e: React.MouseEvent,
    portfolio: PortfolioResponse,
  ) {
    e.stopPropagation();
    if (!onDelete || deletingId) return;
    const confirmed = window.confirm(
      `Delete portfolio "${portfolio.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeletingId(portfolio.portfolio_id);
    try {
      await onDelete(portfolio.portfolio_id);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : 'Failed to delete portfolio.',
      );
    } finally {
      setDeletingId(null);
    }
  }

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
          Create a portfolio from the Screener or import one from an Excel file.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className="topbar-btn primary"
            onClick={() => navigate('/dashboard/screening')}
          >
            Go to Screener
          </button>
          {onImportClick && (
            <button
              type="button"
              className="topbar-btn"
              onClick={onImportClick}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <FileSpreadsheet size={14} />
              Import from Excel
            </button>
          )}
        </div>
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
        {onImportClick && (
          <button
            type="button"
            className="topbar-btn"
            onClick={onImportClick}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <FileSpreadsheet size={14} />
            Import from Excel
          </button>
        )}
      </div>

      <div style={{ overflow: 'auto', maxHeight: 'max(360px, calc(100vh - 280px))' }}>
        <table
          className="tbl"
          style={{ borderCollapse: 'separate', borderSpacing: 0 }}
        >
          <thead>
            <tr>
              <th style={{ ...stickyHeaderStyle, width: 32 }}>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label="Select all portfolios"
                  checked={allSelected}
                  disabled={selectableIds.length === 0}
                  onChange={() => setMany(selectableIds, !allSelected)}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ ...stickyHeaderStyle, width: 28 }}></th>
              <th style={stickyHeaderStyle}>Name</th>
              <th style={stickyHeaderStyle}>Type</th>
              <th style={stickyHeaderStyle}>Weighting</th>
              <th className="num" style={stickyHeaderStyle}>Initial Capital</th>
              <th style={stickyHeaderStyle}>Created</th>
              <th style={stickyHeaderStyle}>Last Rebalance</th>
              <th style={{ ...stickyHeaderStyle, width: 28 }}></th>
              <th style={{ ...stickyHeaderStyle, width: 28 }}></th>
            </tr>
          </thead>
          <tbody>
            {portfolios.map((p) => {
              const typeClass = p.portfolio_type.toLowerCase();
              const isOwned = p.is_owner !== false;
              return (
                <tr
                  key={p.portfolio_id}
                  className="clickable"
                  onClick={() =>
                    navigate(`/dashboard/analysis/${p.portfolio_id}`)
                  }
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    {isOwned && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${p.name}`}
                        checked={selectedIds.has(p.portfolio_id)}
                        onChange={() => toggle(p.portfolio_id)}
                        style={{ cursor: 'pointer' }}
                      />
                    )}
                  </td>
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
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontWeight: 500,
                        color: 'var(--c-text)',
                      }}
                    >
                      <span>{p.name}</span>
                      <RoleTag portfolio={p} />
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
                    {isOwned && (
                    <button
                      type="button"
                      aria-label={`Delete portfolio ${p.name}`}
                      title="Delete portfolio"
                      onClick={(e) => handleDeleteClick(e, p)}
                      disabled={deletingId === p.portfolio_id}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 4,
                        cursor:
                          deletingId === p.portfolio_id
                            ? 'wait'
                            : 'pointer',
                        color: 'var(--c-text-dim)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: 4,
                      }}
                      onMouseEnter={(e) => {
                        if (deletingId !== p.portfolio_id) {
                          e.currentTarget.style.color = 'var(--c-danger, #d4574e)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--c-text-dim)';
                      }}
                    >
                      {deletingId === p.portfolio_id ? (
                        <Loader2
                          size={14}
                          style={{ animation: 'spin 1s linear infinite' }}
                        />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                    )}
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

/**
 * Small ownership/role marker next to a portfolio name — mirrors the
 * owned-vs-not icon idiom from the screener's SavedScreensBar. Owned rows get a
 * subtle bookmark; shared rows show their role (Co-owner / Viewer).
 */
function RoleTag({ portfolio }: { portfolio: PortfolioResponse }) {
  if (portfolio.is_owner === false) {
    const label = portfolio.permission === 'co_owner' ? 'Co-owner' : 'Viewer';
    return (
      <span
        title={`Shared with you — ${label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '1px 6px',
          borderRadius: 100,
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--c-text-soft)',
          background: 'var(--c-bg-soft)',
          border: '1px solid var(--c-border)',
        }}
      >
        <Users size={10} />
        {label}
      </span>
    );
  }
  return (
    <Bookmark
      size={12}
      color="var(--c-text-dim)"
      aria-label="Owned by you"
    />
  );
}
