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

/** One row of GET /strategies/{id}/holdings. */
export interface HoldingPreview {
  symbol_id: string;
  ticker: string;
  name: string;
  sector: string | null;
  rating: number | null;
  score: ApiNumber | null;
  price: ApiNumber;
  weight_pct: ApiNumber;
  shares: number;
  est_value: ApiNumber;
  weight_realized_pct: ApiNumber;
}

/**
 * GET /strategies/{id}/holdings — materialization preview. The backend
 * computes `shares` with a fixed initial_cash of 100000; for a user-chosen
 * capital the client recomputes with the same formula (see issue #6).
 * `coverage_pct`/`cash_pct` arrive as fractions 0-1.
 */
export interface HoldingsPreviewResponse extends WarningsCarrier {
  as_of?: string | null;
  eligible_count?: number;
  coverage_pct?: ApiNumber;
  initial_cash?: ApiNumber;
  cash_pct?: ApiNumber;
  holdings?: HoldingPreview[];
  sector_breakdown?: unknown[];
}

/** POST /strategies/{id}/tracker → 201. */
export interface TrackerCreateResponse extends TrackerResponse {
  positions_count?: number;
}

export function hasEmptyUniverseWarning(
  warnings: string[] | null | undefined,
): boolean {
  return Boolean(warnings?.some((w) => w.toLowerCase().includes('empty')));
}

/** Per-position price provenance in intraday (`?mark=live`) mode. */
export type PriceSource = 'fmp_intraday' | 'nightly_close';

/** One row of GET /portfolios/{portfolio_id}/positions. */
export interface PositionItem {
  symbol_id?: string;
  ticker: string;
  name: string;
  sector: string | null;
  country: string | null;
  quantity: ApiNumber;
  average_cost: ApiNumber;
  weight_pct: ApiNumber;
  entry_date: string;
  entry_rating: number | null;
  current_price: ApiNumber;
  current_value: ApiNumber;
  unrealized_pnl: ApiNumber;
  unrealized_pnl_pct: ApiNumber;
  current_rating: number | null;
  rating_changed: boolean;
  price_source?: PriceSource;
}

export interface PositionsResponse {
  items: PositionItem[];
  total: number;
  limit: number;
  offset: number;
  quoted_at?: string | null;
  warnings?: string[] | null;
}

/** Entra al libro si la estrategia rebalanceara hoy. */
export interface DriftEntry {
  symbol_id: string;
  ticker: string;
  sector: string | null;
  /** Valor del campo `sort_by` de la estrategia — NO un score 0-100. */
  score: ApiNumber | null;
  target_weight_pct: ApiNumber;
}

/** Sale del libro si la estrategia rebalanceara hoy. */
export interface DriftExit {
  symbol_id: string;
  ticker: string;
  shares: ApiNumber;
  current_weight_pct: ApiNumber;
  /** true → "posible deslistada" (sin datos recientes). */
  stale: boolean;
  /** Razón textual — llega con backend#52; antes, copy genérico. */
  reason?: string | null;
}

export interface WeightDriftItem {
  symbol_id: string;
  ticker: string;
  current_weight_pct: ApiNumber;
  target_weight_pct: ApiNumber;
  delta_pct: ApiNumber;
}

/** GET /strategies/{id}/tracker/drift — ya ordenado por |delta|. */
export interface DriftResponse extends WarningsCarrier {
  as_of?: string | null;
  next_rebalance_date?: string | null;
  /** Fracción 0-1. */
  coverage_pct?: ApiNumber;
  total_value?: ApiNumber;
  cash?: ApiNumber;
  entries?: DriftEntry[];
  exits?: DriftExit[];
  weight_drift?: WeightDriftItem[];
  /** Nombre del campo de ordenamiento — llega con backend#52. */
  sort_by?: string;
}

export function hasInertWarning(warnings: string[] | null | undefined): string | null {
  if (!warnings) return null;
  return warnings.find((w) => w.toLowerCase().includes('inert')) ?? null;
}
