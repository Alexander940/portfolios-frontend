import { Check, Handshake } from 'lucide-react';
import { useScreenerStore } from '../stores';
import { EXCLUDE_PENDING_DEALS_KEY, getFilterDefinition } from '../constants';

/**
 * PendingDealsToggle (#185, épica #175)
 *
 * "Excluir en adquisición" — drops every symbol under a pending acquisition
 * from the screener results. Unlike every other additional filter it is ON by
 * default, so it gets its own always-visible chip in the filter bar instead of
 * living in the "+ Add filter" menu and the removable active-filter chips
 * (where "remove" would be ambiguous with "turn off").
 *
 * The value lives in the same `additionalFilters` map as the rest, so it is
 * saved in presets, restored from a portfolio's spec, and synced to the URL
 * (`?exclude_pending_deals=false` when the user turns it off — the default
 * value is never written, so a plain screener link is unchanged).
 */
export function PendingDealsToggle() {
  const value = useScreenerStore(
    (s) => s.additionalFilters[EXCLUDE_PENDING_DEALS_KEY],
  );
  const setAdditionalFilter = useScreenerStore((s) => s.setAdditionalFilter);

  // Absent (an old saved preset applied before the merge, or a hand-made URL)
  // is read as ON — the default.
  const excluded = value !== false;
  const def = getFilterDefinition(EXCLUDE_PENDING_DEALS_KEY);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={excluded}
      data-testid="exclude-pending-deals-toggle"
      className={`chip ${excluded ? 'active' : ''}`}
      title={def?.description}
      onClick={() =>
        setAdditionalFilter(EXCLUDE_PENDING_DEALS_KEY, !excluded)
      }
      style={{ height: 34 }}
    >
      {excluded ? <Check size={13} /> : <Handshake size={13} />}
      Excluir en adquisición
    </button>
  );
}
