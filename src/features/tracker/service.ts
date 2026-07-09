import { apiClient } from '@/lib/axios';
import type {
  HoldingsPreviewResponse,
  TrackerCreateResponse,
  TrackerRebaseRequest,
  TrackerResponse,
  TrackerUpdateRequest,
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
