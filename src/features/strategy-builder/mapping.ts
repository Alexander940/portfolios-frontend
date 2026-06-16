// Constants + mapping between the UI form config and the backend StrategySpec,
// and adaptation of the backend backtest result into the results-view shape.
import type {
  BacktestResultOut,
  BuilderConfig,
  MarketCapBucket,
  PerformanceMetric,
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

// PIT-safe sortable fields (FIELD_MAPPING keys the backtester accepts).
export const SORT_FIELDS: { k: string; label: string }[] = [
  { k: 'rating', label: 'Rating' },
  { k: 'smart_momentum', label: 'Smart Momentum' },
  { k: 'trend_strength', label: 'Trend Strength' },
  { k: 'retracement', label: 'Retracement' },
  { k: 'sm_long_points', label: 'SM Long Points' },
  { k: 'slope_clenow_90d', label: '90d Momentum (Clenow)' },
  { k: 'fss', label: 'Fortaleza (FSS)' },
  { k: 'adx', label: 'ADX' },
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
  rebalance: 'monthly',
  commission: 5,
  slippage: 8,
  startDate: '2019-01-01',
  endDate: '2024-01-01',
  oosSplit: 20,
  minTrades: 30,
};

export function cfgToSpec(cfg: BuilderConfig): StrategySpec {
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
    weighting: { method: cfg.weight },
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
