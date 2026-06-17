import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react';
import type { RelevantEvent } from '@/services/portfolioService';
import { useRelevantEvents } from '../hooks/useRelevantEvents';
import { RatingBadge } from './RatingBadge';
import { fmtDate, fmtNumber } from '../lib/format';

const PERIODS = ['Today', 'Week'] as const;
const FILTERS = ['All', 'Upgrades', 'Downgrades', 'Movers'] as const;

type Period = (typeof PERIODS)[number];
type Filter = (typeof FILTERS)[number];

/**
 * RelevantEventsRail
 *
 * Right-side panel shown on the Portfolio Analysis list view. Surfaces rating
 * upgrades/downgrades and notable price movers across the user's portfolios.
 * The Today/Week + filter chips drive the useRelevantEvents hook; each row
 * navigates to the analysis view of the symbol's highest-value portfolio.
 */
export function RelevantEventsRail() {
  const [period, setPeriod] = useState<Period>('Today');
  const [filter, setFilter] = useState<Filter>('All');

  const { events, isLoading, error, refresh } = useRelevantEvents(period, filter);

  return (
    <div className="rail-panel">
      <div className="rail-head">
        <div>
          <div className="rail-title">Relevant Events</div>
          <div className="rail-sub">Upgrades, downgrades and movers</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className={`chip ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="rail-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <RailBody
        events={events}
        isLoading={isLoading}
        error={error}
        onRetry={refresh}
        filter={filter}
      />
    </div>
  );
}

function RailBody({
  events,
  isLoading,
  error,
  onRetry,
  filter,
}: {
  events: RelevantEvent[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  filter: Filter;
}) {
  if (isLoading) {
    return (
      <div>
        {Array.from({ length: 5 }).map((_, i) => (
          <RailSkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rail-error">
        <AlertCircle size={15} />
        <span>{error}</span>
        <button type="button" className="rail-retry" onClick={onRetry}>
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rail-empty">
        No events to display for this period.
        <br />
        Try a different period or filter.
      </div>
    );
  }

  // Movers get grouped into Gainers / Losers sub-sections; rating events render
  // as a flat list. "All" shows rating events first, then the grouped movers.
  const ratingEvents = events.filter(
    (e) => e.event_type === 'upgrade' || e.event_type === 'downgrade',
  );
  const gainers = events.filter(
    (e) => e.event_type === 'mover' && (e.move_pct ?? 0) > 0,
  );
  const losers = events.filter(
    (e) => e.event_type === 'mover' && (e.move_pct ?? 0) < 0,
  );

  const showMoverGroups = filter === 'Movers' || filter === 'All';

  return (
    <div className="rail-list">
      {ratingEvents.length > 0 &&
        ratingEvents.map((e) => (
          <RatingEventRow key={rowKey(e)} event={e} />
        ))}

      {showMoverGroups ? (
        <>
          {gainers.length > 0 && (
            <>
              <div className="rail-section-label">Gainers</div>
              {gainers.map((e) => (
                <MoverEventRow key={rowKey(e)} event={e} />
              ))}
            </>
          )}
          {losers.length > 0 && (
            <>
              <div className="rail-section-label">Losers</div>
              {losers.map((e) => (
                <MoverEventRow key={rowKey(e)} event={e} />
              ))}
            </>
          )}
        </>
      ) : (
        [...gainers, ...losers].map((e) => (
          <MoverEventRow key={rowKey(e)} event={e} />
        ))
      )}
    </div>
  );
}

/** Stable key — a symbol is deduped to one portfolio, so ticker+type is unique. */
function rowKey(e: RelevantEvent): string {
  return `${e.event_type}-${e.ticker}`;
}

function RatingEventRow({ event }: { event: RelevantEvent }) {
  const navigate = useNavigate();
  const delta = event.rating_delta;

  return (
    <button
      type="button"
      className="rail-row"
      onClick={() => navigate(`/dashboard/analysis/${event.portfolio_id}`)}
      title={`${event.ticker} — ${event.portfolio_name}`}
    >
      <div className="rail-row-main">
        <span className="rail-ticker">{event.ticker}</span>
        <span className="rail-name" title={event.name}>
          {event.name}
        </span>
      </div>
      <div className="rail-row-side">
        <span className="rail-ratings">
          <RatingBadge rating={event.previous_rating} />
          <span className="rail-arrow">→</span>
          <RatingBadge rating={event.current_rating} />
          {delta !== null && delta !== 0 && (
            <span
              className={`rail-delta ${delta > 0 ? 'pos' : 'neg'}`}
            >
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
        </span>
        <span className="rail-date dim">{fmtDate(event.as_of)}</span>
      </div>
    </button>
  );
}

function MoverEventRow({ event }: { event: RelevantEvent }) {
  const navigate = useNavigate();
  const move = event.move_pct ?? 0;
  const up = move > 0;

  return (
    <button
      type="button"
      className="rail-row"
      onClick={() => navigate(`/dashboard/analysis/${event.portfolio_id}`)}
      title={`${event.ticker} — ${event.portfolio_name}`}
    >
      <div className="rail-row-main">
        <span className="rail-ticker">{event.ticker}</span>
        <span className="rail-name" title={event.name}>
          {event.name}
        </span>
      </div>
      <div className="rail-row-side">
        <span className={`rail-move ${up ? 'pos' : 'neg'}`}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {up ? '+' : ''}
          {fmtNumber(move, 2)}%
        </span>
        <span className="rail-date dim">{fmtDate(event.as_of)}</span>
      </div>
    </button>
  );
}

function RailSkeletonRow() {
  return (
    <div className="rail-row rail-row-skeleton" aria-hidden>
      <div className="rail-row-main">
        <div className="rail-skel" style={{ width: 48 }} />
        <div className="rail-skel" style={{ width: 120 }} />
      </div>
      <div className="rail-row-side">
        <div className="rail-skel" style={{ width: 64 }} />
        <div className="rail-skel" style={{ width: 56 }} />
      </div>
    </div>
  );
}
