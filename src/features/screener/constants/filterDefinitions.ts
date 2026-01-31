import type { FilterDefinition, RatingConfig, RatingLetter, TableColumn, Stock } from '../types';

// =============================================================================
// Rating Configuration
// =============================================================================

/**
 * Rating letter to API value mapping
 * A = 3 (best), B = 2, C = 1, D = -1 (worst)
 */
export const RATING_MAP: Record<RatingLetter, number> = {
  A: 3,
  B: 2,
  C: 1,
  D: -1,
} as const;

/**
 * API value to rating letter mapping
 */
export const RATING_DISPLAY: Record<number, RatingLetter> = {
  3: 'A',
  2: 'B',
  1: 'C',
  '-1': 'D',
};

/**
 * Rating configurations with colors
 */
export const RATING_CONFIGS: RatingConfig[] = [
  { letter: 'A', value: 3, color: '#10b981' },   // green
  { letter: 'B', value: 2, color: '#22c55e' },   // light green
  { letter: 'C', value: 1, color: '#f59e0b' },   // yellow/amber
  { letter: 'D', value: -1, color: '#ef4444' },  // red
];

/**
 * Convert selected rating letters to API range filter
 */
export function ratingsToApiFilter(ratings: RatingLetter[]): { min: number; max: number } | null {
  if (ratings.length === 0) return null;

  const values = ratings.map((r) => RATING_MAP[r]);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/**
 * Get rating letter from numeric value
 */
export function getRatingLetter(value: number | null): RatingLetter | null {
  if (value === null) return null;
  return RATING_DISPLAY[value] ?? null;
}

// =============================================================================
// Filter Definitions
// =============================================================================

/**
 * TrendRating filter definitions
 */
export const TRENDRATING_FILTERS: FilterDefinition[] = [
  {
    key: 'smart_momentum',
    label: 'Smart Momentum',
    category: 'trendrating',
    type: 'range',
    apiKey: 'smart_momentum',
    description: 'Momentum indicator score',
  },
  {
    key: 'retracement',
    label: 'Retracement',
    category: 'trendrating',
    type: 'range',
    apiKey: 'retracement',
    unit: '%',
    description: 'Retracement percentage from peak',
  },
  {
    key: 'trend_strength',
    label: 'Trend Strength',
    category: 'trendrating',
    type: 'range',
    apiKey: 'trend_strength',
    description: 'Trend strength (0-100)',
  },
  {
    key: 'new_low',
    label: 'New Low',
    category: 'trendrating',
    type: 'boolean',
    apiKey: 'new_low',
    description: 'Stock at new low',
  },
  {
    key: 'new_high',
    label: 'New High',
    category: 'trendrating',
    type: 'boolean',
    apiKey: 'new_high',
    description: 'Stock at new high',
  },
  {
    key: 'days_since_rating',
    label: 'Days since rating',
    category: 'trendrating',
    type: 'range',
    apiKey: 'days_since_rating',
    unit: 'days',
    description: 'Days since rating was assigned',
  },
];

/**
 * Fundamentals filter definitions
 */
export const FUNDAMENTALS_FILTERS: FilterDefinition[] = [
  {
    key: 'pe_ratio',
    label: 'P/E Ratio',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'pe_ratio',
    description: 'Price to Earnings ratio',
  },
  {
    key: 'ps_ratio',
    label: 'P/S Ratio',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'ps_ratio',
    description: 'Price to Sales ratio',
  },
  {
    key: 'pb_ratio',
    label: 'P/B Ratio',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'pb_ratio',
    description: 'Price to Book ratio',
  },
  {
    key: 'pcf_ratio',
    label: 'P/CF Ratio',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'pcf_ratio',
    description: 'Price to Cash Flow ratio',
  },
  {
    key: 'pd_ratio',
    label: 'P/D Ratio',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'pd_ratio',
    description: 'Price to Dividend ratio',
  },
  {
    key: 'dividend_yield',
    label: 'Dividend Yield',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'dividend_yield',
    unit: '%',
    description: 'Dividend yield percentage',
  },
  {
    key: 'revenue_growth_3m',
    label: '3M Sales Growth',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'revenue_growth_3m',
    unit: '%',
    description: '3-month revenue growth',
  },
  {
    key: 'revenue_growth_12m',
    label: '12M Sales Growth',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'revenue_growth_12m',
    unit: '%',
    description: '12-month revenue growth',
  },
  {
    key: 'earnings_growth_3m',
    label: '3M Earnings Growth',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'earnings_growth_3m',
    unit: '%',
    description: '3-month earnings growth',
  },
  {
    key: 'earnings_growth_12m',
    label: '12M Earnings Growth',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'earnings_growth_12m',
    unit: '%',
    description: '12-month earnings growth',
  },
];

/**
 * Performance filter definitions
 */
export const PERFORMANCE_FILTERS: FilterDefinition[] = [
  {
    key: 'return_1w',
    label: 'Last Week',
    category: 'performance',
    type: 'range',
    apiKey: 'return_1w',
    unit: '%',
    description: 'Last week return',
  },
  {
    key: 'return_1m',
    label: 'Last Month',
    category: 'performance',
    type: 'range',
    apiKey: 'return_1m',
    unit: '%',
    description: 'Last month return',
  },
  {
    key: 'return_3m',
    label: 'Last 3 Months',
    category: 'performance',
    type: 'range',
    apiKey: 'return_3m',
    unit: '%',
    description: 'Last 3 months return',
  },
  {
    key: 'return_6m',
    label: 'Last 6 Months',
    category: 'performance',
    type: 'range',
    apiKey: 'return_6m',
    unit: '%',
    description: 'Last 6 months return',
  },
  {
    key: 'return_12m',
    label: 'Last 12 Months',
    category: 'performance',
    type: 'range',
    apiKey: 'return_12m',
    unit: '%',
    description: 'Last 12 months return',
  },
  {
    key: 'return_ytd',
    label: 'Year to Date',
    category: 'performance',
    type: 'range',
    apiKey: 'return_ytd',
    unit: '%',
    description: 'Year to date return',
  },
  {
    key: 'sharpe_12m',
    label: 'Last 12 Months Risk Adjusted',
    category: 'performance',
    type: 'range',
    apiKey: 'sharpe_12m',
    description: '12-month Sharpe ratio',
  },
  {
    key: 'sharpe_6m',
    label: 'Last 6 Months Risk Adjusted',
    category: 'performance',
    type: 'range',
    apiKey: 'sharpe_6m',
    description: '6-month Sharpe ratio',
  },
];

/**
 * Other filter definitions
 */
export const OTHER_FILTERS: FilterDefinition[] = [
  {
    key: 'country',
    label: 'Domicile',
    category: 'others',
    type: 'multiselect',
    apiKey: 'country',
    description: 'Country of domicile',
  },
  {
    key: 'liquidity_usd_m',
    label: 'Liquidity (USD Millions)',
    category: 'others',
    type: 'range',
    apiKey: 'liquidity_usd_m',
    unit: 'M USD',
    description: 'Liquidity in USD millions',
  },
  {
    key: 'exchange',
    label: 'Market',
    category: 'others',
    type: 'multiselect',
    apiKey: 'exchange',
    description: 'Stock exchange',
  },
  {
    key: 'sector',
    label: 'Sector',
    category: 'others',
    type: 'multiselect',
    apiKey: 'sector',
    description: 'Industry sector',
  },
  {
    key: 'rating',
    label: 'Rating',
    category: 'others',
    type: 'multiselect',
    apiKey: 'rating',
    description: 'Trendrating rating (A, B, C, D)',
  },
];

/**
 * All additional filters grouped by category
 * (excludes primary filters: Market, Sector, Rating)
 */
export const ADDITIONAL_FILTERS: FilterDefinition[] = [
  ...TRENDRATING_FILTERS,
  ...FUNDAMENTALS_FILTERS,
  ...PERFORMANCE_FILTERS,
  // Exclude primary filters from additional filters menu
  ...OTHER_FILTERS.filter((f) => !['exchange', 'sector', 'rating'].includes(f.key)),
];

/**
 * Filter categories with display labels
 */
export const FILTER_CATEGORIES = [
  { key: 'trendrating', label: 'Trendrating' },
  { key: 'fundamentals', label: 'Fundamentals' },
  { key: 'performance', label: 'Performance' },
  { key: 'others', label: 'Others' },
] as const;

/**
 * Get filter definition by key
 */
export function getFilterDefinition(key: string): FilterDefinition | undefined {
  return [
    ...TRENDRATING_FILTERS,
    ...FUNDAMENTALS_FILTERS,
    ...PERFORMANCE_FILTERS,
    ...OTHER_FILTERS,
  ].find((f) => f.key === key);
}

// =============================================================================
// Table Column Definitions
// =============================================================================

/**
 * Format number with specified decimals
 */
function formatNumber(value: unknown, decimals = 2): string {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  return num.toFixed(decimals);
}

/**
 * Format percentage value
 */
function formatPercent(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

/**
 * Format rating as letter
 */
function formatRating(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const letter = getRatingLetter(Number(value));
  return letter ?? '—';
}

/**
 * Format large numbers with abbreviations
 */
function formatLiquidity(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  if (num >= 1000) return `${(num / 1000).toFixed(1)}B`;
  return `${num.toFixed(1)}M`;
}

/**
 * Default table columns for the screener results
 */
export const DEFAULT_TABLE_COLUMNS: TableColumn[] = [
  { key: 'ticker', label: 'Ticker', sortable: true, align: 'left', width: '100px' },
  { key: 'name', label: 'Name', sortable: true, align: 'left', width: '200px' },
  { key: 'exchange', label: 'Market', sortable: true, align: 'left', width: '100px' },
  { key: 'sector', label: 'Sector', sortable: true, align: 'left', width: '120px' },
  { key: 'rating', label: 'Rating', sortable: true, align: 'center', width: '80px', format: formatRating },
  { key: 'return_1m', label: '1M Return', sortable: true, align: 'right', width: '100px', format: formatPercent },
  { key: 'return_3m', label: '3M Return', sortable: true, align: 'right', width: '100px', format: formatPercent },
  { key: 'return_12m', label: '12M Return', sortable: true, align: 'right', width: '100px', format: formatPercent },
  { key: 'pe_ratio', label: 'P/E', sortable: true, align: 'right', width: '80px', format: (v) => formatNumber(v, 1) },
  { key: 'dividend_yield', label: 'Div Yield', sortable: true, align: 'right', width: '90px', format: formatPercent },
  { key: 'liquidity_usd_m', label: 'Liquidity', sortable: true, align: 'right', width: '100px', format: formatLiquidity },
];

/**
 * Get formatted cell value for a stock column
 */
export function formatCellValue(stock: Stock, column: TableColumn): string {
  const value = stock[column.key];
  if (column.format) {
    return column.format(value);
  }
  if (value === null || value === undefined) return '—';
  return String(value);
}

// =============================================================================
// Pagination
// =============================================================================

/**
 * Available page sizes
 */
export const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;

/**
 * Default page size
 */
export const DEFAULT_PAGE_SIZE = 50;
