/**
 * Screener Types
 *
 * TypeScript definitions for the stock screener feature.
 * Based on API documentation in screener-api.md
 */

// =============================================================================
// Filter Types
// =============================================================================

/**
 * Range filter for numeric values (min and/or max bounds)
 */
export interface RangeFilter {
  min?: number;
  max?: number;
}

/**
 * Possible filter value types
 */
export type FilterValue = RangeFilter | string[] | boolean | null;

/**
 * Filter type categories
 */
export type FilterType = 'range' | 'boolean' | 'multiselect';

/**
 * Filter definition metadata
 */
export interface FilterDefinition {
  /** Unique key for the filter */
  key: string;
  /** Display label in UI */
  label: string;
  /** Category for grouping in menu */
  category: FilterCategory;
  /** Type determines input controls */
  type: FilterType;
  /** API parameter key */
  apiKey: string;
  /** Optional description/help text */
  description?: string;
  /** Unit suffix for display (e.g., '%', 'days') */
  unit?: string;
}

/**
 * Filter categories for the additional filters menu
 */
export type FilterCategory =
  | 'trendrating'
  | 'fundamentals'
  | 'performance'
  | 'others';

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Screener API request body
 * All fields are optional - only include filters to apply
 */
export interface ScreenerRequest {
  // TrendRating filters
  rating?: RangeFilter;
  smart_momentum?: RangeFilter;
  trend_strength?: RangeFilter;
  retracement?: RangeFilter;
  days_since_rating?: RangeFilter;
  new_high?: boolean;
  new_low?: boolean;

  // Fundamentals filters
  pe_ratio?: RangeFilter;
  ps_ratio?: RangeFilter;
  pb_ratio?: RangeFilter;
  pcf_ratio?: RangeFilter;
  pd_ratio?: RangeFilter;
  dividend_yield?: RangeFilter;
  revenue_growth_3m?: RangeFilter;
  revenue_growth_12m?: RangeFilter;
  earnings_growth_3m?: RangeFilter;
  earnings_growth_12m?: RangeFilter;

  // Performance filters
  return_1w?: RangeFilter;
  return_1m?: RangeFilter;
  return_3m?: RangeFilter;
  return_6m?: RangeFilter;
  return_12m?: RangeFilter;
  return_ytd?: RangeFilter;
  sharpe_6m?: RangeFilter;
  sharpe_12m?: RangeFilter;
  liquidity_usd_m?: RangeFilter;

  // Classification filters
  country?: string[];
  exchange?: string[];
  sector?: string[];

  // Pagination & Sorting
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Stock data returned from the screener API
 */
export interface Stock {
  symbol_id: string;
  ticker: string;
  name: string;
  country: string;
  exchange: string;
  sector: string;

  // TrendRating data
  rating: number | null;
  smart_momentum: number | null;
  trend_strength: number | null;
  retracement: number | null;
  new_high_low: 'high' | 'low' | null;
  days_since_rating: number | null;

  // Fundamentals data
  pe_ratio: number | null;
  ps_ratio: number | null;
  pb_ratio: number | null;
  pcf_ratio: number | null;
  pd_ratio: number | null;
  dividend_yield: number | null;
  revenue_growth_3m: number | null;
  revenue_growth_12m: number | null;
  earnings_growth_3m: number | null;
  earnings_growth_12m: number | null;

  // Performance data
  return_1w: number | null;
  return_1m: number | null;
  return_3m: number | null;
  return_6m: number | null;
  return_12m: number | null;
  return_ytd: number | null;
  sharpe_6m: number | null;
  sharpe_12m: number | null;
  liquidity_usd_m: number | null;
}

/**
 * Screener API response
 */
export interface ScreenerResponse {
  results: Stock[];
  total_count: number;
  limit: number;
  offset: number;
}

/**
 * Filter options for dropdowns (from GET /screener/options)
 */
export interface ScreenerOptions {
  countries: string[];
  exchanges: string[];
  sectors: string[];
}

// =============================================================================
// Rating Mapping
// =============================================================================

/**
 * Rating letter to API value mapping
 */
export type RatingLetter = 'A' | 'B' | 'C' | 'D';

/**
 * Rating configuration
 */
export interface RatingConfig {
  letter: RatingLetter;
  value: number;
  color: string;
}

// =============================================================================
// Table Types
// =============================================================================

/**
 * Column definition for the results table
 */
export interface TableColumn {
  key: keyof Stock;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  format?: (value: unknown) => string;
}

/**
 * Sort configuration
 */
export interface SortConfig {
  field: string;
  order: 'asc' | 'desc';
}
