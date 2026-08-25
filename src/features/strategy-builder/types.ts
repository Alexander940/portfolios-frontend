// Types for the Strategy Builder feature — mirror the backend StrategySpec
// (Loop 1) and the backtest result DTO (Loop 4).

export interface RangeFilter {
  min?: number;
  max?: number;
}

/** Inclusive date-range filter (mirrors the backend DateRangeFilter). */
export interface DateRange {
  min?: string; // ISO YYYY-MM-DD
  max?: string;
}

/** How a catalog filter is entered/serialized. Defaults to 'range' for the
 *  pre-batch-2 numeric filters; bool / multiselect / daterange were added in
 *  batch 2 (in_trade excluded — see mapping.ts). */
export type FilterValueType = 'range' | 'boolean' | 'multiselect' | 'daterange';

export type SortOrder = 'asc' | 'desc';
export type WeightMethod = 'equal' | 'rating_weighted' | 'market_cap';
export type Cadence = 'monthly' | 'weekly';
export type Currency = 'USD';
export type Benchmark = 'SPY';
export type PerformanceMetric =
  | 'total_return'
  | 'cagr'
  | 'sharpe'
  | 'sortino'
  | 'calmar'
  | 'alpha'
  | 'max_drawdown';

/** General/meta parameters — currency + benchmark are locked (US-only / SPY);
 *  performance_metric is the headline strategy-vs-benchmark comparison metric. */
export interface GeneralSpec {
  instrument_type: InstrumentType;
  currency: Currency;
  benchmark: Benchmark;
  performance_metric: PerformanceMetric;
}

/** PIT-safe subset of the screener's ScreenerRequest used as the universe.
 *  Fundamentals/performance/pf fields are intentionally omitted — the backend's
 *  PIT linter rejects them in a backtest. */
export type MarketCapBucket = 'mega' | 'large' | 'mid' | 'small' | 'micro' | 'nano';
export type InstrumentType = 'stocks';

/** The screener fundamentals enabled as PIT backtest filters (Selection rules),
 *  resolved by the backend as-of `fundamentals_quarterly`. Beyond the directly-
 *  comparable ratios/margins these include the mapped growth metrics, trailing PEG,
 *  price/dividend, and per-period free cash flow. `pd_ratio` and `free_cash_flow`
 *  are per-quarter (not annual/TTM) — enabled by request. Per-quarter flow metrics
 *  (roe, dividend_yield, fcf/share…) stay excluded by the backend's PIT linter. */
export type FundamentalKey =
  | 'pe_ratio'
  | 'ps_ratio'
  | 'pb_ratio'
  | 'pcf_ratio'
  | 'gross_margin'
  | 'operating_margin'
  | 'revenue_growth_3m'
  | 'revenue_growth_12m'
  | 'earnings_growth_3m'
  | 'earnings_growth_12m'
  | 'eps_minus_rev_growth_3m'
  | 'eps_minus_rev_growth_12m'
  | 'peg_ratio_trailing'
  | 'pd_ratio'
  | 'free_cash_flow';

/** Screener "performance view" fields, PIT via the backfilled symbol_performance
 *  history. Returns are stored as percent (entered as-is); sharpe is unitless. */
export type PerformanceKey =
  | 'return_1w'
  | 'return_1m'
  | 'return_3m'
  | 'return_6m'
  | 'return_12m'
  | 'return_ytd'
  | 'sharpe_6m'
  | 'sharpe_12m';

/** Trend / TrendRating range fields, PIT via the `trend`/`ade` dated series.
 *  `rating` / `smart_momentum` / `trend_strength` live in the catalog since issue
 *  #98 (no default filters — their old dedicated universe knobs are gone).
 *  `days_since_rating` works as a FILTER but is NOT a valid selection.sort_by
 *  (the backend ranking path can't resolve the computed column), so it must
 *  never be offered as a sort key. */
export type TrendKey =
  | 'rating'
  | 'smart_momentum'
  | 'trend_strength'
  | 'retracement'
  | 'days_since_rating';

