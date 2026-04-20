import { useState } from 'react';

const PERIODS = ['Today', 'Week'] as const;
const FILTERS = ['All', 'Upgrades', 'Downgrades', 'Movers'] as const;

type Period = (typeof PERIODS)[number];
type Filter = (typeof FILTERS)[number];

/**
 * RelevantEventsRail
 *
 * Right-side panel shown on the Portfolio Analysis list view.
 * Surfaces upgrades, downgrades and notable price movers across the user's
 * portfolios. Backend is not yet wired so we render the chrome with an
 * empty state.
 */
export function RelevantEventsRail() {
  const [period, setPeriod] = useState<Period>('Today');
  const [filter, setFilter] = useState<Filter>('All');

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

      <div className="rail-empty">
        No events to display yet.
        <br />
        This panel will populate once the events API is available.
      </div>
    </div>
  );
}
