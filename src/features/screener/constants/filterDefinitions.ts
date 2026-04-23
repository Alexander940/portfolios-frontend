import type { FilterDefinition, RatingConfig, RatingValue, TableColumn, Stock } from '../types';

// =============================================================================
// Rating Configuration
// =============================================================================

/**
 * Valid rating values in the MFH_ALEX domain.
 * +3 = strongest bullish, -3 = strongest bearish. 0 is excluded.
 */
export const RATING_VALUES: RatingValue[] = [3, 2, 1, -1, -2, -3];

/**
 * Rating configurations with colors.
 * Ordered from strongest bullish (+3) to strongest bearish (-3).
 */
export const RATING_CONFIGS: RatingConfig[] = [
  { value: 3,  color: '#059669' }, // emerald-600
  { value: 2,  color: '#10b981' }, // emerald-500
  { value: 1,  color: '#34d399' }, // emerald-400
  { value: -1, color: '#f87171' }, // red-400
  { value: -2, color: '#ef4444' }, // red-500
  { value: -3, color: '#b91c1c' }, // red-700
];

/**
 * Convert selected rating values to API range filter.
 * The backend accepts a {min, max} range; we derive it from the selected set.
 * Non-contiguous selections (e.g. only +3 and -3) will match all ratings in
 * between — a limitation of the current range-based API contract.
 */
export function ratingsToApiFilter(ratings: RatingValue[]): { min: number; max: number } | null {
  if (ratings.length === 0) return null;
  return {
    min: Math.min(...ratings),
    max: Math.max(...ratings),
  };
}

/**
 * Get the color config for a given numeric rating.
 */
export function getRatingConfig(value: number | null | undefined): RatingConfig | null {
  if (value === null || value === undefined) return null;
  return RATING_CONFIGS.find((c) => c.value === value) ?? null;
}

/**
 * Check if a number is a valid rating value.
 */
export function isValidRating(n: number): n is RatingValue {
  return n === -3 || n === -2 || n === -1 || n === 1 || n === 2 || n === 3;
}

/**
 * Format a rating value for display: "+3", "+2", "+1", "-1", "-2", "-3".
 */
export function formatRatingValue(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
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
    description: 'Trend rating (-3 to +3, excluding 0)',
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
  { key: 'trendrating', label: 'Trend' },
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
 * Format rating as signed integer (e.g. "+3", "-2"). Returns "—" for invalid values.
 */
function formatRating(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (isNaN(n) || !isValidRating(n)) return '—';
  return formatRatingValue(n);
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

// =============================================================================
// Table Column Presets
// =============================================================================

export type ColumnPresetId = 'overview' | 'trendrating' | 'performance' | 'fundamentals' | 'all';

export interface ColumnPreset {
  id: ColumnPresetId;
  label: string;
  description: string;
  columns: TableColumn[];
}

const PINNED_COLUMNS: TableColumn[] = [
  { key: 'ticker', label: 'Ticker', sortable: true, align: 'left', width: '110px' },
  { key: 'name', label: 'Name', sortable: true, align: 'left', width: '220px' },
];

const METADATA_COLUMNS: TableColumn[] = [
  { key: 'exchange', label: 'Market', sortable: true, align: 'left', width: '100px' },
  { key: 'sector', label: 'Sector', sortable: true, align: 'left', width: '150px' },
  { key: 'country', label: 'Country', sortable: true, align: 'left', width: '100px' },
];

const TRENDRATING_COLUMNS: TableColumn[] = [
  { key: 'rating', label: 'Rating', sortable: true, align: 'center', width: '90px', format: formatRating },
  { key: 'smart_momentum', label: 'Smart Momentum', sortable: true, align: 'right', width: '140px', format: (v) => formatNumber(v, 2) },
  { key: 'trend_strength', label: 'Trend Strength', sortable: true, align: 'right', width: '130px', format: (v) => formatNumber(v, 2) },
  { key: 'retracement', label: 'Retracement', sortable: true, align: 'right', width: '120px', format: formatPercent },
  { key: 'new_high_low', label: 'New High/Low', sortable: true, align: 'center', width: '120px' },
  { key: 'days_since_rating', label: 'Days in Rating', sortable: true, align: 'right', width: '120px', format: (v) => formatNumber(v, 0) },
];

const PERFORMANCE_COLUMNS: TableColumn[] = [
  { key: 'return_1w', label: '1W', sortable: true, align: 'right', width: '90px', format: formatPercent },
  { key: 'return_1m', label: '1M', sortable: true, align: 'right', width: '90px', format: formatPercent },
  { key: 'return_3m', label: '3M', sortable: true, align: 'right', width: '90px', format: formatPercent },
  { key: 'return_6m', label: '6M', sortable: true, align: 'right', width: '90px', format: formatPercent },
  { key: 'return_12m', label: '12M', sortable: true, align: 'right', width: '90px', format: formatPercent },
  { key: 'return_ytd', label: 'YTD', sortable: true, align: 'right', width: '90px', format: formatPercent },
  { key: 'sharpe_6m', label: 'Sharpe 6M', sortable: true, align: 'right', width: '110px', format: (v) => formatNumber(v, 2) },
  { key: 'sharpe_12m', label: 'Sharpe 12M', sortable: true, align: 'right', width: '110px', format: (v) => formatNumber(v, 2) },
  { key: 'liquidity_usd_m', label: 'Liquidity', sortable: true, align: 'right', width: '110px', format: formatLiquidity },
];

const FUNDAMENTALS_COLUMNS: TableColumn[] = [
  { key: 'pe_ratio', label: 'P/E', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 1) },
  { key: 'ps_ratio', label: 'P/S', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 2) },
  { key: 'pb_ratio', label: 'P/B', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 2) },
  { key: 'pcf_ratio', label: 'P/CF', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 2) },
  { key: 'pd_ratio', label: 'P/D', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 2) },
  { key: 'dividend_yield', label: 'Div Yield', sortable: true, align: 'right', width: '100px', format: formatPercent },
  { key: 'revenue_growth_3m', label: 'Rev. Growth 3M', sortable: true, align: 'right', width: '140px', format: formatPercent },
  { key: 'revenue_growth_12m', label: 'Rev. Growth 12M', sortable: true, align: 'right', width: '150px', format: formatPercent },
  { key: 'earnings_growth_3m', label: 'EPS Growth 3M', sortable: true, align: 'right', width: '140px', format: formatPercent },
  { key: 'earnings_growth_12m', label: 'EPS Growth 12M', sortable: true, align: 'right', width: '150px', format: formatPercent },
];

