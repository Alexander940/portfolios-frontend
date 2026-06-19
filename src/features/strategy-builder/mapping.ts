// Constants + mapping between the UI form config and the backend StrategySpec,
// and adaptation of the backend backtest result into the results-view shape.
import type {
  BacktestResultOut,
  BuilderConfig,
  FundamentalFilter,
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
// fraction (÷100); `ratio` is stored as-entered. Mirrors the backend's
// PIT_SAFE_QUARTERLY_FIELDS (Fundamentals) + PIT_SAFE_PERF_FIELDS (Performance).
export type FilterCategory = 'Fundamentals' | 'Performance';

export interface ScreenerFilterDef {
  key: ScreenerFieldKey;
  label: string;
  kind: 'ratio' | 'pct';
  hint: string;
  category: FilterCategory;
  unit?: string; // shown in the chip/modal (e.g. '%'); margins are also ÷100 (kind 'pct')
}

export const SCREENER_FILTERS: ScreenerFilterDef[] = [
  // Fundamentals — PIT via fundamentals_quarterly.
  { key: 'pe_ratio', label: 'P/E ratio', kind: 'ratio', hint: 'Price / trailing earnings (TTM, at quarter-end price).', category: 'Fundamentals' },
  { key: 'ps_ratio', label: 'P/S ratio', kind: 'ratio', hint: 'Price / sales.', category: 'Fundamentals' },
  { key: 'pb_ratio', label: 'P/B ratio', kind: 'ratio', hint: 'Price / book value.', category: 'Fundamentals' },
  { key: 'pcf_ratio', label: 'P/CF ratio', kind: 'ratio', hint: 'Price / operating cash flow.', category: 'Fundamentals' },
  { key: 'gross_margin', label: 'Gross margin', kind: 'pct', hint: 'Gross profit / revenue.', category: 'Fundamentals', unit: '%' },
  { key: 'operating_margin', label: 'Operating margin', kind: 'pct', hint: 'Operating income / revenue.', category: 'Fundamentals', unit: '%' },
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
];

// Ordered category list for the add-selector's <optgroup>s.
export const FILTER_CATEGORIES: FilterCategory[] = ['Fundamentals', 'Performance'];

/** Human-readable bounds for a Selection-rules chip: "5 – 20 %", "≥ 5", "≤ 20",
 *  or "any" when both bounds are blank. */
export function formatRange(min: number | '', max: number | '', unit?: string): string {
  const u = unit ? ` ${unit}` : '';
  if (min !== '' && max !== '') return `${min}${u} – ${max}${u}`;
  if (min !== '') return `≥ ${min}${u}`;
  if (max !== '') return `≤ ${max}${u}`;
  return 'any';
}

// Catalog lookup by key — cfgToSpec needs each active filter's `kind` (to know
// whether to divide a percentage margin by 100).
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
  fundamentals: [],
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

/** Merge a (possibly older) saved config onto the current DEFAULT_CONFIG so
 *  fields added after it was saved — e.g. `fundamentals` — are always present.
 *  Strategies persisted before a field existed would otherwise crash the form
 *  (`cfg.fundamentals[k]`) or cfgToSpec. Idempotent on fresh configs. */
export function normalizeCfg(cfg: BuilderConfig): BuilderConfig {
  const saved = cfg as Partial<BuilderConfig>;
  // `fundamentals` went from a keyed record to an array of active filters; an
  // older saved config (record / missing) is dropped to an empty list.
  const fundamentals = Array.isArray(saved.fundamentals) ? saved.fundamentals : [];
  return { ...DEFAULT_CONFIG, ...cfg, fundamentals };
}

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

  // Selection-rules fundamentals → universe range filters (only the filters the
  // user added; margins entered as % are stored as fractions ÷ 100).
  for (const f of cfg.fundamentals) {
    const meta = FIELD_BY_KEY.get(f.key);
    if (!meta) continue;
    const div = meta.kind === 'pct' ? 100 : 1;
    const range: RangeFilter = {};
    if (f.min !== '') range.min = Number(f.min) / div;
    if (f.max !== '') range.max = Number(f.max) / div;
    if (range.min !== undefined || range.max !== undefined) universe[f.key] = range;
  }

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

/** Reverse of cfgToSpec: rebuild a BuilderConfig from a backend StrategySpec so
 *  a server-persisted strategy (e.g. one the AI assistant created) can be shown
 *  and opened in the builder. Best-effort — universe filters the builder form
 *  doesn't expose (dividend_yield, volatility_252d, the Capa-3 gaps, …) are NOT
 *  carried into the form and would be dropped on a re-save. Robust to the
 *  serialized spec's explicit `null`s; falls back to DEFAULT_CONFIG. */
export function specToConfig(spec: StrategySpec, name: string): BuilderConfig {
  const u = spec.universe ?? ({} as UniverseSpec);
  const ufields = u as Record<string, RangeFilter | null | undefined>;
  const ee = spec.entry_exit;
  const sel = spec.selection;
  const val = spec.validation;

  const fundamentals: FundamentalFilter[] = [];
  for (const def of SCREENER_FILTERS) {
    const rf = ufields[def.key];
    if (rf == null) continue;
    const mul = def.kind === 'pct' ? 100 : 1;
    const min = rf.min != null ? rf.min * mul : '';
    const max = rf.max != null ? rf.max * mul : '';
    if (min !== '' || max !== '') fundamentals.push({ key: def.key, min, max });
  }

  return {
    ...DEFAULT_CONFIG,
    name,
    performanceMetric: spec.general?.performance_metric ?? DEFAULT_CONFIG.performanceMetric,
    companySizes: (u.market_cap_category ?? []) as MarketCapBucket[],
    excluded: (u.exclude ?? []).map((id) => ({ symbolId: id, ticker: '', name: '' })),
    fundamentals,
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
