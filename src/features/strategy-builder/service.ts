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