/**
 * Table column visibility presets.
 *
 * Each preset defines which columns are shown. Ticker + Name are always pinned
 * to the left (handled by ResultsTable via the first two columns).
 */
export const TABLE_COLUMN_PRESETS: ColumnPreset[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Key identifiers + top-line metrics',
    columns: [
      ...PINNED_COLUMNS,
      { key: 'exchange', label: 'Market', sortable: true, align: 'left', width: '100px' },
      { key: 'sector', label: 'Sector', sortable: true, align: 'left', width: '120px' },
      { key: 'rating', label: 'Rating', sortable: true, align: 'center', width: '80px', format: formatRating },
      { key: 'return_1m', label: '1M', sortable: true, align: 'right', width: '90px', format: formatPercent },
      { key: 'return_3m', label: '3M', sortable: true, align: 'right', width: '90px', format: formatPercent },
      { key: 'return_12m', label: '12M', sortable: true, align: 'right', width: '90px', format: formatPercent },
      { key: 'pe_ratio', label: 'P/E', sortable: true, align: 'right', width: '80px', format: (v) => formatNumber(v, 1) },
      { key: 'dividend_yield', label: 'Div Yield', sortable: true, align: 'right', width: '100px', format: formatPercent },
      { key: 'liquidity_usd_m', label: 'Liquidity', sortable: true, align: 'right', width: '110px', format: formatLiquidity },
    ],
  },
  {
    id: 'trendrating',
    label: 'Trend',
    description: 'Rating, momentum, trend strength and retracement',
    columns: [...PINNED_COLUMNS, ...TRENDRATING_COLUMNS],
  },
  {
    id: 'performance',
    label: 'Performance',
    description: 'Multi-horizon returns, Sharpe ratios and liquidity',
    columns: [...PINNED_COLUMNS, ...PERFORMANCE_COLUMNS],
  },
  {
    id: 'fundamentals',
    label: 'Fundamentals',
    description: 'Valuation multiples, growth and dividend',
    columns: [...PINNED_COLUMNS, ...FUNDAMENTALS_COLUMNS],
  },
  {
    id: 'all',
    label: 'All',
    description: 'Every available metric (scroll horizontal)',
    columns: [
      ...PINNED_COLUMNS,
      ...METADATA_COLUMNS,
      ...TRENDRATING_COLUMNS,
      ...PERFORMANCE_COLUMNS,
      ...FUNDAMENTALS_COLUMNS,
    ],
  },
];

export const DEFAULT_COLUMN_PRESET: ColumnPresetId = 'overview';

export function getColumnPreset(id: ColumnPresetId): ColumnPreset {
  return TABLE_COLUMN_PRESETS.find((p) => p.id === id) ?? TABLE_COLUMN_PRESETS[0];
}
