import { apiClient } from '@/lib/axios';
import type { ScreenerRequest } from '@/features/screener/types';

export type WeightingMethod = 'equal' | 'rating_weighted' | 'market_cap';

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
 * Aggregated "relevant events" across ALL of the user's portfolios: rating
 * upgrades/downgrades (window-based) and notable price movers among holdings.
 * Each symbol appears once (deduped to its highest-value portfolio).
 */
export async function getRelevantEvents(
  params: {
    period: EventPeriod;
    type: RelevantEventType;
    min_move_pct?: number;
    limit?: number;
    offset?: number;
  },
  signal?: AbortSignal,
): Promise<RelevantEventList> {
  const { data } = await apiClient.get<RelevantEventList>('/portfolios/events', {
    params,
    signal,
  });
  return data;
}
