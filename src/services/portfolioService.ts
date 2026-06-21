import { apiClient } from '@/lib/axios';
import type { ScreenerRequest } from '@/features/screener/types';

export type WeightingMethod = 'equal' | 'rating_weighted' | 'market_cap' | 'manual';

export interface PortfolioResponse {
  portfolio_id: string;
  user_id: string;
  name: string;
  description: string | null;
  portfolio_type: string;
  currency: string;
  initial_cash: number;
  is_default: boolean;
  is_public: boolean;
  weighting_method: WeightingMethod;
  screener_filters: Record<string, unknown> | null;
  last_rebalance_date: string | null;
  analysis_start_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioFromScreenerCreate {
  name: string;
  description?: string | null;
  initial_cash?: number;
  weighting_method?: WeightingMethod;
  screener_filters: ScreenerRequest;
}

export interface PortfolioFromScreenerResponse {
  portfolio: PortfolioResponse;
  positions_count: number;
}

export async function createPortfolioFromScreener(
  payload: PortfolioFromScreenerCreate,
  signal?: AbortSignal,
): Promise<PortfolioFromScreenerResponse> {
  const { data } = await apiClient.post<PortfolioFromScreenerResponse>(
    '/portfolios/from-screener',
    payload,
    { signal },
  );
  return data;
}

export interface PortfolioFromTickersCreate {
  name: string;
  description?: string | null;
  initial_cash?: number;
  weighting_method?: WeightingMethod;
  tickers: string[];
}

export interface PortfolioFromTickersResponse {
  portfolio: PortfolioResponse;
  positions_count: number;
  skipped_tickers: string[];
}

export async function createPortfolioFromTickers(
  payload: PortfolioFromTickersCreate,
  signal?: AbortSignal,
): Promise<PortfolioFromTickersResponse> {
  const { data } = await apiClient.post<PortfolioFromTickersResponse>(
    '/portfolios/from-tickers',
    payload,
    { signal },
  );
  return data;
}

// =============================================================================
// Excel import — server-side parse/verify (preview) then create (confirm)
// =============================================================================

export type ImportRowStatus =
  | 'found'
  | 'normalized'
  | 'not_found'
  | 'duplicate'
  | 'invalid_quantity';

export interface ImportPreviewRow {
  input_ticker: string;
  status: ImportRowStatus;
  resolved_ticker: string | null;
  symbol_id: string | null;
  name: string | null;
  recent_price: number | null;
  quantity: number | null;
}

export interface ImportPreviewResponse {
  rows: ImportPreviewRow[];
  has_quantity_column: boolean;
  found_count: number;
  not_found_count: number;
}

/**
 * Upload an .xlsx/.csv; the backend parses it (first sheet's ticker column +
 * optional `quantity` column), verifies each ticker against the catalog (with a
 * `.`→`-` share-class fallback), and returns a preview. Read-only — nothing is
 * created. Multipart upload: the JSON default Content-Type is cleared so the
 * browser sets the multipart boundary.
 */
export async function previewPortfolioFromExcel(
  file: File,
  signal?: AbortSignal,
): Promise<ImportPreviewResponse> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<ImportPreviewResponse>(
    '/portfolios/import/preview',
    form,
    { signal, timeout: 60000, headers: { 'Content-Type': undefined } },
  );
  return data;
}

export interface ImportPositionInput {
  ticker: string;
  quantity?: number | null;
}

export interface ImportConfirmCreate {
  name: string;
  description?: string | null;
  /** Analyze-from date, `YYYY-MM-DD`. */
  start_date: string;
  positions: ImportPositionInput[];
  /** Weighting mode only (omit in quantities mode). */
  initial_cash?: number | null;
  /** Weighting mode only (omit in quantities mode). */
  weighting_method?: WeightingMethod | null;
}

export type ImportSkipReason =
  | 'unknown_symbol'
  | 'no_price_asof'
  | 'before_coverage'
  | 'too_small_to_size'
  | 'invalid_quantity';

export interface SkippedTicker {
  ticker: string;
  reason: ImportSkipReason;
}

export interface ImportConfirmResponse {
  portfolio: PortfolioResponse;
  positions_count: number;
  /** The effective trading day the portfolio was anchored at. */
  analysis_start_date: string;
  skipped: SkippedTicker[];
}

