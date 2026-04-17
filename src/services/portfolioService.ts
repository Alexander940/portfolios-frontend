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
