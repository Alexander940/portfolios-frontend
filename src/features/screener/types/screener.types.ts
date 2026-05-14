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
 * Range filter for date values (inclusive min/max in ISO format `YYYY-MM-DD`).
 */
export interface DateRangeFilter {
  min?: string;
  max?: string;
}

/**
 * Possible filter value types
 */
export type FilterValue =
  | RangeFilter
  | DateRangeFilter
  | string[]
  | boolean
  | null;

/**
 * Filter type categories
 */
export type FilterType = 'range' | 'daterange' | 'boolean' | 'multiselect';

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
  | 'ade'
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
  market_cap?: RangeFilter;
  market_cap_category?: MarketCapCategory[];
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

  // Bull cycle filters (ADE)
  in_bull_cycle?: boolean;
  bull_cycle_started?: boolean;
  bull_cycle_origin_price?: RangeFilter;
  tracking_low?: RangeFilter;
  bull_cycle_origin_date?: DateRangeFilter;

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

  // Smart Momentum (ADE variant)
  sm_ratio: number | null;
  sm_pct: number | null;
  sm_points: number | null;
  sm_peak_ratio: number | null;

  // Bull cycle detection (ADE)
  in_bull_cycle: boolean | null;
  bull_cycle_origin_price: number | null;
  /** ISO date string `YYYY-MM-DD` or null. */
  bull_cycle_origin_date: string | null;
  tracking_low: number | null;
  bull_cycle_started: boolean | null;

  // Fundamentals data
  market_cap: number | null;
  market_cap_category: MarketCapCategory | null;
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
// Market Cap Categories (Company Size)
// =============================================================================

/**
 * Company size buckets derived from market cap (USD).
 * Mirrors the backend `MarketCapCategory` enum.
 *
 * Thresholds: mega > $200B, large $10B–$200B, mid $2B–$10B,
 * small $300M–$2B, micro $50M–$300M, nano < $50M.
 */
export type MarketCapCategory =
  | 'mega'
  | 'large'
  | 'mid'
  | 'small'
  | 'micro'
  | 'nano';

// =============================================================================
// Rating Domain
// =============================================================================

/**
 * MFH_ALEX rating domain: {-3, -2, -1, 1, 2, 3} (no 0).
 */
export type RatingValue = -3 | -2 | -1 | 1 | 2 | 3;

/**
 * Rating configuration
 */
export interface RatingConfig {
  value: RatingValue;
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
