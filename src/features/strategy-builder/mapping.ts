// Constants + mapping between the UI form config and the backend StrategySpec,
// and adaptation of the backend backtest result into the results-view shape.
import type {
  BacktestResultOut,
  BuilderConfig,
  DateRange,
  FilterValueType,
  FundamentalFilter,
  Layer3Method,
  LayeredWeightingSpec,
  MarketCapBucket,
  PerformanceMetric,
  RangeFilter,
  ScreenerFieldKey,
  StrategySpec,
  UniverseSpec,
} from './types';

// Company-size buckets (mirror the backend MarketCapCategory enum + thresholds).
export const MARKET_CAP_BUCKETS: { k: MarketCapBucket; label: string; hint: string }[] = [
  { k: 'mega', label: 'Mega', hint: '> $200B' },
  { k: 'large', label: 'Large', hint: '$10B–$200B' },
  { k: 'mid', label: 'Mid', hint: '$2B–$10B' },
  { k: 'small', label: 'Small', hint: '$300M–$2B' },
  { k: 'micro', label: 'Micro', hint: '$50M–$300M' },
  { k: 'nano', label: 'Nano', hint: '< $50M' },
];

// Catalog of screener fields the user can add as Selection-rules filters,
// grouped by category. `kind: 'pct'` is entered as a percentage and stored as a
// fraction (÷100); `ratio` is stored as-entered; `usd` is an absolute USD amount
// (entered raw, stored as-entered, shown abbreviated like $1.2B). Mirrors the
// backend's PIT_SAFE_QUARTERLY_FIELDS (Fundamentals) + PIT_SAFE_PERF_FIELDS.
export type FilterCategory =
  | 'Fundamentals'
  | 'Performance'
  | 'Trend'
  | 'Smart Momentum'
  | 'Trend Slopes'
  | 'Cycle & Trade'
  | 'Technical Indicators'
  | 'Price & Volume'
  | 'Classification';

/** Which builder section a filter may be added in. 'universe' = Additional rules
 *  (constrain the universe); 'selection' = Selection rules (post-universe phase). */
export type FilterSection = 'universe' | 'selection';

export interface ScreenerFilterDef {
  key: ScreenerFieldKey;
  label: string;
  /** Input/serialization type. Absent → 'range' (the 61 numeric filters). */
  type?: FilterValueType;
  /** Range unit transform: 'pct' enters % and stores ÷100; 'ratio'/'usd' as-entered.
   *  Only meaningful for type 'range'. */
  kind?: 'ratio' | 'pct' | 'usd';
  hint: string;
  category: FilterCategory;
  unit?: string; // shown in the chip/modal (e.g. '%'); margins are also ÷100 (kind 'pct')
  /** For type 'multiselect': which option list (from GET /screener/options) feeds it. */
  optionsKey?: 'sectors' | 'exchanges' | 'countries';
  /** Sections this filter may be added in (default: both). `sector` is selection-only
   *  to avoid colliding with the dedicated universe sector control. */
  sections?: FilterSection[];
  /** For type 'boolean': only a True value is meaningful (the backend gates on
   *  truthiness, so =False is a no-op). The modal renders an on/off, not Yes/No. */
  boolTrueOnly?: boolean;
}

/** Whether a filter is offered in a given section (default: both). */
export function sectionAllows(def: ScreenerFilterDef, section: FilterSection): boolean {
  return (def.sections ?? ['universe', 'selection']).includes(section);
}

