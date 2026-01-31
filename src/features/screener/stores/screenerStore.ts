import { create } from 'zustand';
import type { RangeFilter, FilterValue, RatingLetter, ScreenerRequest } from '../types';
import { DEFAULT_PAGE_SIZE, ratingsToApiFilter } from '../constants';

/**
 * Filter state for additional filters (non-primary)
 */
export type AdditionalFiltersState = Record<string, FilterValue>;

/**
 * Screener store state
 */
interface ScreenerState {
  // Primary filters (always visible)
  exchanges: string[];
  sectors: string[];
  ratings: RatingLetter[];

  // Additional filters (configurable via modal)
  additionalFilters: AdditionalFiltersState;

  // Sorting
  sortBy: string;
  sortOrder: 'asc' | 'desc';

  // Pagination
  page: number;
  pageSize: number;

  // Modal state
  activeFilterKey: string | null;
}

/**
 * Screener store actions
 */
interface ScreenerActions {
  // Primary filter actions
  setExchanges: (exchanges: string[]) => void;
  setSectors: (sectors: string[]) => void;
  setRatings: (ratings: RatingLetter[]) => void;

  // Additional filter actions
  setAdditionalFilter: (key: string, value: FilterValue) => void;
  removeAdditionalFilter: (key: string) => void;
  clearAllFilters: () => void;

  // Sort actions
  setSort: (field: string, order?: 'asc' | 'desc') => void;
  toggleSort: (field: string) => void;

  // Pagination actions
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Modal actions
  openFilterModal: (filterKey: string) => void;
  closeFilterModal: () => void;

  // Get API request params
  getApiRequest: () => ScreenerRequest;

  // Hydrate state from URL
  hydrateFromUrl: (params: URLSearchParams) => void;
}

/**
 * Initial state
 */
const initialState: ScreenerState = {
  exchanges: [],
  sectors: [],
  ratings: [],
  additionalFilters: {},
  sortBy: 'ticker',
  sortOrder: 'asc',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  activeFilterKey: null,
};

/**
 * Screener Zustand Store
 *
 * Manages all screener filter, sort, and pagination state.
 */
