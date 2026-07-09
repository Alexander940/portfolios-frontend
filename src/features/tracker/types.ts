/**
 * Strategy Tracker — API contracts.
 *
 * Money/percentage fields are `number | string`: the backend serializes
 * Pydantic Decimals as strings. Fields marked "backend#51" are absent until
 * the enriched TrackerResponse ships; render '—' when missing.
 */

export type TrackerStatus = 'active' | 'paused' | 'error';

/** Decimal-bearing field as the backend may serialize it. */
export type ApiNumber = number | string;

export interface TrackerResponse {
  tracker_id: string;
  strategy_id: string;
  strategy_version_id: string;
  portfolio_id: string;
  status: TrackerStatus;
  initial_cash: ApiNumber;
  started_at: string;
  last_rebalance_date: string | null;
  next_rebalance_date: string | null;
  last_evaluated_date: string | null;
  force_rebalance: boolean;
  notifications_enabled: boolean;
  last_error: string | null;
  created_at: string;
  // backend#51 enrichment (optional until deployed)
  version?: number;
  latest_version?: number;
  total_value?: ApiNumber;
  cash?: ApiNumber;
  pnl_total?: ApiNumber;
  pnl_total_pct?: ApiNumber;
  pnl_day?: ApiNumber;
  pnl_day_pct?: ApiNumber;
  holdings_count?: number;
}

/** PATCH /strategies/{id}/tracker — partial; 422 if empty. */
export interface TrackerUpdateRequest {
  status?: Exclude<TrackerStatus, 'error'>;
  notifications_enabled?: boolean;
}

/** POST /strategies/{id}/tracker/rebase */
export interface TrackerRebaseRequest {
  version: number;
}

/**
 * Minimal shape shared by responses that carry `warnings[]` (inert-clause
 * detection) and `data_as_of` (global freshness badge): holdings and drift.
 * Issue #7/#8 extend these with their full payloads.
 */
export interface WarningsCarrier {
  data_as_of?: string | null;
  warnings?: string[] | null;
}

export function hasInertWarning(warnings: string[] | null | undefined): string | null {
  if (!warnings) return null;
  return warnings.find((w) => w.toLowerCase().includes('inert')) ?? null;
}