export const SCREENER_FILTERS: ScreenerFilterDef[] = [
  // Fundamentals — PIT via fundamentals_quarterly.
  { key: 'pe_ratio', label: 'P/E ratio', kind: 'ratio', hint: 'Price / trailing earnings (TTM, at quarter-end price).', category: 'Fundamentals' },
  { key: 'ps_ratio', label: 'P/S ratio', kind: 'ratio', hint: 'Price / sales.', category: 'Fundamentals' },
  { key: 'pb_ratio', label: 'P/B ratio', kind: 'ratio', hint: 'Price / book value.', category: 'Fundamentals' },
  { key: 'pcf_ratio', label: 'P/CF ratio', kind: 'ratio', hint: 'Price / operating cash flow.', category: 'Fundamentals' },
  { key: 'gross_margin', label: 'Gross margin', kind: 'pct', hint: 'Gross profit / revenue.', category: 'Fundamentals', unit: '%' },
  { key: 'operating_margin', label: 'Operating margin', kind: 'pct', hint: 'Operating income / revenue.', category: 'Fundamentals', unit: '%' },
  // Growth + the remaining ratios — PIT via fundamentals_quarterly. Growth values
  // are fractions (entered as %). pd_ratio / free_cash_flow are per-quarter.
  { key: 'revenue_growth_3m', label: 'Revenue growth 3M', kind: 'pct', hint: 'Sequential QoQ revenue growth (this fiscal quarter vs the prior).', category: 'Fundamentals', unit: '%' },
  { key: 'revenue_growth_12m', label: 'Revenue growth 12M', kind: 'pct', hint: 'Annual revenue growth (fiscal year vs prior fiscal year — not TTM).', category: 'Fundamentals', unit: '%' },
  { key: 'earnings_growth_3m', label: 'Earnings growth 3M', kind: 'pct', hint: 'Sequential QoQ net-income growth.', category: 'Fundamentals', unit: '%' },
  { key: 'earnings_growth_12m', label: 'Earnings growth 12M', kind: 'pct', hint: 'Annual net-income growth (FY vs prior FY).', category: 'Fundamentals', unit: '%' },
  { key: 'eps_minus_rev_growth_3m', label: 'EPS − Rev growth 3M', kind: 'pct', hint: 'Earnings-growth minus revenue-growth gap (3M).', category: 'Fundamentals', unit: '%' },
  { key: 'eps_minus_rev_growth_12m', label: 'EPS − Rev growth 12M', kind: 'pct', hint: 'Earnings-growth minus revenue-growth gap (12M, FY).', category: 'Fundamentals', unit: '%' },
  { key: 'peg_ratio_trailing', label: 'PEG (trailing)', kind: 'ratio', hint: 'Period-end P/E ÷ annual earnings growth. NULL when P/E ≤ 0 or growth ≤ 0.', category: 'Fundamentals' },
  { key: 'pd_ratio', label: 'P/D ratio', kind: 'ratio', hint: 'Price / dividend (= 1 / dividend yield). Caveat: per-quarter, not annualized.', category: 'Fundamentals' },
  { key: 'free_cash_flow', label: 'Free cash flow', kind: 'usd', hint: 'Absolute free cash flow for the fiscal quarter (USD; e.g. 1e9 = $1B). Caveat: per-quarter, not TTM.', category: 'Fundamentals', unit: '$' },
  // Performance — PIT via the backfilled symbol_performance history. Returns are
  // percent (entered as-is, windows in trading days); sharpe is unitless.
  { key: 'return_1w', label: 'Return 1W', kind: 'ratio', hint: '1-week price return, point-in-time.', category: 'Performance', unit: '%' },
  { key: 'return_1m', label: 'Return 1M', kind: 'ratio', hint: '1-month price return, point-in-time.', category: 'Performance', unit: '%' },
  { key: 'return_3m', label: 'Return 3M', kind: 'ratio', hint: '3-month price return, point-in-time.', category: 'Performance', unit: '%' },
  { key: 'return_6m', label: 'Return 6M', kind: 'ratio', hint: '6-month price return, point-in-time.', category: 'Performance', unit: '%' },
  { key: 'return_12m', label: 'Return 12M', kind: 'ratio', hint: '12-month price return, point-in-time.', category: 'Performance', unit: '%' },
  { key: 'return_ytd', label: 'Return YTD', kind: 'ratio', hint: 'Year-to-date price return, point-in-time.', category: 'Performance', unit: '%' },
  { key: 'sharpe_6m', label: 'Sharpe 6M', kind: 'ratio', hint: '6-month annualized Sharpe ratio.', category: 'Performance' },
  { key: 'sharpe_12m', label: 'Sharpe 12M', kind: 'ratio', hint: '12-month annualized Sharpe ratio.', category: 'Performance' },
  // ---- PIT-safe ade / ti / tr / price filters. Values are raw (kind 'ratio', no
  // ÷100) to match the screener + backend exactly; `unit` is display-only. ----
  // Trend / TrendRating (alias tr/ade).
  { key: 'retracement', label: 'Retracement', kind: 'ratio', hint: 'Pullback within the current rating run.', category: 'Trend', unit: '%' },
  { key: 'days_since_rating', label: 'Days since rating', kind: 'ratio', hint: 'Trading days since the current rating started. Filter-only — not available as a ranking sort key.', category: 'Trend', unit: 'days' },
  // Smart Momentum (ADE variant, alias ade). Long side ≥ 0, short side ≤ 0.
  { key: 'sm_long_points', label: 'SM Long Points', kind: 'ratio', hint: 'Smart-Momentum long-side points (≥ 0 once the bull origin activates).', category: 'Smart Momentum' },
  { key: 'sm_short_points', label: 'SM Short Points', kind: 'ratio', hint: 'Smart-Momentum short-side points (≤ 0 once the bear origin activates).', category: 'Smart Momentum' },
  { key: 'sm_long_pct', label: 'SM Long %', kind: 'ratio', hint: 'Smart-Momentum long-side percent.', category: 'Smart Momentum', unit: '%' },
  { key: 'sm_short_pct', label: 'SM Short %', kind: 'ratio', hint: 'Smart-Momentum short-side percent.', category: 'Smart Momentum', unit: '%' },
  { key: 'sm_long_ratio', label: 'SM Long Ratio', kind: 'ratio', hint: 'Volatility-normalized long-side SM (points / ATR_Calm).', category: 'Smart Momentum' },
  { key: 'sm_short_ratio', label: 'SM Short Ratio', kind: 'ratio', hint: 'Volatility-normalized short-side SM.', category: 'Smart Momentum' },
  { key: 'sm_long_peak_ratio', label: 'SM Long Peak', kind: 'ratio', hint: 'Monotonic peak of the long-side SM ratio within the cycle.', category: 'Smart Momentum' },
  { key: 'sm_short_peak_ratio', label: 'SM Short Peak', kind: 'ratio', hint: 'Monotonic trough of the short-side SM ratio within the cycle.', category: 'Smart Momentum' },
  // 90d trend slopes (alias ade). The screener exposes Clenow + TEMA as filters.
  { key: 'slope_clenow_90d', label: 'Slope Clenow (90d)', kind: 'ratio', hint: 'Annualized exp-regression slope × R² over 90 sessions (Clenow momentum).', category: 'Trend Slopes' },
  { key: 'slope_tema_90d', label: 'Slope TEMA (90d)', kind: 'ratio', hint: '% velocity of the 90-session TEMA(20).', category: 'Trend Slopes' },
  // Bull cycle / retracement / trend extremes / FSS / trade machine (alias ade).
  { key: 'bull_cycle_origin_price', label: 'Bull Cycle Origin Price', kind: 'ratio', hint: 'Price where the current bull cycle started.', category: 'Cycle & Trade' },
  { key: 'tracking_low', label: 'Tracking Low', kind: 'ratio', hint: 'Lowest tracked price of the current cycle.', category: 'Cycle & Trade' },
  { key: 'days_in_cycle', label: 'Days in Cycle', kind: 'ratio', hint: 'Bars elapsed since the current cycle started.', category: 'Cycle & Trade', unit: 'bars' },
  { key: 'cycle_retracement_pct', label: 'Cycle Retracement %', kind: 'ratio', hint: 'Retracement from the bull-cycle high (≤ 0).', category: 'Cycle & Trade', unit: '%' },
  { key: 'off_high_52w_pct', label: 'Off 52w High %', kind: 'ratio', hint: 'Distance below the trailing 52-week high (≤ 0).', category: 'Cycle & Trade', unit: '%' },
  { key: 'trend_high', label: 'Trend High', kind: 'ratio', hint: 'Running max close since the cycle started (NULL out of cycle).', category: 'Cycle & Trade' },
  { key: 'trend_low', label: 'Trend Low', kind: 'ratio', hint: 'Running min close since the cycle started (NULL out of cycle).', category: 'Cycle & Trade' },
  { key: 'fss', label: 'FSS', kind: 'ratio', hint: 'Fortaleza Sub-Score ∈ [0,100] — structural Smart-Money memory + current momentum.', category: 'Cycle & Trade' },
  { key: 'trade', label: 'Trade (+2 Long / -2 Short)', kind: 'ratio', hint: 'EL Plot7 trade state: +2 Long, -2 Short, 0 flat.', category: 'Cycle & Trade' },
  { key: 'trade_dir', label: 'Trade Direction', kind: 'ratio', hint: 'Open trade direction (+1 Long, -1 Short, 0 none).', category: 'Cycle & Trade' },
  // Technical indicators (alias ti).
  { key: 'adx', label: 'ADX', kind: 'ratio', hint: 'Average Directional Index (trend strength).', category: 'Technical Indicators' },
  { key: 'adxr', label: 'ADXR', kind: 'ratio', hint: 'ADX Rating (smoothed ADX).', category: 'Technical Indicators' },
  { key: 'mfi_14', label: 'MFI (14)', kind: 'ratio', hint: 'Money Flow Index, 14-period.', category: 'Technical Indicators' },
  { key: 'rvi', label: 'RVI', kind: 'ratio', hint: 'Relative Vigor Index.', category: 'Technical Indicators' },
  { key: 'aroon_oscillator', label: 'Aroon Oscillator', kind: 'ratio', hint: 'Aroon up - Aroon down.', category: 'Technical Indicators' },
  { key: 'atr', label: 'ATR', kind: 'ratio', hint: 'Average True Range (absolute volatility).', category: 'Technical Indicators' },
  { key: 'atr_calm', label: 'ATR Calm', kind: 'ratio', hint: 'Smoothed / normalized ATR (calmness).', category: 'Technical Indicators' },
  { key: 'vmc_z_score', label: 'VMC Z-Score', kind: 'ratio', hint: 'Volume-momentum composite z-score.', category: 'Technical Indicators' },
  { key: 'tema_30', label: 'TEMA (30)', kind: 'ratio', hint: 'Triple EMA, 30-period.', category: 'Technical Indicators' },
  { key: 'maa', label: 'MAA', kind: 'ratio', hint: 'Moving-average adaptive value.', category: 'Technical Indicators' },
  { key: 'kama_er', label: 'KAMA ER', kind: 'ratio', hint: 'Kaufman efficiency ratio.', category: 'Technical Indicators' },
  // Latest market bar (alias price; resolved as-of in a backtest).
  { key: 'open', label: 'Open', kind: 'ratio', hint: 'Latest bar open price.', category: 'Price & Volume', unit: 'USD' },
  { key: 'high', label: 'High', kind: 'ratio', hint: 'Latest bar high price.', category: 'Price & Volume', unit: 'USD' },
  { key: 'low', label: 'Low', kind: 'ratio', hint: 'Latest bar low price.', category: 'Price & Volume', unit: 'USD' },
  { key: 'close', label: 'Close', kind: 'ratio', hint: 'Latest bar close price (useful as a min-price / penny-stock filter).', category: 'Price & Volume', unit: 'USD' },
  { key: 'volume', label: 'Volume', kind: 'ratio', hint: 'Latest bar share volume.', category: 'Price & Volume' },
  // ---- batch 2: boolean / multiselect / daterange (PIT-safe ade & sym aliases) ----
  // Booleans (alias ade). new_high/new_low are TRUE-only toggles (backend gates on
  // truthiness; =False is a no-op). in_trade is excluded — the backtester force-gates
  // the universe to in_trade=True, so a user value would be silently overwritten.
  { key: 'new_high', label: 'At new high', type: 'boolean', boolTrueOnly: true, hint: 'Currently at a new high of the rating run (bullish streak). On/off — leaving it off does not add a filter.', category: 'Trend' },
  { key: 'new_low', label: 'At new low', type: 'boolean', boolTrueOnly: true, hint: 'Currently at a new low of the rating run (bearish streak). On/off. Note: usually empty in a long-only backtest.', category: 'Trend' },
  { key: 'in_bull_cycle', label: 'In bull cycle', type: 'boolean', hint: 'Currently inside an active bull cycle.', category: 'Cycle & Trade' },
  { key: 'bull_cycle_started', label: 'Bull cycle started', type: 'boolean', hint: 'The current bull cycle has started.', category: 'Cycle & Trade' },
  { key: 'bull_origin_active', label: 'Bull origin active', type: 'boolean', hint: 'Bull-origin latch is active.', category: 'Cycle & Trade' },
  { key: 'bear_origin_active', label: 'Bear origin active', type: 'boolean', hint: 'Bear-origin latch is active (can be true during a long).', category: 'Cycle & Trade' },
  { key: 'atr_spike', label: 'ATR spike', type: 'boolean', hint: 'Volatility-expansion (ATR spike) flagged.', category: 'Cycle & Trade' },
  // Date-range (alias ade). NULL out of cycle → implicitly excludes out-of-cycle names.
  { key: 'bull_cycle_origin_date', label: 'Bull cycle origin date', type: 'daterange', hint: 'Date the current bull cycle started (NULL out of cycle, so this excludes out-of-cycle names).', category: 'Cycle & Trade' },
  // Multiselect (alias sym; current-only classification — a documented PIT caveat).
  // `exchange` is clean in both sections; `sector` is Selection-rules-only (the
  // universe already has a dedicated single-sector control). `country` is omitted
  // (universe is locked to US).
  { key: 'exchange', label: 'Exchange', type: 'multiselect', optionsKey: 'exchanges', hint: 'Listing exchange (e.g. NASDAQ, NYSE). Classification is current-only (not point-in-time).', category: 'Classification' },
  { key: 'sector', label: 'Sector', type: 'multiselect', optionsKey: 'sectors', sections: ['selection'], hint: 'GICS / FMP sector. Selection-rules only — the universe already has its own sector control. Current-only classification.', category: 'Classification' },
];

