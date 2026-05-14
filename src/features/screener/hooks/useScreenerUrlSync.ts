import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useScreenerStore } from '../stores';
import type { DateRangeFilter, RangeFilter, RatingValue } from '../types';
import { isValidRating } from '../constants';

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
  const countries = useScreenerStore((state) => state.countries);
  const ratings = useScreenerStore((state) => state.ratings);
  const marketCapCategories = useScreenerStore((state) => state.marketCapCategories);
  const additionalFilters = useScreenerStore((state) => state.additionalFilters);
  const sortBy = useScreenerStore((state) => state.sortBy);
  const sortOrder = useScreenerStore((state) => state.sortOrder);
  const page = useScreenerStore((state) => state.page);
  const pageSize = useScreenerStore((state) => state.pageSize);
  const hydrateFromUrl = useScreenerStore((state) => state.hydrateFromUrl);
  const clearAllFilters = useScreenerStore((state) => state.clearAllFilters);

  // Hydrate store from URL on mount.
  // If the URL has no params, reset to a clean slate so leftover in-memory
  // state from a previous visit doesn't silently re-apply.
  useEffect(() => {
    if (!isInitializedRef.current) {
      if (searchParams.toString()) {
        hydrateFromUrl(searchParams);
      } else {
        clearAllFilters();
      }
      isInitializedRef.current = true;
    }
  }, [searchParams, hydrateFromUrl, clearAllFilters]);

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
      if (countries.length > 0) {
        params.set('country', countries.join(','));
      }
      if (ratings.length > 0) {
        params.set('rating', ratings.join(','));
      }
      if (marketCapCategories.length > 0) {
        params.set('market_cap_category', marketCapCategories.join(','));
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

        // Date range filters (DateRangeFilter has string min/max in ISO format)
        if (
          typeof value === 'object' &&
          value !== null &&
          (typeof (value as DateRangeFilter).min === 'string' ||
            typeof (value as DateRangeFilter).max === 'string')
        ) {
          const range = value as DateRangeFilter;
          const minStr = range.min ?? '';
          const maxStr = range.max ?? '';
          if (minStr || maxStr) {
            params.set(key, `${minStr}~${maxStr}`);
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
    countries,
    ratings,
    marketCapCategories,
    additionalFilters,
    sortBy,
    sortOrder,
    page,
    pageSize,
    setSearchParams,
  ]);
}

/**
 * Parse rating values from URL param (comma-separated signed integers).
 */
export function parseRatingsFromUrl(param: string | null): RatingValue[] {
  if (!param) return [];
  return param
    .split(',')
    .map((s) => parseInt(s, 10))
    .filter((n): n is RatingValue => !isNaN(n) && isValidRating(n));
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
