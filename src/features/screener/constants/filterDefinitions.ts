import type {
  FilterDefinition,
  MarketCapCategory,
  RatingConfig,
  RatingValue,
  Stock,
  TableColumn,
} from '../types';

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
// Company Size (Market Cap Category)
// =============================================================================

/**
 * Company size options for the primary filter.
 * Order: largest to smallest. Labels match the industry-standard buckets
 * used in the screener service `_market_cap_category_expr`.
 */
export const MARKET_CAP_CATEGORY_OPTIONS: ReadonlyArray<{
  value: MarketCapCategory;
  label: string;
  range: string;
}> = [
  { value: 'mega', label: 'Mega Cap', range: '> $200B' },
  { value: 'large', label: 'Large Cap', range: '$10B – $200B' },
  { value: 'mid', label: 'Mid Cap', range: '$2B – $10B' },
  { value: 'small', label: 'Small Cap', range: '$300M – $2B' },
  { value: 'micro', label: 'Micro Cap', range: '$50M – $300M' },
  { value: 'nano', label: 'Nano Cap', range: '< $50M' },
];

const MARKET_CAP_CATEGORY_VALUES: ReadonlySet<string> = new Set(
  MARKET_CAP_CATEGORY_OPTIONS.map((o) => o.value),
);

/**
 * Type guard for URL parsing.
 */
export function isMarketCapCategory(value: string): value is MarketCapCategory {
  return MARKET_CAP_CATEGORY_VALUES.has(value);
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
  {
    key: 'gross_margin',
    label: 'Gross Margin',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'gross_margin',
    unit: '%',
    description: 'Gross profit margin',
  },
  {
    key: 'operating_margin',
    label: 'Operating Margin',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'operating_margin',
    unit: '%',
    description: 'Operating profit margin',
  },
  {
    key: 'roe',
    label: 'ROE',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'roe',
    unit: '%',
    description: 'Return on Equity',
  },
  {
    key: 'eps_trailing',
    label: 'EPS (Trailing)',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'eps_trailing',
    description: 'Trailing twelve-month earnings per share',
  },
  {
    key: 'free_cash_flow_per_share',
    label: 'FCF / Share',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'free_cash_flow_per_share',
    description: 'Free cash flow per share',
  },
  {
    key: 'free_cash_flow_ttm',
    label: 'FCF (TTM)',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'free_cash_flow_ttm',
    unit: 'USD',
    description: 'Absolute free cash flow over the trailing twelve months',
  },
  {
    key: 'free_cash_flow_yield_ttm',
    label: 'FCF Yield (TTM)',
    category: 'fundamentals',
    type: 'range',
    apiKey: 'free_cash_flow_yield_ttm',
    unit: '%',
    description: 'TTM free cash flow divided by current market cap',
  },
];

/**
 * ADE filter definitions (Smart Momentum + bull cycle detection).
 * See backend `app/indicators/ade_mfh.py` and `docs/indicators/smart_momentum_ade.md`.
 */