// Ordered category list for the add-selector's <optgroup>s.
export const FILTER_CATEGORIES: FilterCategory[] = [
  'Fundamentals',
  'Performance',
  'Trend',
  'Smart Momentum',
  'Trend Slopes',
  'Cycle & Trade',
  'Technical Indicators',
  'Price & Volume',
  'Classification',
];

/** Human-readable bounds for a Selection-rules chip: "5 – 20 %", "≥ 5", "≤ 20",
 *  or "any" when both bounds are blank. */
export function formatRange(min: number | '', max: number | '', unit?: string): string {
  const u = unit ? ` ${unit}` : '';
  if (min !== '' && max !== '') return `${min}${u} – ${max}${u}`;
  if (min !== '') return `≥ ${min}${u}`;
  if (max !== '') return `≤ ${max}${u}`;
  return 'any';
}

/** Abbreviate an absolute USD amount for a chip: $1.2B, $340.0M, $5.0K, $250. */
export function formatUsd(n: number): string {
  const a = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
  return `${s}$${a}`;
}

/** Chip display for an active filter's bounds: USD-abbreviated for `kind: 'usd'`,
 *  else the plain numeric range with the field's unit. */
export function formatFilterRange(
  min: number | '',
  max: number | '',
  def: ScreenerFilterDef,
): string {
  if (def.kind !== 'usd') return formatRange(min, max, def.unit);
  const f = (v: number | '') => (v === '' ? '' : formatUsd(Number(v)));
  const lo = f(min);
  const hi = f(max);
  if (lo && hi) return `${lo} – ${hi}`;
  if (lo) return `≥ ${lo}`;
  if (hi) return `≤ ${hi}`;
  return 'any';
}

