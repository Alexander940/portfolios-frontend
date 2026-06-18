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
  | 'indicators'
  | 'prices'
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
  peg_ratio_forward?: RangeFilter;
  peg_ratio_forward_cagr?: RangeFilter;
  ps_ratio?: RangeFilter;
  pb_ratio?: RangeFilter;
  pcf_ratio?: RangeFilter;
  pd_ratio?: RangeFilter;
  dividend_yield?: RangeFilter;
  revenue_growth_3m?: RangeFilter;
  revenue_growth_12m?: RangeFilter;
  earnings_growth_3m?: RangeFilter;
  earnings_growth_12m?: RangeFilter;
  gross_margin?: RangeFilter;
  operating_margin?: RangeFilter;
  roe?: RangeFilter;
  eps_trailing?: RangeFilter;
  free_cash_flow_per_share?: RangeFilter;
  /** Absolute TTM free cash flow in USD. */
  free_cash_flow_ttm?: RangeFilter;
  /** FCF / Market Cap (TTM). UI sends as %, service converts to rational at the API boundary. */
  free_cash_flow_yield_ttm?: RangeFilter;

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

  // Smart Momentum (ADE) per-side filters
  /** Close − Bull_Origin_Low while the bull origin is active (≥ 0). */
  sm_long_points?: RangeFilter;
  /** Close − Bear_Origin_High while the bear origin is active (≤ 0). */
  sm_short_points?: RangeFilter;
  /** (Close / Bull_Origin_Low − 1) × 100 while the bull origin is active (≥ 0). */
  sm_long_pct?: RangeFilter;
  /** (Close / Bear_Origin_High − 1) × 100 while the bear origin is active (≤ 0). */
  sm_short_pct?: RangeFilter;
  /** sm_long_points / ATR_Calm while the bull origin is active (≥ 0). */
  sm_long_ratio?: RangeFilter;
  /** sm_short_points / ATR_Calm while the bear origin is active (≤ 0). */
  sm_short_ratio?: RangeFilter;
  /** Monotonic peak of sm_long_ratio within the bull cycle (reset on each fresh activation). */
  sm_long_peak_ratio?: RangeFilter;
  /** Monotonic trough of sm_short_ratio within the bear cycle (reset on each fresh activation). */
  sm_short_peak_ratio?: RangeFilter;

  // Trend slopes (90-session) — see docs/indicators/slopes_90d.md
  /** Annualized exp-regression slope of ln(price) × R² over 90 sessions (trend strength). Raw decimal score (NOT a percentage). */
  slope_clenow_90d?: RangeFilter;
  /** 1-bar velocity of TEMA(20) — fast/reactive. Raw per-session fraction (NOT scaled to percent). */
  slope_tema_90d?: RangeFilter;

  // Bull cycle filters (ADE)
  in_bull_cycle?: boolean;
  bull_cycle_started?: boolean;
  bull_cycle_origin_price?: RangeFilter;
  tracking_low?: RangeFilter;
  bull_cycle_origin_date?: DateRangeFilter;
  days_in_cycle?: RangeFilter;

  // Retracement from peak (%, ≤ 0) — see add_cycle_retracement / add_off_high_52w
  /** % pullback from the confirmed bull-cycle high (0 at a fresh cycle high). */
  cycle_retracement_pct?: RangeFilter;
  /** % pullback from the trailing 52-week high (0 at a new 52-week high). */
  off_high_52w_pct?: RangeFilter;

  // Trend (= ADE cycle) high/low — running max/min Close since the cycle started
  /** Highest Close since the trend (cycle) started; price level, null out of cycle. */
  trend_high?: RangeFilter;
  /** Lowest Close since the trend (cycle) started; price level, null out of cycle. */
  trend_low?: RangeFilter;

  // FSS_v2 (Fortaleza Sub-Score) ∈ [0,100] — structural cycle memory + VMC momentum
  /** Fortaleza Sub-Score [0,100]: 50% Smart-Money cycle memory + 50% VMC momentum. */
  fss?: RangeFilter;

  // ADE trade machine — see docs/ADE.md + app/indicators/ade_mfh.py:add_trade_state
  /** Forever-latch turned on when Rating crosses +→− (independent of in_bull_cycle). */
  bull_origin_active?: boolean;
  /** Forever-latch turned on when Rating crosses −→+. */
  bear_origin_active?: boolean;
  /** ATR_Current > ATR_Calm × 2 — volatility expansion gate. */
  atr_spike?: boolean;
  /** True while a position is open (any side). */
  in_trade?: boolean;
  /** EL Plot7 export: +2 Long, -2 Short, 0 flat. */
  trade?: RangeFilter;
  /** TradeDir: -1 Short, 0 flat, +1 Long. */
  trade_dir?: RangeFilter;

  // Profit Factor (Capa 2) — see Calculo_Profit_Factor_Capa2.md
  /** Count of closed Long trades. */
  n_trades?: RangeFilter;
  /** PF over all closed Long trades. */
  pf_hist?: RangeFilter;
  /** PF over the most recent 5 closed Long trades. */
  pf_last_5?: RangeFilter;
  /** PF over the most recent 3 closed Long trades. */
  pf_last_3?: RangeFilter;
  /** PF_Pond = pf_hist*0.4 + pf_last_5*0.35 + pf_last_3*0.25 — verdict driver. */
  pf_weighted?: RangeFilter;
  /** Multiselect of: approved | promoted | degraded | conditional | rejected | no_trades. */
  pf_verdict?: string[];
  /** True when n_trades < 10. */
  pf_low_confidence?: boolean;
  /** True when the latest ade row is mid-Long (current cycle excluded from PF). */
  pf_has_open_trade?: boolean;

  // Capa 1 — Clasificación de Ciclo (Reglas Maestras v3.1 §2)
  /** % of Long cycles with duration_bars ≤ 45 in the full history. 0–100. */
  pct_short_hist?: RangeFilter;
  /** Same percent over the last 5 Long cycles. */
  pct_short_last_5?: RangeFilter;
  /** Same percent over the last 3 Long cycles. */
  pct_short_last_3?: RangeFilter;
  /** Weighted score (40/35/25). ≤30 → long, 30–50 → mixed, ≥50 → short. */
  cycle_class_score?: RangeFilter;
  /** Persistent class: 'long' | 'mixed' | 'short' | 'no_trades'. */
  cycle_class?: string[];
  /** Same set, post-upgrade by the open Long trade (day 45/90 + ret ≥ 15%). */
  effective_cycle_class?: string[];

  // Latest market bar filters (from `price_data_latest`).
  open?: RangeFilter;
  high?: RangeFilter;
  low?: RangeFilter;
  close?: RangeFilter;
  volume?: RangeFilter;

  // Technical indicator filters (from `technical_indicators_latest`).
  // klinger_oscillator is intentionally excluded — backend pipeline does not populate it.
  adx?: RangeFilter;
  adxr?: RangeFilter;
  mfi_14?: RangeFilter;
  rvi?: RangeFilter;
  aroon_oscillator?: RangeFilter;
  atr?: RangeFilter;
  atr_calm?: RangeFilter;
  vmc_z_score?: RangeFilter;
  tema_30?: RangeFilter;
  maa?: RangeFilter;
  kama_er?: RangeFilter;

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

  /** Rating del motor ADE (precios ajustados por split). Único rating;
   *  `trend.rating` (precio crudo) fue retirado del screener. */
  rating: number | null;

  // TrendRating data
  smart_momentum: number | null;
  trend_strength: number | null;
  retracement: number | null;
  /** Precio extremo de la racha actual del rating: max(high) si rating ≥ +1,
   *  min(low) si rating ≤ −1 (resetea al cambiar de lado). */
  new_high_low: number | null;
  days_since_rating: number | null;

  // Smart Momentum (ADE variant)
  /** Close − Bull_Origin_Low while the bull origin is active (≥ 0). */
  sm_long_points: number | null;
  /** Close − Bear_Origin_High while the bear origin is active (≤ 0). */
  sm_short_points: number | null;
  /** (Close / Bull_Origin_Low − 1) × 100 while the bull origin is active (≥ 0). */
  sm_long_pct: number | null;
  /** (Close / Bear_Origin_High − 1) × 100 while the bear origin is active (≤ 0). */
  sm_short_pct: number | null;
  /** sm_long_points / ATR_Calm while the bull origin is active (≥ 0). */
  sm_long_ratio: number | null;
  /** sm_short_points / ATR_Calm while the bear origin is active (≤ 0). */
  sm_short_ratio: number | null;
  /** Monotonic peak of sm_long_ratio within the bull cycle (reset on each fresh activation). */
  sm_long_peak_ratio: number | null;
  /** Monotonic trough of sm_short_ratio within the bear cycle (reset on each fresh activation). */
  sm_short_peak_ratio: number | null;
  sm_ratio: number | null;
  sm_pct: number | null;
  /** Legacy signed-by-active-cycle SM points; prefer sm_long_points / sm_short_points. */
  sm_points: number | null;
  sm_peak_ratio: number | null;

  // Trend slopes (90-session) — see docs/indicators/slopes_90d.md
  /** Annualized exp-regression slope × R² over 90 sessions (trend strength). Raw decimal score (NOT a percentage). */
  slope_clenow_90d: number | null;
  /** 1-bar velocity of TEMA(20) — fast/reactive. Raw per-session fraction (NOT scaled to percent). */
  slope_tema_90d: number | null;

  // Bull cycle detection (ADE)
  in_bull_cycle: boolean | null;
  bull_cycle_origin_price: number | null;
  /** ISO date string `YYYY-MM-DD` or null. */
  bull_cycle_origin_date: string | null;
  tracking_low: number | null;
  bull_cycle_started: boolean | null;
  /** Trading bars elapsed since bull_cycle_origin_date (origin = 0). NULL when out of cycle. */
  days_in_cycle: number | null;

  // Retracement from peak (%, ≤ 0) — see add_cycle_retracement / add_off_high_52w
  /** % pullback from the confirmed bull-cycle high (0 at a fresh cycle high). NULL out of cycle. */
  cycle_retracement_pct: number | null;
  /** % pullback from the trailing 52-week high (0 at a new 52-week high). */
  off_high_52w_pct: number | null;

  // Trend (= ADE cycle) high/low — running max/min Close since the cycle started
  /** Highest Close since the trend (cycle) started; price level, NULL out of cycle. */
  trend_high: number | null;
  /** Lowest Close since the trend (cycle) started; price level, NULL out of cycle. */
  trend_low: number | null;

  // FSS_v2 (Fortaleza Sub-Score) ∈ [0,100]
  /** Fortaleza Sub-Score [0,100]: 50% Smart-Money cycle memory + 50% VMC momentum. */
  fss: number | null;

  // ADE trade machine — see docs/ADE.md + app/indicators/ade_mfh.py:add_trade_state
  /** Forever-latch from EasyLanguage `Bull_Origin_Active` (Rating cross +→−). */
  bull_origin_active: boolean | null;
  /** Forever-latch from EasyLanguage `Bear_Origin_Active` (Rating cross −→+). */
  bear_origin_active: boolean | null;
  /** ATR_Current > ATR_Calm × 2. */
  atr_spike: boolean | null;
  /** True while a position is open (any side). */
  in_trade: boolean | null;
  /** TradeDir: -1 Short, 0 flat, +1 Long. */
  trade_dir: number | null;
  /** EL Plot7 export: +2 Long, -2 Short, 0 flat. */
  trade: number | null;
  /** Close at entry bar; null when flat. */
  entry_price: number | null;
  /** ISO date of entry bar; null when flat. */
  entry_date: string | null;
  /** Rating at entry bar; null when flat. */
  entry_rating: number | null;
  /** Running best rating (most positive for Long / most negative for Short) since entry. */
  best_rating_in_trade: number | null;
  /** Running high since entry (Long); null when flat or Short. */
  trail_high: number | null;
  /** Running low since entry (Short); null when flat or Long. */
  trail_low: number | null;
  /** Capa-1 Sell/Cover Signal latched (alert only — does not close the trade). */
  sell_signal_fired: boolean | null;
  /** Capa-2 Sell/Cover Emergency latched (alert only — does not close the trade). */
  emergency_fired: boolean | null;

  // Profit Factor (Capa 2) — see Calculo_Profit_Factor_Capa2.md
  /** Count of closed Long trades the symbol has accumulated. */
  n_trades: number | null;
  pf_hist: number | null;
  pf_last_5: number | null;
  pf_last_3: number | null;
  /** PF_Pond — the weighted PF that drives the verdict. */
  pf_weighted: number | null;
  /** approved | promoted | degraded | conditional | rejected | no_trades. */
  pf_verdict: string | null;
  /** n_trades < 10 — spec §6. */
  pf_low_confidence: boolean | null;
  /** Latest ade row has in_trade=True with trade_dir=+1. */
  pf_has_open_trade: boolean | null;

  // Capa 1 — Clasificación de Ciclo (Reglas Maestras v3.1 §2)
  pct_short_hist: number | null;
  pct_short_last_5: number | null;
  pct_short_last_3: number | null;
  /** Weighted %short (40/35/25). */
  cycle_class_score: number | null;
  /** 'long' | 'mixed' | 'short' | 'no_trades'. */
  cycle_class: string | null;
  /** Same set, after the open-Long-trade runtime upgrade. */
  effective_cycle_class: string | null;

  // Fundamentals data
  market_cap: number | null;
  market_cap_category: MarketCapCategory | null;
  pe_ratio: number | null;
  peg_ratio_forward: number | null;
  peg_ratio_forward_cagr: number | null;
  ps_ratio: number | null;
  pb_ratio: number | null;
  pcf_ratio: number | null;
  pd_ratio: number | null;
  dividend_yield: number | null;
  revenue_growth_3m: number | null;
  revenue_growth_12m: number | null;
  earnings_growth_3m: number | null;
  earnings_growth_12m: number | null;
  gross_margin: number | null;
  operating_margin: number | null;
  roe: number | null;
  eps_trailing: number | null;
  free_cash_flow_per_share: number | null;
  /** Absolute TTM free cash flow in USD. */
  free_cash_flow_ttm: number | null;
  /** FCF / Market Cap (TTM). Stored in percent units in the UI (e.g. `2.93`). */
  free_cash_flow_yield_ttm: number | null;

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

  // Latest market bar (from `price_data_latest`).
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;

  // Technical indicators (from `technical_indicators_latest`).
  adx: number | null;
  adxr: number | null;
  mfi_14: number | null;
  rvi: number | null;
  aroon_oscillator: number | null;
  atr: number | null;
  /** SMA(ATR(14), 30) — the same `ATR_Calm` used by ADE for trade gates. */
  atr_calm: number | null;
  vmc_z_score: number | null;
  tema_30: number | null;
  maa: number | null;
  kama_er: number | null;
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
