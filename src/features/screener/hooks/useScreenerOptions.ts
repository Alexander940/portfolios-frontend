import { useState, useEffect, useCallback } from 'react';
import { screenerService } from '../services';
import type { ScreenerOptions } from '../types';

/**
 * Hook for fetching and caching screener dropdown options
 *
 * Fetches countries, exchanges, and sectors from the API
 * and caches the result for the session.
 */
export function useScreenerOptions() {
  const [options, setOptions] = useState<ScreenerOptions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useCallback(async () => {
    // Don't refetch if we already have options
    if (options) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await screenerService.getOptions();
      setOptions(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load filter options';
      setError(message);
      console.error('Failed to fetch screener options:', err);
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  // Fetch options on mount
  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  // Retry function for error recovery
  const retry = useCallback(() => {
    setOptions(null);
    setError(null);
    fetchOptions();
  }, [fetchOptions]);

  return {
    options,
    isLoading,
    error,
    retry,
  };
}