/** Chip display for any active filter, dispatched on the catalog `type`. */
export function formatFilterValue(f: FundamentalFilter, def: ScreenerFilterDef): string {
  const type: FilterValueType = def.type ?? 'range';
  if (type === 'boolean') return f.value ? 'Yes' : 'No';
  if (type === 'multiselect') return f.values && f.values.length ? f.values.join(', ') : 'any';
  if (type === 'daterange') {
    const lo = f.dateMin || '';
    const hi = f.dateMax || '';
    if (lo && hi) return `${lo} – ${hi}`;
    if (lo) return `≥ ${lo}`;
    if (hi) return `≤ ${hi}`;
    return 'any';
  }
  return formatFilterRange(f.min ?? '', f.max ?? '', def);
}

/** Whether an active filter has no effective constraint (→ should be dropped). */
export function isEmptyFilter(f: FundamentalFilter, def: ScreenerFilterDef): boolean {
  const type: FilterValueType = def.type ?? 'range';
  if (type === 'boolean') return typeof f.value !== 'boolean';
  if (type === 'multiselect') return !(f.values && f.values.length);
  if (type === 'daterange') return !f.dateMin && !f.dateMax;
  return (f.min === '' || f.min == null) && (f.max === '' || f.max == null);
}

// Catalog lookup by key — cfgToSpec needs each active filter's `kind`/`type`.
const FIELD_BY_KEY = new Map(SCREENER_FILTERS.map((f) => [f.key, f]));

// Options for the General-parameters "Performance" select (the metric the
// strategy is compared to the benchmark on).
export const PERFORMANCE_METRICS: { k: PerformanceMetric; label: string }[] = [
  { k: 'total_return', label: 'Total return' },
  { k: 'cagr', label: 'CAGR' },
  { k: 'sharpe', label: 'Sharpe' },
  { k: 'sortino', label: 'Sortino' },
  { k: 'calmar', label: 'Calmar' },
  { k: 'alpha', label: 'Alpha' },
  { k: 'max_drawdown', label: 'Max drawdown' },
];