/**
 * Create a portfolio from the confirmed preview, anchored at `start_date` with
 * as-of prices, and backfill its snapshot series. Two mutually exclusive modes:
 * - quantities: every position has a `quantity`; omit `initial_cash`/`weighting_method`.
 * - weighting: no position has a `quantity`; send `initial_cash` + `weighting_method`.
 */
export async function confirmImportPortfolio(
  payload: ImportConfirmCreate,
  signal?: AbortSignal,
): Promise<ImportConfirmResponse> {
  const { data } = await apiClient.post<ImportConfirmResponse>(
    '/portfolios/import/confirm',
    payload,
    { signal },
  );
  return data;
}

export interface PortfolioList {
  items: PortfolioResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface PortfolioPositionDetail {
  position_id: string;
  symbol_id: string;
  ticker: string;
  name: string;
  sector: string | null;
  country: string | null;
  quantity: number;
  average_cost: number;
  weight_pct: number | null;
  entry_date: string | null;
  entry_rating: number | null;
  current_price: number | null;
  current_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  current_rating: number | null;
  rating_changed: boolean;
}

export interface PortfolioPositionDetailList {
  items: PortfolioPositionDetail[];
  total: number;
  limit: number;
  offset: number;
}

export type PositionSortField =
  | 'weight'
  | 'pnl_pct'
  | 'ticker'
  | 'entry_date'
  | 'current_value';

export type SortOrder = 'asc' | 'desc';

export async function listPortfolios(
  limit = 50,
  offset = 0,
  signal?: AbortSignal,
): Promise<PortfolioList> {
  const { data } = await apiClient.get<PortfolioList>('/portfolios/', {
    params: { limit, offset },
    signal,
  });
  return data;
}

export async function deletePortfolio(
  portfolioId: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiClient.delete(`/portfolios/${portfolioId}`, { signal });
}

/**
 * Export the holdings of the selected portfolios as one `.xlsx` (one sheet per
 * portfolio). POST /portfolios/export. The caller triggers the browser download
 * from the returned blob.
 */
export async function exportPortfolios(
  portfolioIds: string[],
  signal?: AbortSignal,
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiClient.post<Blob>(
    '/portfolios/export',
    { portfolio_ids: portfolioIds },
    { responseType: 'blob', signal },
  );
  return {
    blob: response.data,
    filename: _exportFilename(
      response.headers['content-disposition'] as string | undefined,
    ),
  };
}

function _exportFilename(disposition: string | undefined): string {
  if (!disposition) return 'portfolios.xlsx';
  const quoted = /filename="([^"]+)"/i.exec(disposition);
  if (quoted) return quoted[1];
  const unquoted = /filename=([^;]+)/i.exec(disposition);
  if (unquoted) return unquoted[1].trim();
  return 'portfolios.xlsx';
}

export async function getPortfolio(
  portfolioId: string,
  signal?: AbortSignal,
): Promise<PortfolioResponse> {
  const { data } = await apiClient.get<PortfolioResponse>(
    `/portfolios/${portfolioId}`,
    { signal },
  );
  return data;
}

export async function listPortfolioPositions(
  portfolioId: string,
  params: {
    sort_by?: PositionSortField;
    sort_order?: SortOrder;
    limit?: number;
    offset?: number;
  } = {},
  signal?: AbortSignal,
): Promise<PortfolioPositionDetailList> {
  const { data } = await apiClient.get<PortfolioPositionDetailList>(
    `/portfolios/${portfolioId}/positions`,
    {
      params: {
        sort_by: params.sort_by ?? 'weight',
        sort_order: params.sort_order ?? 'desc',
        limit: params.limit ?? 200,
        offset: params.offset ?? 0,
      },
      signal,
    },
  );
  return data;
}

// =============================================================================
// Performance curve (portfolio vs benchmark, total return)
// =============================================================================

export type CurveBaseMode = 'index_100' | 'initial_cash';

export interface PerformanceCurvePoint {
  date: string;
  portfolio_value: number;
  portfolio_return_pct: number;
  benchmark_value: number | null;
  benchmark_return_pct: number | null;
  relative_return_pct: number | null;
}

