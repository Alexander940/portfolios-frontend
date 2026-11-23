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
  SharedStrategyList,
  StrategyCreatedResponse,
  StrategyDetailResponse,
  StrategyListItem,
  StrategyShare,
  StrategyShareCreate,
  StrategyShareList,
  StrategyShareUpdate,
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

/** One strategy (latest spec) + the caller's effective `permission` and the
 *  owner's email — works for owned AND shared strategies (#344). */
export async function getStrategy(
  strategyId: string,
  signal?: AbortSignal,
): Promise<StrategyDetailResponse> {
  const res = await apiClient.get<StrategyDetailResponse>(`/strategies/${strategyId}`, { signal });
  return res.data;
}

// ---- Sharing (portfolios-backend#345): mirror of the portfolio shares API ----

/** Strategies other users shared WITH the caller (viewer or co_owner). */
export async function listSharedWithMe(
  limit = 50,
  offset = 0,
  signal?: AbortSignal,
): Promise<SharedStrategyList> {
  const res = await apiClient.get<SharedStrategyList>('/strategies/shared-with-me', {
    params: { limit, offset },
    signal,
  });
  return res.data;
}

/** Collaborators on a strategy. Owner/co_owner only (viewer → 403). */
export async function listShares(strategyId: string, signal?: AbortSignal): Promise<StrategyShareList> {
  const res = await apiClient.get<StrategyShareList>(`/strategies/${strategyId}/shares`, { signal });
  return res.data;
}

/** Invite a registered user by email. A co_owner may only grant `viewer`. */
export async function createShare(
  strategyId: string,
  payload: StrategyShareCreate,
): Promise<StrategyShare> {
  const res = await apiClient.post<StrategyShare>(`/strategies/${strategyId}/shares`, payload);
  return res.data;
}

/** Change a collaborator's role. Anything touching co_owner requires the owner. */
export async function updateShare(
  strategyId: string,
  userId: string,
  payload: StrategyShareUpdate,
): Promise<StrategyShare> {
  const res = await apiClient.patch<StrategyShare>(
    `/strategies/${strategyId}/shares/${userId}`,
    payload,
  );
  return res.data;
}

/** Revoke a collaborator's access (204). Removing a co_owner requires the owner. */
export async function deleteShare(strategyId: string, userId: string): Promise<void> {
  await apiClient.delete(`/strategies/${strategyId}/shares/${userId}`);
}

/** Resolve a strategy's investment universe into per-sector Layer-1 base weights
 *  (market-cap share) + a display alpha vs the S&P 500. Feeds the Layer-2 sector
 *  table. `signal` lets the caller cancel a superseded in-flight request. */
/** A 422 from `resolve-universe` (#296). `code === 'basket_not_found'` when
 *  `universe.basket_id` is unknown or not visible to the caller (the body is
 *  `{"detail": {"code": "basket_not_found", "basket_id": "…"}}`); any other
 *  422 (validation) carries `code: null`. Handled here instead of by the global
 *  interceptor because `transformAxiosError` assumes a string `detail`. */
export class ResolveUniverseError extends Error {
  readonly code: string | null;
  readonly basketId: string | null;
  constructor(detail: unknown) {
    const obj =
      detail && typeof detail === 'object' && !Array.isArray(detail)
        ? (detail as Record<string, unknown>)
        : null;
    const code = typeof obj?.code === 'string' ? obj.code : null;
    super(code === 'basket_not_found' ? 'Basket not found' : 'Could not resolve the universe.');
    this.name = 'ResolveUniverseError';
    this.code = code;
    this.basketId = typeof obj?.basket_id === 'string' ? obj.basket_id : null;
  }
}

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
    {
      signal: opts.signal,
      validateStatus: (st) => (st >= 200 && st < 300) || st === 422,
    },
  );
  if (res.status === 422) {
    throw new ResolveUniverseError((res.data as unknown as { detail?: unknown })?.detail);
  }
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