// PIT-safe sortable fields (FIELD_MAPPING keys the backtester accepts as a
// selection.sort_by). The technical fields are point-in-time from ~1990; market_cap
// (symbol_valuation) and alpha (12m CAPM vs SPY, symbol_performance) from 2015.
export const SORT_FIELDS: { k: string; label: string }[] = [
  { k: 'rating', label: 'Rating' },
  { k: 'smart_momentum', label: 'Smart Momentum' },
  { k: 'trend_strength', label: 'Trend Strength' },
  { k: 'retracement', label: 'Retracement' },
  { k: 'sm_long_points', label: 'SM Long Points' },
  { k: 'slope_clenow_90d', label: '90d Momentum (Clenow)' },
  { k: 'fss', label: 'Fortaleza (FSS)' },
  { k: 'adx', label: 'ADX' },
  { k: 'market_cap', label: 'Market Cap' },
  { k: 'alpha', label: 'Alpha (12M vs S&P)' },
];

// Layer-3 intra-sector methods. `market_cap` is point-in-time via symbol_valuation
// (wired in the backtester); locked layers 1 & 2 are rendered separately.
export const LAYER3_OPTIONS: { k: Layer3Method; n: string; d: string }[] = [
  { k: 'equal', n: 'Equal weight', d: 'Each stock in a sector gets the same slice of that sector.' },
  { k: 'rating_weighted', n: 'Rating-weighted', d: 'Higher-rated names get more of their sector (γ sharpens the tilt).' },
  { k: 'inverse_atr_calm', n: 'Inverse volatility', d: 'Calmer (lower-ATR) names get more weight inside the sector.' },
  { k: 'market_cap', n: 'Market-cap weighted', d: 'Bigger names get more of their sector (point-in-time market cap).' },
];

export const SECTORS_LIST = [
  'Technology',
  'Healthcare',
  'Financials',
  'Consumer Discretionary',
  'Consumer Staples',
  'Communication Services',
  'Industrials',
  'Energy',
  'Materials',
  'Real Estate',
  'Utilities',
];

// Rating is numeric −3..+3 in this product (not letter grades).
export const RATING_OPTIONS = [3, 2, 1, 0, -1, -2, -3];

export const DEFAULT_CONFIG: BuilderConfig = {
  name: 'Untitled strategy',
  performanceMetric: 'total_return',
  companySizes: [],
  excluded: [],
  additionalRules: [],
  selectionFilters: [],
  sector: '',
  minRating: 1,
  minTrendStrength: '',
  minMomentum: '',
  minEr: 0.3,
  useTrailStop: true,
  trailAtrMult: 3,
  exitRatingLong: -1,
  sortBy: 'rating',
  sortOrder: 'desc',
  topN: 25,
  perSector: false,
  maxPerSector: 5,
  weight: 'equal',
  layer3Method: 'equal',
  layer3Gamma: '',
  sectorDeltas: {},
  sectorCaps: {},
  maxPositionWeight: '',
  minPositionWeight: '',
  rebalance: 'monthly',
  commission: 5,
  slippage: 8,
  startDate: '2019-01-01',
  endDate: '2024-01-01',
  oosSplit: 20,
  minTrades: 30,
};

/** Merge a (possibly older) saved config onto the current DEFAULT_CONFIG so
 *  fields added after it was saved — e.g. `additionalRules` — are always present.
 *  Strategies persisted before a field existed would otherwise crash the form
 *  or cfgToSpec. Idempotent on fresh configs. */
export function normalizeCfg(cfg: BuilderConfig): BuilderConfig {
  const saved = cfg as Partial<BuilderConfig> & { fundamentals?: FundamentalFilter[] };
  // Legacy migration: the old single `fundamentals` array (which mapped into the
  // universe) becomes `additionalRules` — the same universe-constraining semantics.
  const additionalRules = Array.isArray(saved.additionalRules)
    ? saved.additionalRules
    : Array.isArray(saved.fundamentals)
      ? saved.fundamentals
      : [];
  const selectionFilters = Array.isArray(saved.selectionFilters) ? saved.selectionFilters : [];
  // `sectorDeltas` was added with layered weighting; an older config lacks it.
  const sectorDeltas =
    saved.sectorDeltas && typeof saved.sectorDeltas === 'object' ? saved.sectorDeltas : {};
  // `sectorCaps` was added after per-sector tilts; an older config lacks it.
  const sectorCaps =
    saved.sectorCaps && typeof saved.sectorCaps === 'object' ? saved.sectorCaps : {};
  return { ...DEFAULT_CONFIG, ...cfg, additionalRules, selectionFilters, sectorDeltas, sectorCaps };
}

/** Write each active filter onto a screen object (universe or the selection-phase
 *  screen), dispatched on the catalog `type`: range (% margins stored ÷100),
 *  boolean, multiselect (string[]), or daterange. A filter whose catalog def isn't
 *  allowed in `section` is skipped (a safety net for the sector selection-only rule).
 *  Shared by buildUniverse + buildSelectionFilters so both screens encode identically. */
function addFilters(
  target: UniverseSpec,
  filters: FundamentalFilter[],
  section: FilterSection,
): void {
  const t = target as Record<string, unknown>;
  for (const f of filters) {
    const meta = FIELD_BY_KEY.get(f.key);
    if (!meta || !sectionAllows(meta, section)) continue;
    const type: FilterValueType = meta.type ?? 'range';
    if (type === 'boolean') {
      if (typeof f.value === 'boolean') t[f.key] = f.value;
    } else if (type === 'multiselect') {
      if (f.values && f.values.length) t[f.key] = [...f.values];
    } else if (type === 'daterange') {
      const dr: DateRange = {};
      if (f.dateMin) dr.min = f.dateMin;
      if (f.dateMax) dr.max = f.dateMax;
      if (dr.min !== undefined || dr.max !== undefined) t[f.key] = dr;
    } else {
      const div = meta.kind === 'pct' ? 100 : 1;
      const range: RangeFilter = {};
      if (f.min !== '' && f.min != null) range.min = Number(f.min) / div;
      if (f.max !== '' && f.max != null) range.max = Number(f.max) / div;
      if (range.min !== undefined || range.max !== undefined) t[f.key] = range;
    }
  }
}

