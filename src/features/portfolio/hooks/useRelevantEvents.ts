import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getRelevantEvents,
  type EventPeriod,
  type RelevantEvent,
  type RelevantEventType,
} from '@/services/portfolioService';
import { isApiError } from '@/lib/apiErrors';

type PeriodLabel = 'Today' | 'Week';
type FilterLabel = 'All' | 'Upgrades' | 'Downgrades' | 'Movers';

const PERIOD_PARAM: Record<PeriodLabel, EventPeriod> = {
  Today: 'today',
  Week: 'week',
};

const FILTER_PARAM: Record<FilterLabel, RelevantEventType> = {
  All: 'all',
  Upgrades: 'upgrades',
  Downgrades: 'downgrades',
  Movers: 'movers',
};

/**
 * Fetches relevant events (rating upgrades/downgrades + movers) across the
 * user's portfolios for the Relevant Events rail.
 *
 * Mirrors the screener data hook's request lifecycle: cancels the previous
 * request when period/filter change, ignores AbortError, and aborts on unmount.
 * Unlike the screener it takes the UI labels as args (no store, no debounce).
 */
export function useRelevantEvents(period: PeriodLabel, filter: FilterLabel) {
  const [events, setEvents] = useState<RelevantEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getRelevantEvents(
        {
          period: PERIOD_PARAM[period],
          type: FILTER_PARAM[filter],
        },
        controller.signal,
      );
      setEvents(response.items);
    } catch (err) {
      // Don't surface an error if THIS request was aborted (a newer fetch
      // superseded it, or the component unmounted). The signal being aborted
      // is the reliable marker — axios's response interceptor flattens the
      // original AbortError/ERR_CANCELED into a generic ApiError. We still
      // check name/code defensively for non-axios paths.
      if (
        controller.signal.aborted ||
        (err instanceof Error && err.name === 'AbortError') ||
        (typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code?: string }).code === 'ERR_CANCELED')
      ) {
        return;
      }

      const message = isApiError(err) ? err.message : 'Failed to load events';
      setError(message);
      console.error('Failed to fetch relevant events:', err);
    } finally {
      // Only clear loading if this is still the active request; otherwise a
      // superseded request would prematurely stop the newer one's spinner.
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, [period, filter]);

  // Refetch whenever the period or filter changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    events,
    isLoading,
    error,
    refresh,
  };
}
