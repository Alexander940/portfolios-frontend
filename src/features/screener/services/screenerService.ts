import { apiClient } from '@/lib/axios';
import type { ScreenerRequest, ScreenerResponse, ScreenerOptions } from '../types';

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
    // Clean up empty/null filters before sending
    const cleanedFilters = cleanFilters(filters);

    const response = await apiClient.post<ScreenerResponse>(
      '/screener/',
      cleanedFilters,
      { signal }
    );

    return response.data;
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