/** Build the PIT-safe UniverseSpec from the form config. Exported so the Layer-2
 *  sector table resolves the SAME universe the backtest will run on. Includes the
 *  "Additional rules" (which constrain the universe) but NOT the post-universe
 *  "Selection rules". */
export function buildUniverse(cfg: BuilderConfig): UniverseSpec {
  const universe: UniverseSpec = { rating: { min: cfg.minRating }, country: ['US'] };
  if (cfg.sector) universe.sector = [cfg.sector];
  if (cfg.minTrendStrength !== '') {
    universe.trend_strength = { min: Number(cfg.minTrendStrength) };
  }
  if (cfg.minMomentum !== '') {
    universe.smart_momentum = { min: Number(cfg.minMomentum) };
  }
  if (cfg.companySizes.length) universe.market_cap_category = cfg.companySizes;
  if (cfg.excluded.length) universe.exclude = cfg.excluded.map((e) => e.symbolId);
  addFilters(universe, cfg.additionalRules, 'universe');
  return universe;
}

/** Build the post-universe selection-phase screen from the "Selection rules", or
 *  `undefined` when there are none — omitting it keeps the backend content_hash of
 *  a spec without selection filters byte-identical (the backend pops a null
 *  `selection_filters` from canonical_json, exactly like `layered`). */
export function buildSelectionFilters(cfg: BuilderConfig): UniverseSpec | undefined {
  const screen: UniverseSpec = {};
  addFilters(screen, cfg.selectionFilters, 'selection');
  return Object.keys(screen).length > 0 ? screen : undefined;
}

/** Build the layered-weighting clause from the form, or `undefined` for a plain
 *  equal strategy (layer3 == equal, no tilts, no gamma). Omitting it keeps the
 *  backend content_hash of a pre-layered spec byte-identical (the backend pops a
 *  null `layered` from canonical_json). */
export function buildLayered(cfg: BuilderConfig): LayeredWeightingSpec | undefined {
  const deltas: Record<string, number> = {};
  for (const [sector, pct] of Object.entries(cfg.sectorDeltas ?? {})) {
    if (pct) deltas[sector] = pct / 100; // % (UI) → relative fraction (spec)
  }
  const caps: Record<string, number> = {};
  for (const [sector, pct] of Object.entries(cfg.sectorCaps ?? {})) {
    if (pct) caps[sector] = pct / 100; // % (UI) → fraction (spec); 30 → 0.3
  }
  const hasTilt = Object.keys(deltas).length > 0;
  const hasCap = Object.keys(caps).length > 0;
  const hasGamma = cfg.layer3Method === 'rating_weighted' && cfg.layer3Gamma !== '';
  if (cfg.layer3Method === 'equal' && !hasTilt && !hasGamma && !hasCap) return undefined;
  return {
    layer1: { method: 'universe_marketcap' },
    // `sector_caps` omitted when empty so it isn't serialized (the backend pops it
    // from canonical_json anyway; keeping them consistent avoids a spurious hash).
    layer2: { method: 'user_increment', deltas, ...(hasCap ? { sector_caps: caps } : {}) },
    layer3: {
      method: cfg.layer3Method,
      ...(hasGamma ? { gamma: Number(cfg.layer3Gamma) } : {}),
    },
  };
}

export function cfgToSpec(cfg: BuilderConfig): StrategySpec {
  const universe = buildUniverse(cfg);
  const layered = buildLayered(cfg);
  const selectionFilters = buildSelectionFilters(cfg);
  // Per-name cap: % (UI) → fraction (spec). Omitted when empty/≤0 so an uncapped
  // strategy keeps the legacy content_hash (the backend pops a null value).
  const maxPos =
    cfg.maxPositionWeight !== '' && cfg.maxPositionWeight > 0 ? cfg.maxPositionWeight / 100 : null;
  // Per-name floor: % (UI) → fraction (spec). Omitted when empty/≤0 so a
  // floor-less strategy keeps the legacy content_hash.
  const minPos =
    cfg.minPositionWeight !== '' && cfg.minPositionWeight > 0 ? cfg.minPositionWeight / 100 : null;

  return {
    general: {
      instrument_type: 'stocks',
      currency: 'USD',
      benchmark: 'SPY',
      performance_metric: cfg.performanceMetric,
    },
    universe,
    entry_exit: {
      mode: 'trade_state',
      min_er: cfg.minEr,
      max_sm_atr_mult: 10,
      atr_spike_mult: 2,
      trail_atr_mult: cfg.trailAtrMult,
      emergency_atr_mult: 4,
      exit_rating_long: cfg.exitRatingLong,
      exit_rating_short: 1,
      use_trail_stop: cfg.useTrailStop,
    },
    selection: {
      sort_by: cfg.sortBy,
      sort_order: cfg.sortOrder,
      top_n: cfg.topN,
      per_sector: cfg.perSector ? cfg.maxPerSector : null,
    },
    // The layered pipeline is the weighting model now; `weighting` stays at the
    // vestigial default (the backtester reads `layered` when present). Omitted
    // `layered` (plain equal) keeps the legacy equal-spec content_hash intact.
    weighting: { method: 'equal' },
    ...(layered ? { layered } : {}),
    // Omitted when uncapped so an uncapped strategy keeps the legacy content_hash.
    ...(maxPos != null ? { max_position_weight: maxPos } : {}),
    ...(minPos != null ? { min_position_weight: minPos } : {}),
    // Omitted when empty so a strategy without selection filters keeps the legacy
    // content_hash (the backend pops a null `selection_filters` from canonical_json).
    ...(selectionFilters ? { selection_filters: selectionFilters } : {}),
    rebalance: { cadence: cfg.rebalance },
    costs: { commission_bps: cfg.commission, slippage_bps: cfg.slippage },
    validation: {
      start: cfg.startDate,
      end: cfg.endDate,
      oos_split: cfg.oosSplit / 100,
      min_n_trades: cfg.minTrades,
    },
  };
}

