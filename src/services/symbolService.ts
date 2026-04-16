import { apiClient } from '@/lib/axios';

export interface SymbolSearchResult {
  symbol_id: string;
  ticker: string;
  name: string;
  exchange: string | null;
  sector: string | null;
}

export interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface PriceHistoryResponse {
  symbol_id: string;
  ticker: string;
  name: string;
  exchange: string | null;
  sector: string | null;
  period: string;
  prices: PricePoint[];
}

export async function searchSymbols(
  query: string,
  limit = 10,
  signal?: AbortSignal,
): Promise<SymbolSearchResult[]> {
  const { data } = await apiClient.get<SymbolSearchResult[]>(
    '/api/v1/symbols/search',
    { params: { q: query, limit }, signal },
  );
  return data;
}

export async function getPriceHistory(
  symbolId: string,
  period = '1y',
  signal?: AbortSignal,
): Promise<PriceHistoryResponse> {
  const { data } = await apiClient.get<PriceHistoryResponse>(
    `/api/v1/symbols/${symbolId}/prices`,
    { params: { period }, signal },
  );
  return data;
}
