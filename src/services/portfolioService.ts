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
