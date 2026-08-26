// Fetches the selection funnel for a completed backtest (#174). Mirrors
// `useResolveSectors`'s shape (data/loading/error, abort on unmount/jobId
// change) but is a plain fetch-once-per-job, not a debounced live resolve —
// the trace is immutable for a given job_id (same access guard + same
// recompute as `GET /backtests/{job_id}`).
import { useEffect, useState } from 'react';

import { getSelectionTrace } from '../service';
import type { SelectionTraceResponse } from '../types';

interface SelectionTraceState {
  data: SelectionTraceResponse | null;
  loading: boolean;
  error: string | null;
}

export function useSelectionTrace(jobId: string | null, enabled: boolean): SelectionTraceState {
  const [state, setState] = useState<SelectionTraceState>({
    data: null,
    loading: enabled && !!jobId,
    error: null,
  });

  useEffect(() => {
    if (!enabled || !jobId) return;
    let cancelled = false;
    // Reset loading/error synchronously when the job id changes — same
    // request-lifecycle pattern as PortfolioOverviewTab/PortfolioPerformanceChart.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ data: null, loading: true, error: null });
    getSelectionTrace(jobId)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: 'Could not load the selection funnel for this run.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, enabled]);

  return state;
}