/** Smart-Momentum (ADE variant) per-side range fields, PIT via the `ade` series. */
export type SmartMomentumKey =
  | 'sm_long_points'
  | 'sm_short_points'
  | 'sm_long_pct'
  | 'sm_short_pct'
  | 'sm_long_ratio'
  | 'sm_short_ratio'
  | 'sm_long_peak_ratio'
  | 'sm_short_peak_ratio';

/** 90-day trend slopes + bull-cycle / retracement / trade-machine numeric fields,
 *  PIT via the `ade` series. */
export type AdeCycleKey =
  | 'slope_clenow_90d'
  | 'slope_tema_90d'
  | 'bull_cycle_origin_price'
  | 'tracking_low'
  | 'days_in_cycle'
  | 'cycle_retracement_pct'
  | 'off_high_52w_pct'
  | 'trend_high'
  | 'trend_low'
  | 'fss'
  | 'trade'
  | 'trade_dir';

/** Technical-indicator range fields, PIT via the `technical_indicators` series. */
export type IndicatorKey =
  | 'adx'
  | 'adxr'
  | 'mfi_14'
  | 'rvi'
  | 'aroon_oscillator'
  | 'atr'
  | 'atr_calm'
  | 'vmc_z_score'
  | 'tema_30'
  | 'maa'
  | 'kama_er';

/** Latest market-bar range fields, PIT via `price_data` (resolved as-of). */
export type PriceKey = 'open' | 'high' | 'low' | 'close' | 'volume';

/** Boolean (ade) fields, PIT via the `ade` series. `new_high`/`new_low` are
 *  TRUE-ONLY toggles (the backend gates on truthiness; =False is a no-op).
 *  `in_trade` is intentionally NOT here — the backtester force-gates the universe
 *  to in_trade=True, so a user value is overwritten (footgun). */
export type BooleanFieldKey =
  | 'new_high'
  | 'new_low'
  | 'in_bull_cycle'
  | 'bull_cycle_started'
  | 'bull_origin_active'
  | 'bear_origin_active'
  | 'atr_spike';

/** Multiselect (sym) classification fields. `country` is omitted (the universe is
 *  locked to US); `sector` is offered only in the Selection-rules section because
 *  the universe already has a dedicated single-sector control. Current-only
 *  (the symbols table is not historized) — a documented PIT caveat. */
export type ClassificationKey = 'sector' | 'exchange';

/** Date-range (ade) fields, PIT via the `ade` series. */
export type DateRangeFieldKey = 'bull_cycle_origin_date';

/** Any screener field the user can add as a filter (Additional or Selection
 *  rules). All are PIT-safe in a backtest — the backend's PIT linter accepts the
 *  ade/ti/tr/price/sym aliases; Profit-Factor, non-quarterly fundamentals, and
 *  volatility/liquidity fields stay out because the linter rejects them. */
export type ScreenerFieldKey =
  | FundamentalKey
  | PerformanceKey
  | TrendKey
  | SmartMomentumKey
  | AdeCycleKey
  | IndicatorKey
  | PriceKey
  | BooleanFieldKey
  | ClassificationKey
  | DateRangeFieldKey;

/** One active filter the user added (the rule sections are dynamic — the user
 *  picks fields from a catalog). The shape carries every value type; the catalog's
 *  `def.type` (mapping.ts) is the source of truth for which fields are populated.
 *  Pre-batch-2 saved filters are `{key,min,max}` with no `type` → treated as range.
 *  '' = no bound on that side (range/daterange). */
export interface FundamentalFilter {
  key: ScreenerFieldKey;
  type?: FilterValueType; // absent → 'range'
  min?: number | ''; // range
  max?: number | ''; // range
  value?: boolean; // boolean
  values?: string[]; // multiselect
  dateMin?: string; // daterange (ISO)
  dateMax?: string; // daterange (ISO)
}