/** Reverse of addFilters: pull the active filters out of a screen (universe or
 *  selection_filters) back into the form's FundamentalFilter[], dispatched on the
 *  catalog `type` (% range margins re-multiplied ×100; bool/multiselect/daterange
 *  reconstructed as-is — NOT coerced through the numeric range path, which would
 *  NaN a date string and drop bool/list values). `section` skips catalog fields not
 *  offered there (so a universe screen never reconstructs the selection-only
 *  `sector` into Additional rules, where the dedicated control owns it). */
function screenToFilters(
  fields: Record<string, unknown>,
  section: FilterSection,
): FundamentalFilter[] {
  const out: FundamentalFilter[] = [];
  for (const def of SCREENER_FILTERS) {
    if (!sectionAllows(def, section)) continue;
    const raw = fields[def.key];
    if (raw == null) continue;
    const type: FilterValueType = def.type ?? 'range';
    if (type === 'boolean') {
      if (typeof raw === 'boolean') out.push({ key: def.key, type, value: raw });
    } else if (type === 'multiselect') {
      if (Array.isArray(raw) && raw.length) {
        out.push({ key: def.key, type, values: raw as string[] });
      }
    } else if (type === 'daterange') {
      const dr = raw as DateRange;
      if (dr && (dr.min || dr.max)) {
        out.push({ key: def.key, type, dateMin: dr.min ?? '', dateMax: dr.max ?? '' });
      }
    } else {
      const rf = raw as RangeFilter;
      const mul = def.kind === 'pct' ? 100 : 1;
      const min = rf.min != null ? rf.min * mul : '';
      const max = rf.max != null ? rf.max * mul : '';
      if (min !== '' || max !== '') out.push({ key: def.key, type, min, max });
    }
  }
  return out;
}

/** Reverse of cfgToSpec: rebuild a BuilderConfig from a backend StrategySpec so
 *  a server-persisted strategy (e.g. one the AI assistant created) can be shown
 *  and opened in the builder. Best-effort — universe filters the builder form
 *  doesn't expose (dividend_yield, volatility_252d, the Capa-3 gaps, …) are NOT
 *  carried into the form and would be dropped on a re-save. Robust to the
 *  serialized spec's explicit `null`s; falls back to DEFAULT_CONFIG. */
export function specToConfig(spec: StrategySpec, name: string): BuilderConfig {
  const u = spec.universe ?? ({} as UniverseSpec);
  const ufields = u as Record<string, unknown>;
  const ee = spec.entry_exit;
  const sel = spec.selection;
  const val = spec.validation;

  // Universe fundamentals → "Additional rules" (where they have always lived): a
  // server/legacy strategy's universe filters constrain the universe, so they
  // surface in the universe section, not the post-universe selection phase.
  const additionalRules = screenToFilters(ufields, 'universe');
  // spec.selection_filters → "Selection rules" (the post-universe phase).
  const sf = (spec.selection_filters ?? {}) as Record<string, unknown>;
  const selectionFilters = screenToFilters(sf, 'selection');

  return {
    ...DEFAULT_CONFIG,
    name,
    performanceMetric: spec.general?.performance_metric ?? DEFAULT_CONFIG.performanceMetric,
    companySizes: (u.market_cap_category ?? []) as MarketCapBucket[],
    excluded: (u.exclude ?? []).map((id) => ({ symbolId: id, ticker: '', name: '' })),
    additionalRules,
    selectionFilters,
    sector: u.sector?.[0] ?? '',
    minRating: u.rating?.min ?? DEFAULT_CONFIG.minRating,
    minTrendStrength: u.trend_strength?.min ?? '',
    minMomentum: u.smart_momentum?.min ?? '',
    minEr: ee?.min_er ?? DEFAULT_CONFIG.minEr,
    useTrailStop: ee?.use_trail_stop ?? DEFAULT_CONFIG.useTrailStop,
    trailAtrMult: ee?.trail_atr_mult ?? DEFAULT_CONFIG.trailAtrMult,
    exitRatingLong: ee?.exit_rating_long ?? DEFAULT_CONFIG.exitRatingLong,
    sortBy: sel?.sort_by ?? DEFAULT_CONFIG.sortBy,
    sortOrder: sel?.sort_order ?? DEFAULT_CONFIG.sortOrder,
    topN: sel?.top_n ?? DEFAULT_CONFIG.topN,
    perSector: sel?.per_sector != null,
    maxPerSector: sel?.per_sector ?? DEFAULT_CONFIG.maxPerSector,
    weight: spec.weighting?.method ?? DEFAULT_CONFIG.weight,
    // Layered weighting: prefer the spec's `layered` clause; otherwise map the
    // legacy single-stage `weighting.method` onto the closest Layer-3 method
    // (equal/rating_weighted/market_cap are all valid Layer-3 methods). Re-saving
    // such a spec adopts the layered model — see buildLayered.
    layer3Method:
      spec.layered?.layer3?.method ??
      ((spec.weighting?.method ?? 'equal') as Layer3Method),
    layer3Gamma: spec.layered?.layer3?.gamma != null ? spec.layered.layer3.gamma : '',
    sectorDeltas: spec.layered?.layer2?.deltas
      ? Object.fromEntries(
          Object.entries(spec.layered.layer2.deltas).map(([s, frac]) => [s, frac * 100]),
        )
      : {},
    sectorCaps: spec.layered?.layer2?.sector_caps
      ? Object.fromEntries(
          Object.entries(spec.layered.layer2.sector_caps).map(([s, frac]) => [s, frac * 100]),
        )
      : {},
    // fraction (spec) → % (UI); uncapped specs load as '' (empty input).
    maxPositionWeight: spec.max_position_weight != null ? spec.max_position_weight * 100 : '',
    minPositionWeight: spec.min_position_weight != null ? spec.min_position_weight * 100 : '',
    rebalance: spec.rebalance?.cadence ?? DEFAULT_CONFIG.rebalance,
    commission: spec.costs?.commission_bps ?? DEFAULT_CONFIG.commission,
    slippage: spec.costs?.slippage_bps ?? DEFAULT_CONFIG.slippage,
    startDate: val?.start ?? DEFAULT_CONFIG.startDate,
    endDate: val?.end ?? DEFAULT_CONFIG.endDate,
    oosSplit: val?.oos_split != null ? val.oos_split * 100 : DEFAULT_CONFIG.oosSplit,
    minTrades: val?.min_n_trades ?? DEFAULT_CONFIG.minTrades,
  };
}