export const useScreenerStore = create<ScreenerState & ScreenerActions>((set, get) => ({
  ...initialState,

  // Primary filter actions
  setExchanges: (exchanges) => set({ exchanges, page: 1 }),
  setSectors: (sectors) => set({ sectors, page: 1 }),
  setRatings: (ratings) => set({ ratings, page: 1 }),

  // Additional filter actions
  setAdditionalFilter: (key, value) =>
    set((state) => ({
      additionalFilters: { ...state.additionalFilters, [key]: value },
      page: 1,
    })),

  removeAdditionalFilter: (key) =>
    set((state) => {
      const { [key]: _, ...rest } = state.additionalFilters;
      return { additionalFilters: rest, page: 1 };
    }),

  clearAllFilters: () =>
    set({
      exchanges: [],
      sectors: [],
      ratings: [],
      additionalFilters: {},
      page: 1,
    }),

  // Sort actions
  setSort: (field, order) =>
    set({
      sortBy: field,
      sortOrder: order ?? 'asc',
      page: 1,
    }),

  toggleSort: (field) =>
    set((state) => ({
      sortBy: field,
      sortOrder:
        state.sortBy === field && state.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    })),

  // Pagination actions
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),

  // Modal actions
  openFilterModal: (filterKey) => set({ activeFilterKey: filterKey }),
  closeFilterModal: () => set({ activeFilterKey: null }),

  // Get API request params
  getApiRequest: () => {
    const state = get();

    const request: ScreenerRequest = {
      sort_by: state.sortBy,
      sort_order: state.sortOrder,
      limit: state.pageSize,
      offset: (state.page - 1) * state.pageSize,
    };

    // Primary filters
    if (state.exchanges.length > 0) {
      request.exchange = state.exchanges;
    }
    if (state.sectors.length > 0) {
      request.sector = state.sectors;
    }
    if (state.ratings.length > 0) {
      const ratingFilter = ratingsToApiFilter(state.ratings);
      if (ratingFilter) {
        request.rating = ratingFilter;
      }
    }

    // Additional filters - merge into request
    for (const [key, value] of Object.entries(state.additionalFilters)) {
      if (value !== null && value !== undefined) {
        // Type-safe assignment for known filter keys
        const typedRequest = request as Record<string, unknown>;
        typedRequest[key] = value;
      }
    }

    return request;
  },

  // Hydrate state from URL
  hydrateFromUrl: (params) => {
    const newState: Partial<ScreenerState> = {};

    // Parse exchanges
    const exchangeParam = params.get('exchange');
    if (exchangeParam) {
      newState.exchanges = exchangeParam.split(',').filter(Boolean);
    }

    // Parse sectors
    const sectorParam = params.get('sector');
    if (sectorParam) {
      newState.sectors = sectorParam.split(',').filter(Boolean);
    }

    // Parse ratings
    const ratingParam = params.get('rating');
    if (ratingParam) {
      newState.ratings = ratingParam
        .split(',')
        .filter((r): r is RatingLetter => ['A', 'B', 'C', 'D'].includes(r));
    }

    // Parse sort
    const sortParam = params.get('sort');
    if (sortParam) {
      newState.sortBy = sortParam;
    }
    const orderParam = params.get('order');
    if (orderParam === 'asc' || orderParam === 'desc') {
      newState.sortOrder = orderParam;
    }

    // Parse pagination
    const pageParam = params.get('page');
    if (pageParam) {
      const page = parseInt(pageParam, 10);
      if (!isNaN(page) && page > 0) {
        newState.page = page;
      }
    }

    const sizeParam = params.get('size');
    if (sizeParam) {
      const size = parseInt(sizeParam, 10);
      if (!isNaN(size) && size > 0) {
        newState.pageSize = size;
      }
    }

    // Parse additional filters (range filters format: key=min-max)
    const additionalFilters: AdditionalFiltersState = {};
    const rangeFilterKeys = [
      'pe_ratio', 'ps_ratio', 'pb_ratio', 'pcf_ratio', 'pd_ratio',
      'dividend_yield', 'revenue_growth_3m', 'revenue_growth_12m',
      'earnings_growth_3m', 'earnings_growth_12m', 'return_1w',
      'return_1m', 'return_3m', 'return_6m', 'return_12m', 'return_ytd',
      'sharpe_6m', 'sharpe_12m', 'liquidity_usd_m', 'smart_momentum',
      'trend_strength', 'retracement', 'days_since_rating',
    ];

    for (const key of rangeFilterKeys) {
      const value = params.get(key);
      if (value) {
        const [minStr, maxStr] = value.split('-');
        const filter: RangeFilter = {};
        if (minStr) {
          const min = parseFloat(minStr);
          if (!isNaN(min)) filter.min = min;
        }
        if (maxStr) {
          const max = parseFloat(maxStr);
          if (!isNaN(max)) filter.max = max;
        }
        if (filter.min !== undefined || filter.max !== undefined) {
          additionalFilters[key] = filter;
        }
      }
    }

    // Boolean filters
    const booleanFilterKeys = ['new_high', 'new_low'];
    for (const key of booleanFilterKeys) {
      const value = params.get(key);
      if (value === 'true') {
        additionalFilters[key] = true;
      }
    }

    // Multiselect filters
    const countryParam = params.get('country');
    if (countryParam) {
      additionalFilters.country = countryParam.split(',').filter(Boolean);
    }

    if (Object.keys(additionalFilters).length > 0) {
      newState.additionalFilters = additionalFilters;
    }

    if (Object.keys(newState).length > 0) {
      set(newState);
    }
  },
}));

/**
 * Get count of active additional filters
 */
export function getActiveFilterCount(state: ScreenerState): number {
  return Object.keys(state.additionalFilters).length;
}
