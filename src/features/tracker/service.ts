import { apiClient } from '@/lib/axios';
import type {
  BacktestJob,
  DriftResponse,
  EventsResponse,
  HoldingsPreviewResponse,
  PositionsResponse,
  TrackerCreateResponse,
  TrackerRebaseRequest,
  TrackerEventType,
  TrackerResponse,
  TrackerUpdateRequest,
  VsBacktestResponse,
} from './types';

export async function getTracker(
  strategyId: string,
  signal?: AbortSignal,
): Promise<TrackerResponse> {
  const res = await apiClient.get<TrackerResponse>(
    `/strategies/${strategyId}/tracker`,
    { signal },
  );
  return res.data;
}

export async function updateTracker(
  strategyId: string,
  body: TrackerUpdateRequest,
): Promise<TrackerResponse> {
  const res = await apiClient.patch<TrackerResponse>(
    `/strategies/${strategyId}/tracker`,
    body,
  );
  return res.data;
}

export async function rebaseTracker(
  strategyId: string,
  body: TrackerRebaseRequest,
): Promise<TrackerResponse> {
  const res = await apiClient.post<TrackerResponse>(
    `/strategies/${strategyId}/tracker/rebase`,
    body,
  );
  return res.data;
}

export async function deleteTracker(
  strategyId: string,
  keepPortfolio: boolean,
): Promise<void> {
  await apiClient.delete(`/strategies/${strategyId}/tracker`, {
    params: { keep_portfolio: keepPortfolio },
  });
}

/**
 * Materialization preview (issue #6); also the source of `warnings[]` +
 * `data_as_of` for the detail banners (issue #5).
 */
export async function getStrategyHoldings(
  strategyId: string,
  signal?: AbortSignal,
): Promise<HoldingsPreviewResponse> {
  const res = await apiClient.get<HoldingsPreviewResponse>(
    `/strategies/${strategyId}/holdings`,
    { signal },
  );
  return res.data;
}

/**
 * Tracker book. With `live` the endpoint re-marks with intraday quotes
 * (`?mark=live`) — read-only, never persisted; the rest of the page stays at
 * the nightly close.
 */
export async function getPositions(
  portfolioId: string,
  live: boolean,
  signal?: AbortSignal,
): Promise<PositionsResponse> {
  const params: Record<string, string | number> = {
    sort_by: 'weight',
    sort_order: 'desc',
    limit: 200,
  };
  if (live) params.mark = 'live';
  const res = await apiClient.get<PositionsResponse>(
    `/portfolios/${portfolioId}/positions`,
    { params, signal },
  );
  return res.data;
}

/** Qué cambiaría si la estrategia rebalanceara hoy. */
export async function getDrift(
  strategyId: string,
  signal?: AbortSignal,
): Promise<DriftResponse> {
  const res = await apiClient.get<DriftResponse>(
    `/strategies/${strategyId}/tracker/drift`,
    { signal },
  );
  return res.data;
}

/** Journal cronológico del tracker; filtro y paginación server-side. */
export async function getEvents(
  strategyId: string,
  opts: { type?: TrackerEventType | null; limit: number; offset: number },
  signal?: AbortSignal,
): Promise<EventsResponse> {
  const params: Record<string, string | number> = {
    limit: opts.limit,
    offset: opts.offset,
  };
  if (opts.type) params.type = opts.type;
  const res = await apiClient.get<EventsResponse>(
    `/strategies/${strategyId}/tracker/events`,
    { params, signal },
  );
  return res.data;
}

export async function getVsBacktest(
  strategyId: string,
  signal?: AbortSignal,
): Promise<VsBacktestResponse> {
  const res = await apiClient.get<VsBacktestResponse>(
    `/strategies/${strategyId}/tracker/vs-backtest`,
    { signal },
  );
  return res.data;
}

export async function runBacktest(strategyId: string): Promise<BacktestJob> {
  const res = await apiClient.post<BacktestJob>(`/strategies/${strategyId}/backtest`);
  return res.data;
}

export async function getBacktestJob(jobId: string): Promise<BacktestJob> {
  const res = await apiClient.get<BacktestJob>(`/backtests/${jobId}`);
  return res.data;
}

export async function createTracker(
  strategyId: string,
  initialCash: number,
): Promise<TrackerCreateResponse> {
  const res = await apiClient.post<TrackerCreateResponse>(
    `/strategies/${strategyId}/tracker`,
    { initial_cash: initialCash },
  );
  return res.data;
}