export interface UniverseSpec {
  rating?: RangeFilter;
  trend_strength?: RangeFilter;
  smart_momentum?: RangeFilter;
  adx?: RangeFilter;
  sector?: string[];
  country?: string[];
  market_cap_category?: MarketCapBucket[];
  exclude?: string[]; // symbol_ids to exclude
  // Selection-rules fundamentals (PIT via fundamentals_quarterly). Margins are
  // fractions 0–1 in the spec (the UI enters % and divides by 100).
  pe_ratio?: RangeFilter;
  ps_ratio?: RangeFilter;
  pb_ratio?: RangeFilter;
  pcf_ratio?: RangeFilter;
  gross_margin?: RangeFilter;
  operating_margin?: RangeFilter;
  // Growth (fractions in the spec; the UI enters % and divides by 100) + trailing
  // PEG, price/dividend, and per-period absolute-USD free cash flow.
  revenue_growth_3m?: RangeFilter;
  revenue_growth_12m?: RangeFilter;
  earnings_growth_3m?: RangeFilter;
  earnings_growth_12m?: RangeFilter;
  eps_minus_rev_growth_3m?: RangeFilter;
  eps_minus_rev_growth_12m?: RangeFilter;
  peg_ratio_trailing?: RangeFilter;
  pd_ratio?: RangeFilter;
  free_cash_flow?: RangeFilter; // per-period absolute USD (backtest-only)
  // Selection-rules performance (PIT via symbol_performance). Returns are in
  // percent (no transform); sharpe is unitless.
  return_1w?: RangeFilter;
  return_1m?: RangeFilter;
  return_3m?: RangeFilter;
  return_6m?: RangeFilter;
  return_12m?: RangeFilter;
  return_ytd?: RangeFilter;
  sharpe_6m?: RangeFilter;
  sharpe_12m?: RangeFilter;
  // ---- ade / ti / tr / price range filters (raw values; resolved as-of in a
  // backtest). Added to the Additional/Selection-rules catalog (see mapping.ts). ----
  // Trend / TrendRating (alias tr/ade). rating/trend_strength/smart_momentum are
  // declared at the top of this interface — catalog filters since issue #98.
  retracement?: RangeFilter;
  days_since_rating?: RangeFilter; // filter-only — not a valid sort_by (see TrendKey)
  // Smart Momentum (ADE variant, alias ade)
  sm_long_points?: RangeFilter;
  sm_short_points?: RangeFilter;
  sm_long_pct?: RangeFilter;
  sm_short_pct?: RangeFilter;
  sm_long_ratio?: RangeFilter;
  sm_short_ratio?: RangeFilter;
  sm_long_peak_ratio?: RangeFilter;
  sm_short_peak_ratio?: RangeFilter;
  // 90d slopes + bull-cycle / retracement / trend extremes / FSS / trade machine (ade)
  slope_clenow_90d?: RangeFilter;
  slope_tema_90d?: RangeFilter;
  bull_cycle_origin_price?: RangeFilter;
  tracking_low?: RangeFilter;
  days_in_cycle?: RangeFilter;
  cycle_retracement_pct?: RangeFilter;
  off_high_52w_pct?: RangeFilter;
  trend_high?: RangeFilter;
  trend_low?: RangeFilter;
  fss?: RangeFilter;
  trade?: RangeFilter;
  trade_dir?: RangeFilter;
  // Technical indicators (alias ti). `adx` is declared above (legacy universe field).
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
  // Latest market bar (alias price)
  open?: RangeFilter;
  high?: RangeFilter;
  low?: RangeFilter;
  close?: RangeFilter;
  volume?: RangeFilter;
  // ---- batch-2 non-range filters ----
  // Boolean (ade). new_high/new_low are TRUE-only (backend gates on truthiness).
  new_high?: boolean;
  new_low?: boolean;
  in_bull_cycle?: boolean;
  bull_cycle_started?: boolean;
  bull_origin_active?: boolean;
  bear_origin_active?: boolean;
  atr_spike?: boolean;
  // Multiselect (sym). `sector` / `country` are declared above (string[]); `exchange`
  // is new. `country` stays universe-only (locked US); `sector` catalog filter is
  // Selection-rules-only to avoid colliding with the dedicated universe control.
  exchange?: string[];
  // Date-range (ade): bull-cycle origin date, resolved as-of.
  bull_cycle_origin_date?: DateRange;
}

/** A stock chosen for the Exclusion list (kept with ticker/name for display). */
export interface ExcludedSymbol {
  symbolId: string;
  ticker: string;
  name: string;
}

export interface EntryExitSpec {
  mode: 'trade_state';
  min_er: number;
  max_sm_atr_mult: number;
  atr_spike_mult: number;
  trail_atr_mult: number;
  emergency_atr_mult: number;
  exit_rating_long: number;
  exit_rating_short: number;
  use_trail_stop: boolean;
}

