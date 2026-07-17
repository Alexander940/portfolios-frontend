// API calls for the Strategy Builder (backend Loop 4 endpoints).
import { apiClient } from '@/lib/axios';

import type {
  AlphaWindow,
  BacktestStatusResponse,
  BacktestSubmitResponse,
  ResolveUniverseResponse,
  StrategyCreatedResponse,
  StrategyListItem,
  StrategySpec,
  TemplateListItem,
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

/** The template catalog for the gallery (`GET /templates/` — issue #57). */
export async function listTemplates(): Promise<TemplateListItem[]> {
  const res = await apiClient.get<TemplateListItem[]>('/templates/');
  return res.data;
}

/** Create a strategy FROM a catalog template, server-side (issue #58): the
 *  canonical spec is loaded from the DB's latest version and the provenance is
 *  stamped — the client never copies the spec, so no filter can be lost. */
export async function createStrategyFromTemplate(
  template: string,
  name: string,
  opts: { description?: string; overrides?: Record<string, unknown>; allowPaused?: boolean } = {},
): Promise<StrategyCreatedResponse> {
  const res = await apiClient.post<StrategyCreatedResponse>('/strategies/', {
    template,
    name,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.overrides ? { overrides: opts.overrides } : {}),
    ...(opts.allowPaused ? { allow_paused: true } : {}),
  });
  return res.data;
}

/** Delete a strategy the caller owns. The backend cascades its versions and all
 *  their backtest jobs/results, so this single call clears everything. 204 on
 *  success; 404 if it is already gone or not owned. */
export async function deleteStrategy(strategyId: string): Promise<void> {
  await apiClient.delete(`/strategies/${strategyId}`);
}

/** Resolve a strategy's investment universe into per-sector Layer-1 base weights
 *  (market-cap share) + a display alpha vs the S&P 500. Feeds the Layer-2 sector
 *  table. `signal` lets the caller cancel a superseded in-flight request. */
export async function resolveUniverse(
  universe: UniverseSpec,
  opts: { alphaWindow?: AlphaWindow; signal?: AbortSignal } = {},
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
