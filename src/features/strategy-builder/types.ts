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
  currency: Currency;
  benchmark: Benchmark;
  performance_metric: PerformanceMetric;
}

/** PIT-safe subset of the screener's ScreenerRequest used as the universe.
 *  Fundamentals/performance/pf fields are intentionally omitted — the backend's
 *  PIT linter rejects them in a backtest. */
export interface UniverseSpec {
  rating?: RangeFilter;
  trend_strength?: RangeFilter;
  smart_momentum?: RangeFilter;
  adx?: RangeFilter;
  sector?: string[];
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
  // weighting
  weight: WeightMethod;
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
  status: 'draft' | 'backtested';
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
