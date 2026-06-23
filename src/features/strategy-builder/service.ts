// API calls for the Strategy Builder (backend Loop 4 endpoints).
import { apiClient } from '@/lib/axios';

import type {
  BacktestStatusResponse,
  BacktestSubmitResponse,
  ResolveUniverseResponse,
  StrategyCreatedResponse,
  StrategyListItem,
  StrategySpec,
  UniverseSpec,
} from './types';

/** The current user's saved strategies (head + latest spec), newest first.
 *  Backs hydrating the builder list with server-persisted strategies — including
 *  ones the AI assistant created (which never touch the local store). */
export async function listStrategies(): Promise<StrategyListItem[]> {
  const res = await apiClient.get<StrategyListItem[]>('/strategies/');
  return res.data;
}

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

/** Resolve a strategy's investment universe into per-sector Layer-1 base weights
 *  (market-cap share) + a display alpha vs the S&P 500. Feeds the Layer-2 sector
 *  table. `signal` lets the caller cancel a superseded in-flight request. */
export async function resolveUniverse(
  universe: UniverseSpec,
  opts: { alphaWindow?: '3m' | '6m' | '12m'; signal?: AbortSignal } = {},
): Promise<ResolveUniverseResponse> {
  const res = await apiClient.post<ResolveUniverseResponse>(
    '/strategies/resolve-universe',
    { universe, alpha_window: opts.alphaWindow ?? '12m' },
    { signal: opts.signal },
  );
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
