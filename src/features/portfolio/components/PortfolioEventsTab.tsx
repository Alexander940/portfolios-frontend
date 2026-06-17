import { useState } from 'react';
import { useRelevantEvents } from '../hooks/useRelevantEvents';
import { RelevantEventsList } from './RelevantEventsList';

const PERIODS = ['Today', 'Week'] as const;
const FILTERS = ['All', 'Upgrades', 'Downgrades', 'Movers'] as const;

type Period = (typeof PERIODS)[number];
type Filter = (typeof FILTERS)[number];

interface PortfolioEventsTabProps {
  portfolioId: string;
}

/**
 * PortfolioEventsTab
 *
 * Relevant-events feed scoped to a single portfolio's holdings (rating
 * upgrades/downgrades + price movers). Same Today/Week + filter chips and row
 * rendering as the RelevantEventsRail (via the shared RelevantEventsList), but
 * full-width inside the detail page rather than a side panel.
 */
export function PortfolioEventsTab({ portfolioId }: PortfolioEventsTabProps) {
  const [period, setPeriod] = useState<Period>('Today');
  const [filter, setFilter] = useState<Filter>('All');

  const { events, isLoading, error, refresh } = useRelevantEvents(
    period,
    filter,
    portfolioId,
  );

  return (
    <div className="detail-sect">
      <div className="detail-sect-head">
        <div className="detail-sect-title">Relevant Events</div>
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

      <div
        className="rail-filters"
        style={{ marginBottom: 8 }}
        role="group"
        aria-label="Event type"
      >
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
