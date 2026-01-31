import { useState, useEffect, useRef, useCallback } from 'react';
import { screenerService } from '../services';
import { useScreenerStore } from '../stores';
import type { Stock, ScreenerResponse } from '../types';

type TimeoutId = ReturnType<typeof setTimeout>;

/**
 * Hook for fetching screener data with debouncing and request cancellation
 *
 * Features:
 * - Debounces filter changes (400ms)
 * - Cancels pending requests on new filter changes
 * - Handles loading and error states
 */
export function useScreenerData() {
  const [data, setData] = useState<Stock[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<TimeoutId | null>(null);

  // Get filter state from store
  const getApiRequest = useScreenerStore((state) => state.getApiRequest);

  // Create a stable reference to the current filter state
  const exchanges = useScreenerStore((state) => state.exchanges);
  const sectors = useScreenerStore((state) => state.sectors);
  const ratings = useScreenerStore((state) => state.ratings);
  const additionalFilters = useScreenerStore((state) => state.additionalFilters);
  const sortBy = useScreenerStore((state) => state.sortBy);
  const sortOrder = useScreenerStore((state) => state.sortOrder);
  const page = useScreenerStore((state) => state.page);
  const pageSize = useScreenerStore((state) => state.pageSize);

  const fetchData = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const request = getApiRequest();
      const response: ScreenerResponse = await screenerService.screenStocks(
        request,
        abortControllerRef.current.signal
      );

      setData(response.results);
      setTotalCount(response.total_count);
    } catch (err) {
      // Don't set error if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
      console.error('Failed to fetch screener data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getApiRequest]);

  // Debounced fetch when filter state changes
  useEffect(() => {
    // Clear any existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new debounce timeout
    debounceTimeoutRef.current = setTimeout(() => {
      fetchData();
    }, 400);

    // Cleanup
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [
    exchanges,
    sectors,
    ratings,
    additionalFilters,
    sortBy,
    sortOrder,
    page,
    pageSize,
    fetchData,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Manual refresh function
  const refresh = useCallback(() => {
    // Clear debounce and fetch immediately
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    fetchData();
  }, [fetchData]);

  return {
    data,
    totalCount,
    isLoading,
    error,
    refresh,
  };
}