export interface SelectionSpec {
  sort_by: string;
  sort_order: SortOrder;
  top_n: number;
  per_sector?: number | null;
}

export interface WeightingSpec {
  method: WeightMethod;
}

// ---- layered weighting (sector base → sector tilt → intra-sector) ----
// Mirrors the backend LayeredWeighting clause. Layers 1 & 2 are locked to a
// single method in v1 (the Literal has one value); layer 3 is pluggable.
export type Layer1Method = 'universe_marketcap' | 'top_marketcap';
export type Layer2Method = 'user_increment';
export type Layer3Method = 'equal' | 'rating_weighted' | 'inverse_atr_calm' | 'market_cap';
/** Lookback for the displayed sector alpha (display-only — not stored in the spec). */
export type AlphaWindow = '3m' | '6m' | '12m';

export interface Layer1Spec {
  method: Layer1Method;
  /** Size of the reference population for `top_marketcap` (the N largest US
   *  stocks). The backend REQUIRES it on that method and REJECTS it (422) on
   *  `universe_marketcap` — a present `top_n: null` is still a rejection, so it
   *  must be omitted by spread, never nulled. */
  top_n?: number | null;
}
export interface Layer2Spec {
  method: Layer2Method;
  /** sector (FMP name) → relative tilt as a fraction (+0.2 = +20%). */
  deltas: Record<string, number>;
  /** sector (FMP name) → max weight as a fraction in (0, 1] (0.3 = cap at 30%).
   *  Optional/omitted when empty so the backend content_hash of a pre-caps layered
   *  spec is unchanged (the backend pops an empty `sector_caps` from canonical_json). */
  sector_caps?: Record<string, number>;
}
export interface Layer3Spec {
  method: Layer3Method;
  gamma?: number | null; // only rating_weighted
}
export interface LayeredWeightingSpec {
  layer1: Layer1Spec;
  layer2: Layer2Spec;
  layer3: Layer3Spec;
}

// ---- resolve-universe DTOs (POST /strategies/resolve-universe) ----
export interface SectorRow {
  sector: string; // FMP-normalized; NULL bucket is "Unclassified"
  member_count: number;
  alpha_coverage: number;
  base_weight_pct: number; // Layer 1 market-cap share
  alpha_vs_spy: number | null; // median member alpha; null if coverage too low
}
export interface ResolveUniverseResponse {
  as_of: string;
  alpha_window: string;
  alpha_metric: string;
  alpha_pit_safe: boolean;
  base_method: Layer1Method;
  top_n?: number | null; // echo of the requested top-N size; null unless top_marketcap
  total_market_cap: number;
  eligible_count: number;
  coverage_pct: number;
  sectors: SectorRow[];
}

export interface RebalanceSpec {
  cadence: Cadence;
}

export interface CostsSpec {
  commission_bps: number;
  slippage_bps: number;
}

export interface ValidationSpec {
  start: string; // ISO YYYY-MM-DD
  end: string;
  oos_split: number; // 0..1
  min_n_trades: number;
}

export interface StrategySpec {
  general: GeneralSpec;
  universe: UniverseSpec;
  entry_exit: EntryExitSpec;
  selection: SelectionSpec;
  weighting: WeightingSpec;
  /** Optional 3-layer weighting. When present the backtester uses it instead of
   *  `weighting`; omitted (kept undefined) for a plain equal strategy so the
   *  backend content_hash of pre-layered specs is unchanged. */
  layered?: LayeredWeightingSpec | null;
  /** Optional per-name MAX weight (a fraction in (0, 1]): no single position may
   *  exceed this share of the portfolio. Applied as a final clamp on the target
   *  weights (both the legacy and the layered path). Omitted (kept undefined) when
   *  uncapped so the backend content_hash of pre-existing specs is unchanged (the
   *  backend pops a null `max_position_weight` from canonical_json). */
  max_position_weight?: number | null;
  /** Optional per-name MIN weight (a fraction in (0, 1)): positions that do not
   *  reach this share of the portfolio are dropped and their weight is
   *  redistributed among the remaining names — the book may end up with fewer
   *  positions than the top-N. Must be below max_position_weight when both are
   *  set (backend 422s otherwise). Omitted (kept undefined) when no floor so the
   *  backend content_hash of pre-existing specs is unchanged. */
  min_position_weight?: number | null;
  /** Optional post-universe selection filters (same screen vocabulary as the
   *  universe). When present the backtester narrows the ranked set by them AFTER
   *  resolving the universe and computing the Layer-1 base — so they never bias
   *  the weighting. Omitted (kept undefined) for strategies without one, so the
   *  backend content_hash of pre-existing specs is unchanged. */
  selection_filters?: UniverseSpec | null;
  rebalance: RebalanceSpec;
  costs: CostsSpec;
  validation: ValidationSpec;
}