export const ADE_FILTERS: FilterDefinition[] = [
  // Trend slopes (90-session) — see docs/indicators/slopes_90d.md
  {
    key: 'slope_clenow_90d',
    label: 'Slope Clenow (90d)',
    category: 'ade',
    type: 'range',
    apiKey: 'slope_clenow_90d',
    description: 'Pendiente exp-regresión anualizada × R² sobre 90 sesiones (fuerza de tendencia). Score crudo (no es %): 0.20 ≈ +20%/año, pero crece exponencialmente',
  },
  {
    key: 'slope_tema_90d',
    label: 'Slope TEMA (90d)',
    category: 'ade',
    type: 'range',
    apiKey: 'slope_tema_90d',
    description: 'Velocidad de 1 barra del TEMA(20) — rápido/reactivo. Fracción cruda por sesión (no es %): 0.005 ≈ +0.5%/día',
  },
  {
    key: 'sm_long_points',
    label: 'SM Long Points',
    category: 'ade',
    type: 'range',
    apiKey: 'sm_long_points',
    description: 'Close − Bull_Origin_Low while the bull origin is active (≥ 0)',
  },
  {
    key: 'sm_short_points',
    label: 'SM Short Points',
    category: 'ade',
    type: 'range',
    apiKey: 'sm_short_points',
    description: 'Close − Bear_Origin_High while the bear origin is active (≤ 0)',
  },
  {
    key: 'sm_long_pct',
    label: 'SM Long %',
    category: 'ade',
    type: 'range',
    apiKey: 'sm_long_pct',
    unit: '%',
    description: '(Close / Bull_Origin_Low − 1) × 100 while bull origin active (≥ 0)',
  },
  {
    key: 'sm_short_pct',
    label: 'SM Short %',
    category: 'ade',
    type: 'range',
    apiKey: 'sm_short_pct',
    unit: '%',
    description: '(Close / Bear_Origin_High − 1) × 100 while bear origin active (≤ 0)',
  },
  {
    key: 'sm_long_ratio',
    label: 'SM Long Ratio',
    category: 'ade',
    type: 'range',
    apiKey: 'sm_long_ratio',
    description: 'sm_long_points / ATR_Calm while bull origin active (≥ 0)',
  },
  {
    key: 'sm_short_ratio',
    label: 'SM Short Ratio',
    category: 'ade',
    type: 'range',
    apiKey: 'sm_short_ratio',
    description: 'sm_short_points / ATR_Calm while bear origin active (≤ 0)',
  },
  {
    key: 'sm_long_peak_ratio',
    label: 'SM Long Peak',
    category: 'ade',
    type: 'range',
    apiKey: 'sm_long_peak_ratio',
    description: 'Monotonic peak of sm_long_ratio within the bull cycle',
  },
  {
    key: 'sm_short_peak_ratio',
    label: 'SM Short Peak',
    category: 'ade',
    type: 'range',
    apiKey: 'sm_short_peak_ratio',
    description: 'Monotonic trough of sm_short_ratio within the bear cycle',
  },
  {
    key: 'in_bull_cycle',
    label: 'In Bull Cycle',
    category: 'ade',
    type: 'boolean',
    apiKey: 'in_bull_cycle',
    description: 'Symbol is inside a confirmed bullish cycle',
  },
  {
    key: 'bull_cycle_started',
    label: 'Bull Cycle Just Started',
    category: 'ade',
    type: 'boolean',
    apiKey: 'bull_cycle_started',
    description: 'Latest bar is the cycle confirmation bar',
  },
  {
    key: 'bull_cycle_origin_price',
    label: 'Bull Cycle Origin Price',
    category: 'ade',
    type: 'range',
    apiKey: 'bull_cycle_origin_price',
    description: 'Locked low at the active cycle origin',
  },
  {
    key: 'tracking_low',
    label: 'Tracking Low',
    category: 'ade',
    type: 'range',
    apiKey: 'tracking_low',
    description: 'Candidate low while between cycles',
  },
  {
    key: 'bull_cycle_origin_date',
    label: 'Bull Cycle Origin Date',
    category: 'ade',
    type: 'daterange',
    apiKey: 'bull_cycle_origin_date',
    description: 'Date of the locked low',
  },
  {
    key: 'days_in_cycle',
    label: 'Days in Cycle',
    category: 'ade',
    type: 'range',
    apiKey: 'days_in_cycle',
    unit: 'bars',
    description: 'Trading bars elapsed since the cycle origin (origin = 0)',
  },
  // ---- Retracement from peak (add_cycle_retracement / add_off_high_52w) ----
  {
    key: 'cycle_retracement_pct',
    label: 'Cycle Retracement %',
    category: 'ade',
    type: 'range',
    apiKey: 'cycle_retracement_pct',
    unit: '%',
    description: '% pullback from the confirmed bull-cycle high (≤ 0; 0 at a fresh cycle high)',
  },
  {
    key: 'off_high_52w_pct',
    label: 'Off 52w High %',
    category: 'ade',
    type: 'range',
    apiKey: 'off_high_52w_pct',
    unit: '%',
    description: '% pullback from the trailing 52-week high (≤ 0; 0 at a new 52-week high)',
  },
  // ---- Trend (= ADE cycle) high/low (add_cycle_retracement) ----
  {
    key: 'trend_high',
    label: 'Trend High',
    category: 'ade',
    type: 'range',
    apiKey: 'trend_high',
    description: 'Highest Close since the trend (cycle) started; price level, only while in cycle',
  },
  {
    key: 'trend_low',
    label: 'Trend Low',
    category: 'ade',
    type: 'range',
    apiKey: 'trend_low',
    description: 'Lowest Close since the trend (cycle) started; price level, only while in cycle',
  },
  // ---- FSS_v2 (Fortaleza Sub-Score) ----
  {
    key: 'fss',
    label: 'FSS',
    category: 'ade',
    type: 'range',
    apiKey: 'fss',
    description: 'Fortaleza Sub-Score [0–100]: 50% Smart-Money cycle memory + 50% VMC momentum',
  },
  // ---- Trade machine (docs/ADE.md + add_trade_state) ----
  {
    key: 'in_trade',
    label: 'In Trade',
    category: 'ade',
    type: 'boolean',
    apiKey: 'in_trade',
    description: 'Symbol currently has an open position (Long or Short)',
  },
  {
    key: 'trade',
    label: 'Trade (+2 Long / -2 Short)',
    category: 'ade',
    type: 'range',
    apiKey: 'trade',
    description: 'EasyLanguage Plot7: +2 Long, -2 Short, 0 flat',
  },
  {
    key: 'trade_dir',
    label: 'Trade Direction',
    category: 'ade',
    type: 'range',
    apiKey: 'trade_dir',
    description: 'TradeDir: +1 Long, -1 Short, 0 flat',
  },
  {
    key: 'bull_origin_active',
    label: 'Bull Origin Active',
    category: 'ade',
    type: 'boolean',
    apiKey: 'bull_origin_active',
    description: 'Bull origin latch is on (Rating crossed +→− at some point)',
  },
  {
    key: 'bear_origin_active',
    label: 'Bear Origin Active',
    category: 'ade',
    type: 'boolean',
    apiKey: 'bear_origin_active',
    description: 'Bear origin latch is on (Rating crossed −→+ at some point)',
  },
  {
    key: 'atr_spike',
    label: 'ATR Spike',
    category: 'ade',
    type: 'boolean',
    apiKey: 'atr_spike',
    description: 'ATR_Current > ATR_Calm × 2 — volatility expansion',
  },
  // ---- Profit Factor (Capa 2 — see Calculo_Profit_Factor_Capa2.md) ----
  {
    key: 'pf_weighted',
    label: 'PF Pond',
    category: 'ade',
    type: 'range',
    apiKey: 'pf_weighted',
    description: 'Weighted Profit Factor (40/35/25). ≥ 4 → approved, 2–4 → conditional, < 2 → rejected',
  },
  {
    key: 'pf_hist',
    label: 'PF Histórico',
    category: 'ade',
    type: 'range',
    apiKey: 'pf_hist',
    description: 'PF over all closed Long trades for the symbol',
  },
  {
    key: 'pf_last_5',
    label: 'PF Últimos 5',
    category: 'ade',
    type: 'range',
    apiKey: 'pf_last_5',
    description: 'PF over the 5 most recent closed Long trades',
  },
  {
    key: 'pf_last_3',
    label: 'PF Últimos 3',
    category: 'ade',
    type: 'range',
    apiKey: 'pf_last_3',
    description: 'PF over the 3 most recent closed Long trades',
  },
  {
    key: 'pf_verdict',
    label: 'PF Verdict',
    category: 'ade',
    type: 'multiselect',
    apiKey: 'pf_verdict',
    description: 'Capa 2 verdict: approved / promoted / degraded / conditional / rejected / no_trades',
  },
  {
    key: 'n_trades',
    label: 'N Trades',
    category: 'ade',
    type: 'range',
    apiKey: 'n_trades',
    description: 'Number of closed Long trades the PF is computed over',
  },
  {
    key: 'pf_low_confidence',
    label: 'PF Baja Confianza',
    category: 'ade',
    type: 'boolean',
    apiKey: 'pf_low_confidence',
    description: 'n_trades < 10 — PF may be noisy (spec §6)',
  },
  {
    key: 'pf_has_open_trade',
    label: 'PF Trade Abierto',
    category: 'ade',
    type: 'boolean',
    apiKey: 'pf_has_open_trade',
    description: 'Symbol currently has an open Long trade (excluded from PF)',
  },
  // ---- Capa 1 — Clasificación de Ciclo (Reglas Maestras v3.1 §2) ----
  {
    key: 'cycle_class',
    label: 'Clase de Ciclo',
    category: 'ade',
    type: 'multiselect',
    apiKey: 'cycle_class',
    description: 'Persistent class: long (≤30%) / mixed (30–50%) / short (≥50%) / no_trades',
  },
  {
    key: 'effective_cycle_class',
    label: 'Clase Efectiva',
    category: 'ade',
    type: 'multiselect',
    apiKey: 'effective_cycle_class',
    description: 'Post-upgrade class — open Long trade at day 45/90 with ret ≥ +15% is promoted to long',
  },
  {
    key: 'cycle_class_score',
    label: 'Score Clase de Ciclo',
    category: 'ade',
    type: 'range',
    apiKey: 'cycle_class_score',
    unit: '%',
    description: 'Weighted %short (40/35/25). ≤30 → long, 30–50 → mixed, ≥50 → short',
  },
  {
    key: 'pct_short_hist',
    label: '% Ciclos Cortos Hist',
    category: 'ade',
    type: 'range',
    apiKey: 'pct_short_hist',
    unit: '%',
    description: '% Long cycles with duration ≤ 45 trading days, full history',
  },
  {
    key: 'pct_short_last_5',
    label: '% Cortos Últimos 5',
    category: 'ade',
    type: 'range',
    apiKey: 'pct_short_last_5',
    unit: '%',
    description: '% short over the 5 most recent Long cycles',
  },
  {
    key: 'pct_short_last_3',
    label: '% Cortos Últimos 3',
    category: 'ade',
    type: 'range',
    apiKey: 'pct_short_last_3',
    unit: '%',
    description: '% short over the 3 most recent Long cycles',
  },
];

