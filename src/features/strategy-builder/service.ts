// API calls for the Strategy Builder (backend Loop 4 endpoints).
import { apiClient } from '@/lib/axios';

import type {
  BacktestStatusResponse,
  BacktestSubmitResponse,
  StrategyCreatedResponse,
  StrategySpec,
} from './types';

export async function createStrategy(
  name: string,
  spec: StrategySpec,
  description?: string,
): Promise<StrategyCreatedResponse> {
  const res = await apiClient.post<StrategyCreatedResponse>('/strategies/', {
    name,
    description,
    spec,
  });
  return res.data;
}

export async function runBacktest(strategyId: string): Promise<BacktestSubmitResponse> {
  const res = await apiClient.post<BacktestSubmitResponse>(
    `/strategies/${strategyId}/backtest`,
  );
  return res.data;
}

export async function getBacktest(jobId: string): Promise<BacktestStatusResponse> {
  const res = await apiClient.get<BacktestStatusResponse>(`/backtests/${jobId}`);
  return res.data;
}

export interface SymbolSearchItem {
  symbol_id: string;
  ticker: string;
  name: string;
  exchange?: string | null;
  sector?: string | null;
}

/** Search symbols for the Exclusion-list picker (public `GET /symbols/search`). */
export async function searchSymbols(q: string, limit = 12): Promise<SymbolSearchItem[]> {
  const res = await apiClient.get<SymbolSearchItem[]>('/symbols/search', {
    params: { q, limit },
  });
  return res.data;
}