// ---- backend response DTOs (Loop 4) ----

export interface StrategyCreatedResponse {
  strategy_id: string;
  version: number;
  content_hash: string;
}

/** `PUT /strategies/{id}` — update in place (rename and/or a new spec version).
 *  `spec_changed: false` = same canonical hash as the latest version, nothing
 *  was created — the builder turns that into the "dates haven't changed" notice. */
export interface StrategyUpdatedResponse {
  strategy_id: string;
  version: number;
  content_hash: string;
  spec_changed: boolean;
}

/** One row of `GET /strategies/` — the current user's saved strategies (head +
 *  the latest version's spec). Lets the builder list + open server-persisted
 *  strategies (incl. ones the AI assistant created), not just local ones. */
export interface StrategyListItem {
  strategy_id: string;
  name: string;
  description: string | null;
  latest_version: number;
  created_at: string; // ISO
  updated_at: string; // ISO
  spec: StrategySpec;
  /** Provenance (issue #58): which catalog template/version this strategy was
   *  instantiated from; null for from-scratch strategies. */
  template_slug: string | null;
  template_version: number | null;
}

// ---- Strategy Templates (Fase 2, issues #57/#58/#59) ----

/** Readable chips for a template card in the gallery (`GET /templates/`). */
export interface TemplateSummary {
  filters_count: number;
  top_n: number | null;
  cadence: string | null;
  weighting: string | null;
  objective_metric: string | null;
}

export interface TemplateListItem {
  slug: string;
  title: string;
  description: string | null;
  status: 'active' | 'paused';
  latest_version: number;
  updated_at: string | null;
  summary: TemplateSummary;
}

export interface BacktestSubmitResponse {
  job_id: string;
  status: string;
  cached: boolean;
}

export interface BacktestMetrics {
  total_return: number;
  cagr: number;
  volatility: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  max_drawdown: number;
  alpha: number | null;
  beta: number | null;
  n_trades: number;
  n_rebalances: number;
  is_sharpe: number | null;
  oos_sharpe: number | null;
  low_sample_trades: boolean;
  low_sample_universe: boolean;
  // ---- turnover / cost-drag metrics (issue #155/#156) — ALL optional: the 174
  // results saved before #155 shipped don't have them and must keep rendering. ----
  /** Annualized two-sided turnover as a percent (e.g. 976.3 = 976.3%; the
   *  two-sided convention is (Σ sells + Σ buys) / (2 × avg equity) — 100% means
   *  the whole book turned over once). */
  turnover_pct_annual?: number;
  /** Total commission + slippage paid over the whole window, in USD. */
  total_costs?: number;
  /** Annualized percent of return given up to trading costs (e.g. 2.5 = 2.5%/yr). */
  cost_drag_pct_annual?: number;
  /** Average number of calendar days a position was held, entry to exit. */
  avg_holding_days?: number;
  /** Number of position closes (mirrors n_trades' entries — a `>0 → 0` transition). */
  n_exits?: number;
}

export interface EquityPoint {
  date: string;
  total_value: number;
  cash: number;
  invested: number;
  benchmark_value: number | null;
  daily_return: number;
  drawdown: number;
}

export interface TradeRow {
  symbol_id: string | null;
  ticker: string | null;
  date: string;
  side: string;
  shares: number;
  price: number;
  value: number;
  cost: number;
}

export interface BacktestResultOut {
  metrics: BacktestMetrics;
  coverage_pct: number;
  fill_convention: string;
  initial_cash: number;
  window_start: string;
  window_end: string;
  equity: EquityPoint[];
  trades: TradeRow[];
}

