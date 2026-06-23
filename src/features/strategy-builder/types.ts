// Types for the Strategy Builder feature — mirror the backend StrategySpec
// (Loop 1) and the backtest result DTO (Loop 4).

export interface RangeFilter {
  min?: number;
  max?: number;
}

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

/** The screener fundamentals enabled as PIT backtest filters (Selection rules) —
 *  the 6 directly-comparable ratios the backend resolves as-of
 *  `fundamentals_quarterly`. Per-quarter flow metrics (roe, dividend_yield…) are
 *  intentionally excluded by the backend's PIT linter. */
export type FundamentalKey =
  | 'pe_ratio'
  | 'ps_ratio'
  | 'pb_ratio'
  | 'pcf_ratio'
  | 'gross_margin'
  | 'operating_margin';

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

/** Any screener field the user can add as a Selection-rules filter. */
export type ScreenerFieldKey = FundamentalKey | PerformanceKey;

/** One active filter the user added (Selection rules is dynamic — the user picks
 *  fields from a catalog; only added fields render min/max inputs). '' = no
 *  bound on that side. */
export interface FundamentalFilter {
  key: ScreenerFieldKey;
  min: number | '';
  max: number | '';
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
export type Layer1Method = 'universe_marketcap';
export type Layer2Method = 'user_increment';
export type Layer3Method = 'equal' | 'rating_weighted' | 'inverse_atr_calm' | 'market_cap';
/** Lookback for the displayed sector alpha (display-only — not stored in the spec). */
export type AlphaWindow = '3m' | '6m' | '12m';

export interface Layer1Spec {
  method: Layer1Method;
}
export interface Layer2Spec {
  method: Layer2Method;
  /** sector (FMP name) → relative tilt as a fraction (+0.2 = +20%). */
  deltas: Record<string, number>;
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
  // selection rules — ordered list of the fundamentals the user added (dynamic)
  fundamentals: FundamentalFilter[];
  // universe (PIT-safe)
  sector: string; // '' = all
  minRating: number; // -3..3 → universe.rating.min
  minTrendStrength: number | '';
  minMomentum: number | ''; // smart_momentum.min
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
  // layered weighting: layer 1 (sector base) + layer 2 (sector tilt) are locked;
  // layer 3 (intra-sector) is the pluggable method. `sectorDeltas` is keyed by
  // FMP sector name and held in PERCENT (UI) — divided by 100 into the spec.
  layer3Method: Layer3Method;
  layer3Gamma: number | ''; // only rating_weighted; '' = default (1.0)
  sectorDeltas: Record<string, number>; // FMP sector → % relative tilt
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
