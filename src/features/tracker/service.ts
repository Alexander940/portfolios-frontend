import { apiClient } from '@/lib/axios';
import type {
  TrackerRebaseRequest,
  TrackerResponse,
  TrackerUpdateRequest,
  WarningsCarrier,
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
 * Holdings fetched here only for `warnings[]` + `data_as_of` (issue #5);
 * issue #7 types and consumes the full payload.
 */
export async function getStrategyHoldings(
  strategyId: string,
  signal?: AbortSignal,
): Promise<WarningsCarrier> {
  const res = await apiClient.get<WarningsCarrier>(
    `/strategies/${strategyId}/holdings`,
    { signal },
  );
  return res.data;
}
