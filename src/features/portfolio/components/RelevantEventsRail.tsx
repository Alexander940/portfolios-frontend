import { useState } from 'react';
import { useRelevantEvents } from '../hooks/useRelevantEvents';
import { RelevantEventsList } from './RelevantEventsList';

const PERIODS = ['Today', 'Week'] as const;
const FILTERS = ['All', 'Upgrades', 'Downgrades', 'Movers', 'Deals'] as const;

type Period = (typeof PERIODS)[number];
type Filter = (typeof FILTERS)[number];

/**
 * RelevantEventsRail
 *
 * Right-side panel shown on the Portfolio Analysis list view. Surfaces rating
 * upgrades/downgrades and notable price movers across the user's portfolios.
 * The Today/Week + filter chips drive the useRelevantEvents hook; each row
 * navigates to the analysis view of the symbol's highest-value portfolio.
 *
 * Row rendering lives in the shared RelevantEventsList (also used by the
 * single-portfolio PortfolioEventsTab); the rail keeps its panel chrome.
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

      <RelevantEventsList
        events={events}
        isLoading={isLoading}
        error={error}
        onRetry={refresh}
        filter={filter}
      />
    </div>
  );
}