/**
 * Latest market bar filter definitions (sourced from `price_data_latest`).
 */
export const PRICES_FILTERS: FilterDefinition[] = [
  {
    key: 'open',
    label: 'Open',
    category: 'prices',
    type: 'range',
    apiKey: 'open',
    unit: 'USD',
    description: 'Latest session opening price',
  },
  {
    key: 'high',
    label: 'High',
    category: 'prices',
    type: 'range',
    apiKey: 'high',
    unit: 'USD',
    description: 'Latest session high price',
  },
  {
    key: 'low',
    label: 'Low',
    category: 'prices',
    type: 'range',
    apiKey: 'low',
    unit: 'USD',
    description: 'Latest session low price',
  },
  {
    key: 'close',
    label: 'Close',
    category: 'prices',
    type: 'range',
    apiKey: 'close',
    unit: 'USD',
    description: 'Latest session close price',
  },
  {
    key: 'volume',
    label: 'Volume',
    category: 'prices',
    type: 'range',
    apiKey: 'volume',
    description: 'Latest session traded shares',
  },
];

/**
 * Technical indicator filter definitions (sourced from
 * `technical_indicators_latest` on the backend). `klinger_oscillator` is
 * excluded — the backend pipeline does not populate it.
 */
export const INDICATORS_FILTERS: FilterDefinition[] = [
  {
    key: 'adx',
    label: 'ADX',
    category: 'indicators',
    type: 'range',
    apiKey: 'adx',
    description: 'Average Directional Index — trend strength (0–100)',
  },
  {
    key: 'adxr',
    label: 'ADXR',
    category: 'indicators',
    type: 'range',
    apiKey: 'adxr',
    description: 'ADX Rating — smoothed ADX',
  },
  {
    key: 'mfi_14',
    label: 'MFI (14)',
    category: 'indicators',
    type: 'range',
    apiKey: 'mfi_14',
    description: 'Money Flow Index over 14 periods (0–100)',
  },
  {
    key: 'rvi',
    label: 'RVI',
    category: 'indicators',
    type: 'range',
    apiKey: 'rvi',
    description: 'Relative Vigor Index',
  },
  {
    key: 'aroon_oscillator',
    label: 'Aroon Oscillator',
    category: 'indicators',
    type: 'range',
    apiKey: 'aroon_oscillator',
    description: 'Aroon Up − Aroon Down (−100 to +100)',
  },
  {
    key: 'atr',
    label: 'ATR',
    category: 'indicators',
    type: 'range',
    apiKey: 'atr',
    description: 'Average True Range — volatility',
  },
  {
    key: 'atr_calm',
    label: 'ATR Calm',
    category: 'indicators',
    type: 'range',
    apiKey: 'atr_calm',
    description: 'SMA(ATR(14), 30) — baseline ATR used by the ADE trade gates',
  },
  {
    key: 'vmc_z_score',
    label: 'VMC Z-Score',
    category: 'indicators',
    type: 'range',
    apiKey: 'vmc_z_score',
    description: 'Volatility / Momentum Composite Z-Score',
  },
  {
    key: 'tema_30',
    label: 'TEMA (30)',
    category: 'indicators',
    type: 'range',
    apiKey: 'tema_30',
    description: 'Triple Exponential Moving Average (30)',
  },
  {
    key: 'maa',
    label: 'MAA',
    category: 'indicators',
    type: 'range',
    apiKey: 'maa',
    description: 'Moving Average Adaptive',
  },
  {
    key: 'kama_er',
    label: 'KAMA ER',
    category: 'indicators',
    type: 'range',
    apiKey: 'kama_er',
    description: 'Kaufman Adaptive Moving Average — Efficiency Ratio',
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
  ...ADE_FILTERS,
  ...FUNDAMENTALS_FILTERS,
  ...PERFORMANCE_FILTERS,
  ...INDICATORS_FILTERS,
  ...PRICES_FILTERS,
  // Exclude primary filters from additional filters menu
  ...OTHER_FILTERS.filter((f) => !['exchange', 'sector', 'country', 'rating'].includes(f.key)),
];

/**
 * Backend-response fields that arrive as rational numbers (0.02) but are
 * displayed and filtered as percentages (2). The screener service multiplies
 * these by 100 on the response and divides filter inputs by 100 at the API
 * boundary so the rest of the app works in percent units.
 *
 * IMPORTANT: only list fields the backend stores as FRACTIONS. The `return_*`
 * fields are deliberately excluded — the backend already scales them to percent
 * (`(price/past − 1) × 100`), so they must NOT be multiplied again.
 */
export const PERCENTAGE_FIELDS = [
  'retracement',
  'dividend_yield',
  'revenue_growth_3m',
  'revenue_growth_12m',
  'earnings_growth_3m',
  'earnings_growth_12m',
  'gross_margin',
  'operating_margin',
  'roe',
  'free_cash_flow_yield_ttm',
] as const;

/**
 * Filter categories with display labels
 */
export const FILTER_CATEGORIES = [
  { key: 'trendrating', label: 'Trend' },
  { key: 'ade', label: 'ADE' },
  { key: 'fundamentals', label: 'Fundamentals' },
  { key: 'performance', label: 'Performance' },
  { key: 'indicators', label: 'Indicators' },
  { key: 'prices', label: 'Prices' },
  { key: 'others', label: 'Others' },
] as const;

/**
 * Get filter definition by key
 */
export function getFilterDefinition(key: string): FilterDefinition | undefined {
  return [
    ...TRENDRATING_FILTERS,
    ...ADE_FILTERS,
    ...FUNDAMENTALS_FILTERS,
    ...PERFORMANCE_FILTERS,
    ...INDICATORS_FILTERS,
    ...PRICES_FILTERS,
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
 * Format an ISO date string (`YYYY-MM-DD`) for display.
 */
function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

/**
 * Format a boolean as "Yes"/"No"; null/undefined → "—".
 */
function formatBool(value: unknown): string {
  if (value === null || value === undefined) return '—';
  return value ? 'Yes' : 'No';
}

/**
 * Format the ADE `trade` field (EL Plot7): +2 Long, −2 Short, 0 flat.
 */
function formatTrade(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (isNaN(n)) return '—';
  if (n === 2) return 'Long';
  if (n === -2) return 'Short';
  if (n === 0) return 'Flat';
  return formatRatingValue(n);
}

/**
 * Format trade_dir: +1 Long, −1 Short, 0 flat.
 */
function formatTradeDir(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (isNaN(n)) return '—';
  if (n === 1) return 'Long';
  if (n === -1) return 'Short';
  if (n === 0) return 'Flat';
  return String(n);
}

/**
 * Format a raw share count (volume) with K/M/B suffixes.
 */
function formatVolume(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return `${num}`;
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
 * Format an absolute USD amount using T/B/M/K suffixes. Negative values keep
 * the sign. Sub-1K amounts collapse to whole dollars.
 */
function formatAbsoluteUsd(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(0)}`;
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

export type ColumnPresetId = 'overview' | 'trendrating' | 'ade' | 'performance' | 'fundamentals' | 'indicators' | 'prices' | 'all';

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

const ADE_COLUMNS: TableColumn[] = [
  { key: 'sm_long_points', label: 'SM Long Pts', sortable: true, align: 'right', width: '120px', format: (v) => formatNumber(v, 2) },
  { key: 'sm_short_points', label: 'SM Short Pts', sortable: true, align: 'right', width: '120px', format: (v) => formatNumber(v, 2) },
  { key: 'sm_long_pct', label: 'SM Long %', sortable: true, align: 'right', width: '110px', format: formatPercent },
  { key: 'sm_short_pct', label: 'SM Short %', sortable: true, align: 'right', width: '115px', format: formatPercent },
  { key: 'sm_long_ratio', label: 'SM Long Ratio', sortable: true, align: 'right', width: '130px', format: (v) => formatNumber(v, 2) },
  { key: 'sm_short_ratio', label: 'SM Short Ratio', sortable: true, align: 'right', width: '135px', format: (v) => formatNumber(v, 2) },
  { key: 'sm_long_peak_ratio', label: 'SM Long Peak', sortable: true, align: 'right', width: '130px', format: (v) => formatNumber(v, 2) },
  { key: 'sm_short_peak_ratio', label: 'SM Short Peak', sortable: true, align: 'right', width: '135px', format: (v) => formatNumber(v, 2) },
  { key: 'sm_ratio', label: 'SM Ratio', sortable: true, align: 'right', width: '110px', format: (v) => formatNumber(v, 2) },
  { key: 'sm_pct', label: 'SM %', sortable: true, align: 'right', width: '100px', format: formatPercent },
  { key: 'sm_points', label: 'SM Points', sortable: true, align: 'right', width: '110px', format: (v) => formatNumber(v, 2) },
  { key: 'sm_peak_ratio', label: 'SM Peak', sortable: true, align: 'right', width: '110px', format: (v) => formatNumber(v, 2) },
  // Trend slopes (90-session) — see docs/indicators/slopes_90d.md
  { key: 'slope_clenow_90d', label: 'Slope Clenow', sortable: true, align: 'right', width: '120px', format: (v) => formatNumber(v, 4) },
  { key: 'slope_tema_90d', label: 'Slope TEMA', sortable: true, align: 'right', width: '115px', format: (v) => formatNumber(v, 4) },
  { key: 'in_bull_cycle', label: 'In Cycle', sortable: true, align: 'center', width: '90px', format: formatBool },
  { key: 'bull_cycle_origin_price', label: 'Cycle Origin', sortable: true, align: 'right', width: '120px', format: (v) => formatNumber(v, 2) },
  { key: 'bull_cycle_origin_date', label: 'Origin Date', sortable: true, align: 'center', width: '120px', format: formatDate },
  { key: 'tracking_low', label: 'Tracking Low', sortable: true, align: 'right', width: '120px', format: (v) => formatNumber(v, 2) },
  { key: 'bull_cycle_started', label: 'Cycle Started', sortable: true, align: 'center', width: '120px', format: formatBool },
  { key: 'days_in_cycle', label: 'Days in Cycle', sortable: true, align: 'right', width: '120px', format: (v) => formatNumber(v, 0) },
  // Retracement from peak (add_cycle_retracement / add_off_high_52w)
  { key: 'cycle_retracement_pct', label: 'Cycle Retr %', sortable: true, align: 'right', width: '120px', format: formatPercent },
  { key: 'off_high_52w_pct', label: 'Off 52w High %', sortable: true, align: 'right', width: '130px', format: formatPercent },
  // Trend (= ADE cycle) high/low — máx/mín Close desde la confirmación
  { key: 'trend_high', label: 'Trend High', sortable: true, align: 'right', width: '120px', format: (v) => formatNumber(v, 2) },
  { key: 'trend_low', label: 'Trend Low', sortable: true, align: 'right', width: '120px', format: (v) => formatNumber(v, 2) },
  // FSS_v2 (Fortaleza Sub-Score) — add_fss
  { key: 'fss', label: 'FSS', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 2) },
  // Trade machine (docs/ADE.md + add_trade_state)
  { key: 'in_trade', label: 'In Trade', sortable: true, align: 'center', width: '90px', format: formatBool },
  { key: 'trade', label: 'Trade', sortable: true, align: 'center', width: '90px', format: formatTrade },
  { key: 'trade_dir', label: 'Trade Dir', sortable: true, align: 'center', width: '100px', format: formatTradeDir },
  { key: 'entry_price', label: 'Entry Price', sortable: true, align: 'right', width: '110px', format: (v) => formatNumber(v, 2) },
  { key: 'entry_date', label: 'Entry Date', sortable: true, align: 'center', width: '120px', format: formatDate },
  { key: 'entry_rating', label: 'Entry Rating', sortable: true, align: 'center', width: '110px', format: formatRating },
  { key: 'best_rating_in_trade', label: 'Best Rating', sortable: true, align: 'center', width: '110px', format: formatRating },
  { key: 'trail_high', label: 'Trail High', sortable: true, align: 'right', width: '110px', format: (v) => formatNumber(v, 2) },
  { key: 'trail_low', label: 'Trail Low', sortable: true, align: 'right', width: '110px', format: (v) => formatNumber(v, 2) },
  { key: 'bull_origin_active', label: 'Bull Origin', sortable: true, align: 'center', width: '110px', format: formatBool },
  { key: 'bear_origin_active', label: 'Bear Origin', sortable: true, align: 'center', width: '110px', format: formatBool },
  { key: 'atr_spike', label: 'ATR Spike', sortable: true, align: 'center', width: '100px', format: formatBool },
  { key: 'sell_signal_fired', label: 'Sell Signal', sortable: true, align: 'center', width: '110px', format: formatBool },
  { key: 'emergency_fired', label: 'Emergency', sortable: true, align: 'center', width: '110px', format: formatBool },
  // Profit Factor (Capa 2) — Calculo_Profit_Factor_Capa2.md
  { key: 'pf_verdict', label: 'PF Verdict', sortable: true, align: 'center', width: '120px' },
  { key: 'pf_weighted', label: 'PF Pond', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 2) },
  { key: 'pf_hist', label: 'PF Hist', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 2) },
  { key: 'pf_last_5', label: 'PF Last 5', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 2) },
  { key: 'pf_last_3', label: 'PF Last 3', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 2) },
  { key: 'n_trades', label: 'N Trades', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 0) },
  { key: 'pf_low_confidence', label: 'Low Conf.', sortable: true, align: 'center', width: '110px', format: formatBool },
  { key: 'pf_has_open_trade', label: 'Open Trade', sortable: true, align: 'center', width: '120px', format: formatBool },
  // Capa 1 — Clasificación de Ciclo (Reglas Maestras v3.1 §2)
  { key: 'effective_cycle_class', label: 'Clase Efect.', sortable: true, align: 'center', width: '120px' },
  { key: 'cycle_class', label: 'Clase', sortable: true, align: 'center', width: '100px' },
  { key: 'cycle_class_score', label: 'Score Clase', sortable: true, align: 'right', width: '110px', format: (v) => formatNumber(v, 2) },
  // % de ciclos clasificados como cortos — ya viene 0-100 del backend; formatPercent solo añade '%'.
  { key: 'pct_short_hist', label: '% Cortos Hist', sortable: true, align: 'right', width: '130px', format: formatPercent },
  { key: 'pct_short_last_5', label: '% Cortos U5', sortable: true, align: 'right', width: '120px', format: formatPercent },
  { key: 'pct_short_last_3', label: '% Cortos U3', sortable: true, align: 'right', width: '120px', format: formatPercent },
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

const PRICES_COLUMNS: TableColumn[] = [
  { key: 'open', label: 'Open', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 2) },
  { key: 'high', label: 'High', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 2) },
  { key: 'low', label: 'Low', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 2) },
  { key: 'close', label: 'Close', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 2) },
  { key: 'volume', label: 'Volume', sortable: true, align: 'right', width: '110px', format: formatVolume },
];

const INDICATORS_COLUMNS: TableColumn[] = [
  { key: 'adx', label: 'ADX', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 2) },
  { key: 'adxr', label: 'ADXR', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 2) },
  { key: 'mfi_14', label: 'MFI (14)', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 2) },
  { key: 'rvi', label: 'RVI', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 2) },
  { key: 'aroon_oscillator', label: 'Aroon Osc.', sortable: true, align: 'right', width: '110px', format: (v) => formatNumber(v, 2) },
  { key: 'atr', label: 'ATR', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 2) },
  { key: 'atr_calm', label: 'ATR Calm', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 2) },
  { key: 'vmc_z_score', label: 'VMC Z', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 2) },
  { key: 'tema_30', label: 'TEMA (30)', sortable: true, align: 'right', width: '110px', format: (v) => formatNumber(v, 2) },
  { key: 'maa', label: 'MAA', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 2) },
  { key: 'kama_er', label: 'KAMA ER', sortable: true, align: 'right', width: '100px', format: (v) => formatNumber(v, 2) },
];

const FUNDAMENTALS_COLUMNS: TableColumn[] = [
  { key: 'pe_ratio', label: 'P/E', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 1) },
  { key: 'ps_ratio', label: 'P/S', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 2) },
  { key: 'pb_ratio', label: 'P/B', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 2) },
  { key: 'pcf_ratio', label: 'P/CF', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 2) },
  { key: 'pd_ratio', label: 'P/D', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 2) },
  { key: 'dividend_yield', label: 'Div Yield', sortable: true, align: 'right', width: '100px', format: formatPercent },
  { key: 'gross_margin', label: 'Gross Margin', sortable: true, align: 'right', width: '120px', format: formatPercent },
  { key: 'operating_margin', label: 'Op. Margin', sortable: true, align: 'right', width: '110px', format: formatPercent },
  { key: 'roe', label: 'ROE', sortable: true, align: 'right', width: '90px', format: formatPercent },
  { key: 'eps_trailing', label: 'EPS', sortable: true, align: 'right', width: '90px', format: (v) => formatNumber(v, 2) },
  { key: 'free_cash_flow_per_share', label: 'FCF / Share', sortable: true, align: 'right', width: '110px', format: (v) => formatNumber(v, 2) },
  { key: 'free_cash_flow_ttm', label: 'FCF (TTM)', sortable: true, align: 'right', width: '120px', format: formatAbsoluteUsd },
  { key: 'free_cash_flow_yield_ttm', label: 'FCF Yield', sortable: true, align: 'right', width: '110px', format: formatPercent },
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
    id: 'ade',
    label: 'ADE',
    description: 'Smart Momentum ADE: long/short points, ratio, %, and cycle peak',
    columns: [...PINNED_COLUMNS, ...ADE_COLUMNS],
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
    id: 'indicators',
    label: 'Indicators',
    description: 'Technical indicators: ADX, MFI, ATR, TEMA, KAMA and more',
    columns: [...PINNED_COLUMNS, ...INDICATORS_COLUMNS],
  },
  {
    id: 'prices',
    label: 'Prices',
    description: 'Latest market bar: open, high, low, close and volume',
    columns: [...PINNED_COLUMNS, ...PRICES_COLUMNS],
  },
  {
    id: 'all',
    label: 'All',
    description: 'Every available metric (scroll horizontal)',
    columns: [
      ...PINNED_COLUMNS,
      ...METADATA_COLUMNS,
      ...TRENDRATING_COLUMNS,
      ...ADE_COLUMNS,
      ...PERFORMANCE_COLUMNS,
      ...FUNDAMENTALS_COLUMNS,
      ...INDICATORS_COLUMNS,
      ...PRICES_COLUMNS,
    ],
  },
];

export const DEFAULT_COLUMN_PRESET: ColumnPresetId = 'overview';

export function getColumnPreset(id: ColumnPresetId): ColumnPreset {
  return TABLE_COLUMN_PRESETS.find((p) => p.id === id) ?? TABLE_COLUMN_PRESETS[0];
}
