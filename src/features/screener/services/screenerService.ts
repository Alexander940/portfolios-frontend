import { apiClient } from '@/lib/axios';
import { PERCENTAGE_FIELDS } from '../constants';
import type {
  RangeFilter,
  ScreenerOptions,
  ScreenerRequest,
  ScreenerResponse,
  Stock,
} from '../types';

const PERCENT_FIELD_SET: ReadonlySet<string> = new Set(PERCENTAGE_FIELDS);

/**
 * Screener API Service
 *
 * Handles all screener-related API calls.
 * Based on screener-api.md documentation.
 *
 * Note: Base URL already includes /api/v1, so endpoints are relative to that.
 *
 * Endpoints:
 * - POST /screener/ - Screen stocks with filters
 * - GET /screener/options - Get dropdown options
 */

export const screenerService = {
  /**
   * Screen stocks based on filter criteria
   *
   * POST /screener/
   * Content-Type: application/json
   *
   * @param filters - Filter parameters (all optional)
   * @param signal - AbortSignal for request cancellation
   * @returns Paginated stock results
   */
  async screenStocks(
    filters: ScreenerRequest,
    signal?: AbortSignal
  ): Promise<ScreenerResponse> {
    // Convert percent → rational for the API, then strip empty filters.
    const cleanedFilters = cleanFilters(toApiPercentFilters(filters));

    const response = await apiClient.post<ScreenerResponse>(
      '/screener/',
      cleanedFilters,
      { signal }
    );

    return fromApiPercentResponse(response.data);
  },

  /**
   * Get available options for dropdown filters
   *
   * GET /screener/options
   *
   * @returns Available countries, exchanges, and sectors
   */
  async getOptions(): Promise<ScreenerOptions> {
    const response = await apiClient.get<ScreenerOptions>('/screener/options');
    return response.data;
  },
};

/**
 * Convert percentage range filters from UI units (2 = 2%) to backend units
 * (0.02). Only fields listed in PERCENTAGE_FIELDS are transformed; everything
 * else is forwarded as-is. Exported so non-screener callers (e.g. the
 * Save-as-Portfolio flow) can reuse the same boundary conversion.
 */
export function toApiPercentFilters(filters: ScreenerRequest): ScreenerRequest {
  const result: ScreenerRequest = { ...filters };
  for (const field of PERCENT_FIELD_SET) {
    const range = (result as Record<string, unknown>)[field];
    if (
      range &&
      typeof range === 'object' &&
      !Array.isArray(range)
    ) {
      const r = range as RangeFilter;
      if (r.min === undefined && r.max === undefined) continue;
      const newRange: RangeFilter = {};
      if (r.min !== undefined) newRange.min = r.min / 100;
      if (r.max !== undefined) newRange.max = r.max / 100;
      (result as Record<string, unknown>)[field] = newRange;
    }
  }
  return result;
}

/**
 * Convert percentage stock fields from backend units (0.02) to UI units (2).
 */
function fromApiPercentResponse(response: ScreenerResponse): ScreenerResponse {
  return {
    ...response,
    results: response.results.map((stock) => {
      const transformed: Stock = { ...stock };
      const indexable = transformed as unknown as Record<string, unknown>;
      for (const field of PERCENT_FIELD_SET) {
        const v = indexable[field];
        if (typeof v === 'number') {
          indexable[field] = v * 100;
        }
      }
      return transformed;
    }),
  };
}

/**
 * Remove empty/null/undefined values from filters object
 */
function cleanFilters(filters: ScreenerRequest): ScreenerRequest {
  const cleaned: ScreenerRequest = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) continue;

    // Skip empty arrays
    if (Array.isArray(value) && value.length === 0) continue;

    // Skip empty range filters
    if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value !== null &&
      'min' in value === false &&
      'max' in value === false
    ) {
      continue;
    }

    // Skip range filters with no values
    if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value !== null
    ) {
      const rangeValue = value as { min?: number; max?: number };
      if (rangeValue.min === undefined && rangeValue.max === undefined) {
        continue;
      }
    }

    (cleaned as Record<string, unknown>)[key] = value;
  }

  return cleaned;
}