export interface BacktestStatusResponse {
  job_id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  error: string | null;
  result: BacktestResultOut | null;
}

// ---- form config (UI-side) ----

export interface BuilderConfig {
  name: string;
  // general parameters (currency + benchmark are locked; metric is selectable)
  performanceMetric: PerformanceMetric;
  // investment universe (instrument type + country are locked)
  companySizes: MarketCapBucket[];
  excluded: ExcludedSymbol[];
  // "Additional rules" — fundamental/performance filters that CONSTRAIN the
  // investment universe (and therefore the Layer-1 sector weighting base). They
  // map into spec.universe. Pre-existing strategies' filters load here.
  additionalRules: FundamentalFilter[];
  // "Selection rules" — the SAME field catalog, but applied as a post-universe
  // phase: they narrow which names are ranked/picked WITHOUT shrinking the
  // universe or the weighting base. They map into spec.selection_filters.
  selectionFilters: FundamentalFilter[];
  // universe (PIT-safe). rating / trend_strength / smart_momentum have no
  // dedicated knobs since issue #98 — they are ordinary catalog filters now.
  sector: string; // '' = all
  // entry / exit (the real 8 trade-state knobs, friendly subset shown)
  minEr: number; // min_er 0..1
  useTrailStop: boolean;
  trailAtrMult: number; // trail_atr_mult
  exitRatingLong: number; // exit_rating_long
  // selection
  sortBy: string;
  sortOrder: SortOrder;
  topN: number;
  perSector: boolean;
  maxPerSector: number;
  // weighting (legacy single-stage — still read from older saved specs)
  weight: WeightMethod;
  // layered weighting: layer 1 (sector base) picks WHICH population the sector
  // shares are measured over; layer 2 (sector tilt) is locked; layer 3
  // (intra-sector) is the pluggable method. `sectorDeltas` is keyed by FMP
  // sector name and held in PERCENT (UI) — divided by 100 into the spec.
  layer1Method: Layer1Method;
  /** Reference population size for `top_marketcap`. NOT `topN` above — that one
   *  is the SELECTION top-N (how many holdings the book carries). '' = unset. */
  layer1TopN: number | '';
  layer3Method: Layer3Method;
  layer3Gamma: number | ''; // only rating_weighted; '' = default (1.0)
  sectorDeltas: Record<string, number>; // FMP sector → % relative tilt
  sectorCaps: Record<string, number>; // FMP sector → max weight in PERCENT (30 = 30%)
  // Per-name max weight in PERCENT (10 = cap every position at 10%); '' = uncapped.
  // Applies to any strategy (both paths); divided by 100 into spec.max_position_weight.
  maxPositionWeight: number | '';
  // Per-name min weight in PERCENT (5 = drop positions under 5%); '' = no floor.
  // Divided by 100 into spec.min_position_weight; must stay below maxPositionWeight.
  minPositionWeight: number | '';
  // rebalance
  rebalance: Cadence;
  // costs
  commission: number;
  slippage: number;
  // validation
  startDate: string;
  endDate: string;
  oosSplit: number; // 0..50 (%)
  minTrades: number;
}

/** A saved strategy in the local list (no backend list endpoint in v1). */
export interface SavedStrategy {
  id: string; // strategy_id from the backend (or a local draft id)
  name: string;
  // 'saved' = persisted on the server (e.g. created by the AI assistant) but not
  // yet backtested in this client; 'draft' = local-only; 'backtested' = has a run.
  status: 'draft' | 'backtested' | 'saved';
  updated: number; // epoch ms
  cfg: BuilderConfig;
  /** Raw server spec (server-persisted strategies only). Carried so an EDIT can
   *  round-trip WITHOUT losing the filters the form does not expose (the lossy
   *  specToConfig gap of #34): saving merges the form output over this spec. */
  spec?: StrategySpec;
  /** Provenance (issue #58): template slug/version this strategy came from. */
  templateSlug?: string | null;
  templateVersion?: number | null;
  jobId?: string;
  summary?: {
    totalReturn: number;
    sharpe: number;
    maxDD: number;
    trades: number;
    lowConf: boolean;
  };
  spark?: number[];
}
