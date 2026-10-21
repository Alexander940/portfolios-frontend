// API calls for the Strategy Builder (backend Loop 4 endpoints).
import { apiClient } from '@/lib/axios';
import { extractFilename, triggerDownload } from '@/lib/download';

import type {
  AlphaWindow,
  BacktestStatusResponse,
  BacktestSubmitResponse,
  Layer1Spec,
  RebalanceDetailOut,
  RebalancesIndexResponse,
  ResolveUniverseResponse,
  SelectionTraceResponse,
  StrategyCreatedResponse,
  StrategyListItem,
  StrategySpec,
  StrategyUpdatedResponse,
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

/** Update a persisted strategy IN PLACE: rename and/or append a new immutable
 *  spec version to the same strategy row. This is the re-run path for existing
 *  strategies — the old flow re-POSTed `/strategies/` and duplicated the row
 *  (or 409'd once the backend added the duplicate-name guard). */
export async function updateStrategy(
  strategyId: string,
  name: string,
  spec: StrategySpec,
): Promise<StrategyUpdatedResponse> {
  const res = await apiClient.put<StrategyUpdatedResponse>(`/strategies/${strategyId}`, {
    name,
    spec,
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
  opts: { alphaWindow?: AlphaWindow; layer1?: Layer1Spec; signal?: AbortSignal } = {},
): Promise<ResolveUniverseResponse> {
  const res = await apiClient.post<ResolveUniverseResponse>(
    '/strategies/resolve-universe',
    {
      universe,
      alpha_window: opts.alphaWindow ?? '12m',
      // Send the SAME Layer-1 clause the spec will store, or the sector table
      // would preview a base the engine is not going to use. Omitted entirely
      // when absent — the request model is extra="forbid" and rejects `top_n`
      // under `universe_marketcap`, so the clause is rebuilt here rather than
      // forwarded verbatim.
      ...(opts.layer1
        ? {
            layer1:
              opts.layer1.method === 'top_marketcap'
                ? { method: 'top_marketcap', top_n: opts.layer1.top_n }
                : { method: opts.layer1.method },
          }
        : {}),
    },
    { signal: opts.signal },
  );
  return res.data;
}

/** Run (or dedupe to a cached result) the strategy's latest version.
 *  `force` (#278, D2) skips the dedupe and always creates a new job — used to
 *  re-run a result persisted before the per-rebalance table existed. */
export async function runBacktest(
  strategyId: string,
  opts: { force?: boolean } = {},
): Promise<BacktestSubmitResponse> {
  const res = await apiClient.post<BacktestSubmitResponse>(
    `/strategies/${strategyId}/backtest`,
    undefined,
    opts.force ? { params: { force: true } } : undefined,
  );
  return res.data;
}

export async function getBacktest(jobId: string): Promise<BacktestStatusResponse> {
  const res = await apiClient.get<BacktestStatusResponse>(`/backtests/${jobId}`);
  return res.data;
}

/** Selection funnel for the LAST rebalance of a completed backtest (#174):
 *  how many candidates survived Universe → Selection rules → Ranking →
 *  Weighting → Execution, and per-symbol why each one left. Recomputed on
 *  demand server-side (<1s) — not persisted, same access guard as
 *  `GET /backtests/{job_id}`. */
export async function getSelectionTrace(jobId: string): Promise<SelectionTraceResponse> {
  const res = await apiClient.get<SelectionTraceResponse>(`/backtests/${jobId}/selection-trace`);
  return res.data;
}

/** Per-rebalance index + summary cards (#278). 409 = result persisted before
 *  the rebalances table — the caller offers a `force` re-run. */
export async function getRebalances(jobId: string): Promise<RebalancesIndexResponse> {
  const res = await apiClient.get<RebalancesIndexResponse>(`/backtests/${jobId}/rebalances`);
  return res.data;
}

/** One rebalance's detail: books before/after, its fills and the period's
 *  stops (#278, fase 4). 404 for an unknown `seq`, 409 like the index. */
export async function getRebalance(jobId: string, seq: number): Promise<RebalanceDetailOut> {
  const res = await apiClient.get<RebalanceDetailOut>(`/backtests/${jobId}/rebalances/${seq}`);
  return res.data;
}

/** The CSV endpoints are JWT-protected, so a plain `<a href>` would 401: fetch
 *  the blob through the axios client (it carries the token) and hand it to the
 *  browser from memory. */
async function downloadCsv(path: string, fallbackName: string): Promise<void> {
  const res = await apiClient.get<Blob>(path, { responseType: 'blob' });
  const disposition = res.headers?.['content-disposition'] as string | undefined;
  triggerDownload(res.data, extractFilename(disposition, fallbackName));
}

/** `GET /backtests/{job_id}/rebalances.csv` — one row per rebalance. */
export function downloadRebalancesCsv(jobId: string): Promise<void> {
  return downloadCsv(`/backtests/${jobId}/rebalances.csv`, `rebalances-${jobId}.csv`);
}

/** `GET /backtests/{job_id}/trades.csv` — every fill of the run. */
export function downloadTradesCsv(jobId: string): Promise<void> {
  return downloadCsv(`/backtests/${jobId}/trades.csv`, `trades-${jobId}.csv`);
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
