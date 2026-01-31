import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useScreenerStore } from '../stores';
import type { RangeFilter, RatingLetter } from '../types';

type TimeoutId = ReturnType<typeof setTimeout>;

/**
 * Hook for syncing screener state with URL search params
 *
 * Features:
 * - Hydrates store from URL on mount
 * - Updates URL when filter state changes
 * - Debounces URL updates to avoid excessive history entries
 */
export function useScreenerUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isInitializedRef = useRef(false);
  const debounceRef = useRef<TimeoutId | null>(null);

  // Get state from store
  const exchanges = useScreenerStore((state) => state.exchanges);
  const sectors = useScreenerStore((state) => state.sectors);
  const ratings = useScreenerStore((state) => state.ratings);
  const additionalFilters = useScreenerStore((state) => state.additionalFilters);
  const sortBy = useScreenerStore((state) => state.sortBy);
  const sortOrder = useScreenerStore((state) => state.sortOrder);
  const page = useScreenerStore((state) => state.page);
  const pageSize = useScreenerStore((state) => state.pageSize);
  const hydrateFromUrl = useScreenerStore((state) => state.hydrateFromUrl);

  // Hydrate store from URL on mount
  useEffect(() => {
    if (!isInitializedRef.current && searchParams.toString()) {
      hydrateFromUrl(searchParams);
    }
    isInitializedRef.current = true;
  }, [searchParams, hydrateFromUrl]);

  // Sync state to URL with debounce
  useEffect(() => {
    if (!isInitializedRef.current) return;

    // Debounce URL updates
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();

      // Primary filters
      if (exchanges.length > 0) {
        params.set('exchange', exchanges.join(','));
      }
      if (sectors.length > 0) {
        params.set('sector', sectors.join(','));
      }
      if (ratings.length > 0) {
        params.set('rating', ratings.join(','));
      }

      // Sort
      if (sortBy !== 'ticker') {
        params.set('sort', sortBy);
      }
      if (sortOrder !== 'asc') {
        params.set('order', sortOrder);
      }

      // Pagination
      if (page > 1) {
        params.set('page', String(page));
      }
      if (pageSize !== 50) {
        params.set('size', String(pageSize));
      }

      // Additional filters
      for (const [key, value] of Object.entries(additionalFilters)) {
        if (value === null || value === undefined) continue;

        // Boolean filters
        if (typeof value === 'boolean') {
          if (value) {
            params.set(key, 'true');
          }
          continue;
        }

        // Array filters (multiselect)
        if (Array.isArray(value)) {
          if (value.length > 0) {
            params.set(key, value.join(','));
          }
          continue;
        }

        // Range filters
        if (typeof value === 'object' && value !== null) {
          const range = value as RangeFilter;
          const minStr = range.min !== undefined ? String(range.min) : '';
          const maxStr = range.max !== undefined ? String(range.max) : '';
          if (minStr || maxStr) {
            params.set(key, `${minStr}-${maxStr}`);
          }
        }
      }

      // Update URL (replace to avoid excessive history)
      setSearchParams(params, { replace: true });
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
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
    setSearchParams,
  ]);
}

/**
 * Parse rating letters from URL param
 */
export function parseRatingsFromUrl(param: string | null): RatingLetter[] {
  if (!param) return [];
  return param
    .split(',')
    .filter((r): r is RatingLetter => ['A', 'B', 'C', 'D'].includes(r));
}

/**
 * Parse range filter from URL param (format: "min-max")
 */
export function parseRangeFromUrl(param: string | null): RangeFilter | null {
  if (!param) return null;

  const [minStr, maxStr] = param.split('-');
  const filter: RangeFilter = {};

  if (minStr) {
    const min = parseFloat(minStr);
    if (!isNaN(min)) filter.min = min;
  }
  if (maxStr) {
    const max = parseFloat(maxStr);
    if (!isNaN(max)) filter.max = max;
  }

  if (filter.min === undefined && filter.max === undefined) {
    return null;
  }

  return filter;
}