// ---- result adaptation (backend fractions → display %) ----

export interface DisplayMetrics {
  totalReturn: number; // %
  benchReturn: number; // %
  cagr: number; // %
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDD: number; // %
  alpha: number; // %
  beta: number;
  trades: number;
  lowConf: boolean;
}

export interface DisplayResult {
  metrics: DisplayMetrics;
  /** equity-curve rows for recharts: rebased index + benchmark. */
  curve: { date: string; portfolio: number; benchmark: number | null; drawdown: number }[];
  fills: BacktestResultOut['trades'];
}

export function adaptResult(r: BacktestResultOut): DisplayResult {
  const eq = r.equity;
  const base = eq.length ? eq[0].total_value : 1;
  const benchBase = eq.find((p) => p.benchmark_value != null)?.benchmark_value ?? null;
  const lastBench = [...eq].reverse().find((p) => p.benchmark_value != null)?.benchmark_value;
  const benchReturn =
    benchBase != null && lastBench != null ? (lastBench / benchBase - 1) * 100 : 0;

  const m = r.metrics;
  return {
    metrics: {
      totalReturn: m.total_return * 100,
      benchReturn,
      cagr: m.cagr * 100,
      sharpe: m.sharpe,
      sortino: m.sortino,
      calmar: m.calmar,
      maxDD: m.max_drawdown * 100,
      alpha: m.alpha != null ? m.alpha * 100 : 0,
      beta: m.beta ?? 0,
      trades: m.n_trades,
      lowConf: m.low_sample_trades,
    },
    curve: eq.map((p) => ({
      date: p.date,
      portfolio: base ? (p.total_value / base) * 100 : 100,
      benchmark:
        p.benchmark_value != null && benchBase ? (p.benchmark_value / benchBase) * 100 : null,
      drawdown: p.drawdown * 100,
    })),
    fills: r.trades,
  };
}

/** Build a short sparkline (rebased) from a backtest's equity for the list card. */
export function sparkFromResult(r: BacktestResultOut, points = 16): number[] {
  const eq = r.equity;
  if (eq.length === 0) return [];
  const base = eq[0].total_value || 1;
  const step = Math.max(1, Math.floor(eq.length / points));
  const out: number[] = [];
  for (let i = 0; i < eq.length; i += step) out.push((eq[i].total_value / base) * 100);
  return out;
}

/** Deep-merge the form-produced spec over the ORIGINAL server spec so filters
 *  the form does not expose (live-only: dividend_yield, vol caps, FCF yield…)
 *  survive a round-trip edit instead of being silently dropped (the
 *  specToConfig gap documented in #34). Form-managed clauses win key-by-key;
 *  a field the form cannot clear keeps its original value (documented v1
 *  caveat). Used whenever an edit of a server-persisted strategy is saved. */
export function mergeSpecPreserving(original: StrategySpec, formSpec: StrategySpec): StrategySpec {
  const universe = { ...original.universe, ...formSpec.universe };
  const selectionFilters =
    original.selection_filters || formSpec.selection_filters
      ? { ...(original.selection_filters ?? {}), ...(formSpec.selection_filters ?? {}) }
      : undefined;
  return {
    ...original,
    ...formSpec,
    universe,
    ...(selectionFilters ? { selection_filters: selectionFilters } : {}),
  };
}

/** Universe filters present in a server spec that the builder form does NOT
 *  expose — computed by construction: whatever does not survive the
 *  specToConfig → cfgToSpec round-trip is unsupported. Feeds the read-only
 *  "live-only filters" banner (issue #59). */
export function unsupportedUniverseFilters(spec: StrategySpec): string[] {
  const rt = cfgToSpec(specToConfig(spec, spec ? 'x' : 'x')).universe as Record<string, unknown>;
  const orig = spec.universe as Record<string, unknown>;
  return Object.keys(orig)
    .filter((k) => orig[k] !== null && orig[k] !== undefined && (rt[k] === null || rt[k] === undefined))
    .sort();
}