export interface PerformanceCurveResponse {
  portfolio_id: string;
  benchmark: string;
  return_basis: string;
  base_mode: CurveBaseMode;
  base: number;
  benchmark_available: boolean;
  start_date: string | null;
  end_date: string | null;
  points: PerformanceCurvePoint[];
}

/**
 * Rebased portfolio-vs-benchmark (total-return) equity curve for charting.
 * Both series start at the same base — 100 (`index_100`, read % directly) or
 * the portfolio's initial cash (`initial_cash`, "growth of the same dollars").
 */
export async function getPerformanceCurve(
  portfolioId: string,
  params: {
    benchmark?: string;
    base_mode?: CurveBaseMode;
    start?: string;
    end?: string;
  } = {},
  signal?: AbortSignal,
): Promise<PerformanceCurveResponse> {
  const { data } = await apiClient.get<PerformanceCurveResponse>(
    `/portfolios/${portfolioId}/performance/curve`,
    {
      params: {
        benchmark: params.benchmark ?? 'SPY',
        base_mode: params.base_mode ?? 'index_100',
        ...(params.start ? { start: params.start } : {}),
        ...(params.end ? { end: params.end } : {}),
      },
      signal,
    },
  );
  return data;
}

// =============================================================================
// Relevant events (rating upgrades/downgrades + price movers across holdings)
// =============================================================================

export type EventPeriod = 'today' | 'week';
export type RelevantEventType = 'all' | 'upgrades' | 'downgrades' | 'movers';

export interface RelevantEvent {
  event_type: 'upgrade' | 'downgrade' | 'mover';
  ticker: string;
  name: string;
  sector: string | null;
  /** Portfolio chosen for this symbol (highest current value). */
  portfolio_id: string;
  portfolio_name: string;
  /** Populated for upgrade/downgrade. */
  previous_rating: number | null;
  current_rating: number | null;
  rating_delta: number | null;
  /** Populated for movers; sign = direction (e.g. -4.8 = down 4.8%). */
  move_pct: number | null;
  /** Rating change date for upgrades/downgrades; latest perf date for movers. */
  as_of: string | null;
  /** How many of the user's portfolios hold this symbol. */
  held_in_portfolios: number;
}

export interface RelevantEventList {
  items: RelevantEvent[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Aggregated "relevant events" across the user's portfolios: rating
 * upgrades/downgrades (window-based) and notable price movers among holdings.
 * Each symbol appears once (deduped to its highest-value portfolio).
 *
 * When `portfolio_id` is provided, events are scoped to the holdings of that
 * single portfolio (which must belong to the authenticated user); when omitted,
 * the feed aggregates across ALL of the user's portfolios.
 */
export async function getRelevantEvents(
  params: {
    period: EventPeriod;
    type: RelevantEventType;
    min_move_pct?: number;
    limit?: number;
    offset?: number;
    portfolio_id?: string;
  },
  signal?: AbortSignal,
): Promise<RelevantEventList> {
  const { data } = await apiClient.get<RelevantEventList>('/portfolios/events', {
    params,
    signal,
  });
  return data;
}

// =============================================================================
// Portfolio summary (aggregate stat cards for the Portfolio Analysis page)
// =============================================================================

export interface EventsCount {
  upgrades: number;
  downgrades: number;
  total: number;
}

export interface PortfolioSummary {
  as_of: string | null;
  currency: string;
  total_aum: number | null;
  todays_pnl_abs: number | null;
  todays_pnl_pct: number | null;
  ytd_pct: number | null;
  ytd_anchor_date: string | null;
  events_24h: EventsCount;
}

/**
 * Aggregate summary metrics across ALL of the user's portfolios, powering the
 * four stat cards at the top of the Portfolio Analysis page: total AUM,
 * AUM-weighted YTD, today's P&L (abs + value-weighted pct), and the 24h rating
 * events count. When the user has no portfolios/snapshots, the numeric fields
 * and `as_of` are null and `events_24h` is all zeros.
 */
export async function getPortfolioSummary(
  signal?: AbortSignal,
): Promise<PortfolioSummary> {
  const { data } = await apiClient.get<PortfolioSummary>('/portfolios/summary', {
    signal,
  });
  return data;
}
