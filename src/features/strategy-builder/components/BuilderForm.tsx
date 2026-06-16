import { useMemo, useState } from 'react';

import { Icon } from '../icons';
import {
  MARKET_CAP_BUCKETS,
  PERFORMANCE_METRICS,
  RATING_OPTIONS,
  SECTORS_LIST,
  SORT_FIELDS,
} from '../mapping';
import type { BuilderConfig, WeightMethod } from '../types';
import { ExclusionPicker } from './ExclusionPicker';
import { NumField, Section, ToggleRow, Tip } from './formBits';

interface Props {
  initialCfg: BuilderConfig;
  busy?: boolean;
  onCancel: () => void;
  onSave: (cfg: BuilderConfig) => void;
  onSaveBacktest: (cfg: BuilderConfig) => void;
}

const WEIGHT_OPTIONS: { k: WeightMethod; n: string; d: string; disabled?: boolean }[] = [
  { k: 'equal', n: 'Equal weight', d: 'Every holding gets the same allocation.' },
  { k: 'rating_weighted', n: 'Rating-weighted', d: 'Higher-rated names get more capital.' },
  {
    k: 'market_cap',
    n: 'Market-cap weighted',
    d: 'Not available in backtest — no point-in-time valuation.',
    disabled: true,
  },
];

export function BuilderForm({ initialCfg, busy, onCancel, onSave, onSaveBacktest }: Props) {
  const [cfg, setCfg] = useState<BuilderConfig>(initialCfg);
  const [open, setOpen] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true,
    8: true,
  });
  const set = (patch: Partial<BuilderConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const toggleSection = (n: number) => setOpen((o) => ({ ...o, [n]: !o[n] }));

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!cfg.name.trim()) e.name = 'Name is required';
    if (cfg.topN < 1) e.topN = 'Must select at least 1';
    if (new Date(cfg.endDate) <= new Date(cfg.startDate)) e.endDate = 'End must be after start';
    if (cfg.oosSplit < 0 || cfg.oosSplit > 50) e.oosSplit = 'Must be 0–50%';
    if (cfg.minTrades < 1) e.minTrades = 'Must be ≥ 1';
    return e;
  }, [cfg]);

  const hasErrors = Object.keys(errors).length > 0;
  const canBacktest = !hasErrors && !busy;

  const checks = [
    { ok: !errors.name, label: 'Strategy name set' },
    { ok: !errors.endDate, label: 'Valid date range' },
    { ok: !errors.topN, label: 'At least 1 holding' },
    { ok: !errors.oosSplit, label: 'Out-of-sample split valid' },
  ];

  const weightLabel =
    cfg.weight === 'equal' ? 'Equal' : cfg.weight === 'rating_weighted' ? 'Rating' : 'Mkt cap';
  const metricLabel =
    PERFORMANCE_METRICS.find((m) => m.k === cfg.performanceMetric)?.label ?? cfg.performanceMetric;

  return (
    <div className="sb-build-grid">
      <div className="sb-form">
        {/* 1. General parameters */}
        <Section
          num="1"
          title="General parameters"
          sub="Holdings, rebalance, currency, performance, benchmark"
          open={open[1]}
          onToggle={() => toggleSection(1)}
        >
          <div className="sb-grid-3" style={{ marginTop: 14 }}>
            <NumField
              label="Number of holdings"
              tip="How many names the strategy holds at once (the top N after ranking)."
              value={cfg.topN}
              onChange={(v) => set({ topN: typeof v === 'number' ? v : 1 })}
              min={1}
              error={errors.topN}
            />
            <div className="sb-field" style={{ marginTop: 0 }}>
              <div className="sb-field-label">Rebalance</div>
              <div className="sb-segment full" style={{ marginTop: 2 }}>
                {(['weekly', 'monthly'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`sb-seg-btn ${cfg.rebalance === k ? 'active' : ''}`}
                    onClick={() => set({ rebalance: k })}
                  >
                    {k === 'weekly' ? 'Weekly' : 'Monthly'}
                  </button>
                ))}
              </div>
            </div>
            <div className="sb-field" style={{ marginTop: 0 }}>
              <div className="sb-field-label">
                Currency <Tip text="Locked to USD — the strategy invests in US equities only for now." />
              </div>
              <div className="sb-select-wrap">
                <select className="sb-select" value="USD" disabled>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div className="sb-field" style={{ marginTop: 0 }}>
              <div className="sb-field-label">
                Performance <Tip text="The metric the strategy is compared to the benchmark on." />
              </div>
              <div className="sb-select-wrap">
                <select
                  className="sb-select"
                  value={cfg.performanceMetric}
                  onChange={(e) =>
                    set({ performanceMetric: e.target.value as BuilderConfig['performanceMetric'] })
                  }
                >
                  {PERFORMANCE_METRICS.map((m) => (
                    <option key={m.k} value={m.k}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="sb-field" style={{ marginTop: 0 }}>
              <div className="sb-field-label">
                Benchmark <Tip text="Locked to the S&P 500 (SPY) — the only benchmark wired right now." />
              </div>
              <div className="sb-select-wrap">
                <select className="sb-select" value="SPY" disabled>
                  <option value="SPY">S&amp;P 500</option>
                </select>
              </div>
            </div>
          </div>
        </Section>

        {/* 2. Investment universe */}
        <Section
          num="2"
          title="Investment universe"
          sub="Instrument, country, size, exclusions"
          open={open[2]}
          onToggle={() => toggleSection(2)}
        >
          <div className="sb-grid-2" style={{ marginTop: 14 }}>
            <div className="sb-field" style={{ marginTop: 0 }}>
              <div className="sb-field-label">
                Instrument type <Tip text="Locked to stocks — the engine trades single-name US equities." />
              </div>
              <div className="sb-select-wrap">
                <select className="sb-select" value="stocks" disabled>
                  <option value="stocks">Stocks</option>
                </select>
              </div>
            </div>
            <div className="sb-field" style={{ marginTop: 0 }}>
              <div className="sb-field-label">
                Country <Tip text="Locked to the US — the only market wired right now." />
              </div>
              <div className="sb-select-wrap">
                <select className="sb-select" value="US" disabled>
                  <option value="US">United States</option>
                </select>
              </div>
            </div>
          </div>
          <div className="sb-field">
            <div className="sb-field-label">
              Company size <Tip text="Filter by market-cap bucket (point-in-time). Leave all off for any size." />
            </div>
            <div className="sb-size-grid">
              {MARKET_CAP_BUCKETS.map((b) => {
                const on = cfg.companySizes.includes(b.k);
                return (
                  <button
                    key={b.k}
                    type="button"
                    className={`sb-size-pill ${on ? 'active' : ''}`}
                    onClick={() =>
                      set({
                        companySizes: on
                          ? cfg.companySizes.filter((x) => x !== b.k)
                          : [...cfg.companySizes, b.k],
                      })
                    }
                  >
                    <span className="pn">{b.label}</span>
                    <span className="ph">{b.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <ExclusionPicker value={cfg.excluded} onChange={(v) => set({ excluded: v })} />
          </div>
        </Section>

        {/* 3. Universe */}
        <Section num="3" title="Universe" sub="Which stocks are eligible" open={open[3]} onToggle={() => toggleSection(3)}>
          <div className="sb-grid-3" style={{ marginTop: 14 }}>
            <div className="sb-field" style={{ marginTop: 0 }}>
              <div className="sb-field-label">Sector</div>
              <div className="sb-select-wrap">
                <select className="sb-select" value={cfg.sector} onChange={(e) => set({ sector: e.target.value })}>
                  <option value="">All sectors</option>
                  {SECTORS_LIST.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="sb-field" style={{ marginTop: 0 }}>
              <div className="sb-field-label">
                Minimum rating <Tip text="Only names with a TrendRating at or above this (−3 strong sell … +3 strong buy) are eligible." />
              </div>
              <div className="sb-select-wrap">
                <select
                  className="sb-select"
                  value={cfg.minRating}
                  onChange={(e) => set({ minRating: parseInt(e.target.value, 10) })}
                >
                  {RATING_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r > 0 ? `+${r}` : r} or better
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <NumField
              label="Min. trend strength"
              tip="Optional floor on trend strength. Leave blank for no filter."
              value={cfg.minTrendStrength}
              onChange={(v) => set({ minTrendStrength: v })}
              hint="optional"
            />
          </div>
          <div className="sb-universe-result">
            <Icon name="check" size={15} />
            <span>
              Backtests screen on <b>point-in-time-safe</b> fields only (rating, momentum, trend, technicals). Fundamentals are excluded — they have no historical as-of value.
            </span>
          </div>
        </Section>

        {/* 4. Entry & Exit */}
        <Section num="4" title="Entry & Exit rules" sub="Trade-state parameters" open={open[4]} onToggle={() => toggleSection(4)}>
          <div className="sb-grid-2" style={{ marginTop: 14 }}>
            <NumField
              label="Min. efficiency ratio"
              tip="Kaufman efficiency ratio (0–1). Higher = cleaner trend. Only enter names above this threshold."
              value={cfg.minEr}
              onChange={(v) => set({ minEr: typeof v === 'number' ? v : 0 })}
              min={0}
              max={1}
              step={0.05}
              hint="0 = choppy, 1 = perfect trend"
            />
            <NumField
              label="Exit rating (long)"
              tip="Close a long position when the symbol's rating falls to or below this level."
              value={cfg.exitRatingLong}
              onChange={(v) => set({ exitRatingLong: typeof v === 'number' ? v : -1 })}
              min={-3}
              max={3}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <ToggleRow
              name="Trailing stop"
              tip="Exit automatically if price falls a set ATR multiple below its peak since entry."
              desc={cfg.useTrailStop ? `Active — exit at ${cfg.trailAtrMult}× ATR from peak` : 'Disabled'}
              on={cfg.useTrailStop}
              onToggle={() => set({ useTrailStop: !cfg.useTrailStop })}
            />
          </div>
          {cfg.useTrailStop && (
            <div style={{ marginTop: 14, maxWidth: 260 }}>
              <NumField
                label="Trailing stop (ATR ×)"
                tip="How many ATRs below the running peak the stop sits."
                value={cfg.trailAtrMult}
                onChange={(v) => set({ trailAtrMult: typeof v === 'number' ? v : 3 })}
                min={0.5}
                max={10}
                step={0.5}
                suffix="× ATR"
              />
            </div>
          )}
        </Section>

        {/* 5. Selection */}
        <Section num="5" title="Selection" sub="Rank and pick from the universe" open={open[5]} onToggle={() => toggleSection(5)}>
          <div className="sb-grid-2" style={{ marginTop: 14 }}>
            <div className="sb-field" style={{ marginTop: 0 }}>
              <div className="sb-field-label">Rank by</div>
              <div className="sb-select-wrap">
                <select className="sb-select" value={cfg.sortBy} onChange={(e) => set({ sortBy: e.target.value })}>
                  {SORT_FIELDS.map((f) => (
                    <option key={f.k} value={f.k}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <NumField
              label="Max per sector"
              tip="Cap how many names from a single sector can be held. Only applies when the cap is on."
              value={cfg.maxPerSector}
              onChange={(v) => set({ maxPerSector: typeof v === 'number' ? v : 5 })}
              min={1}
              hint={cfg.perSector ? '' : 'enable cap below'}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <ToggleRow
              name="Cap exposure per sector"
              tip="Prevents the strategy from loading up on a single sector."
              desc="Diversify by limiting names from any one sector"
              on={cfg.perSector}
              onToggle={() => set({ perSector: !cfg.perSector })}
            />
          </div>
        </Section>

        {/* 6. Weighting */}
        <Section num="6" title="Weighting" sub="How capital is allocated" open={open[6]} onToggle={() => toggleSection(6)}>
          <div className="sb-radio-grid">
            {WEIGHT_OPTIONS.map((o) => (
              <button
                key={o.k}
                type="button"
                className={`sb-radio-card ${cfg.weight === o.k ? 'active' : ''}`}
                disabled={o.disabled}
                style={o.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                onClick={() => !o.disabled && set({ weight: o.k })}
              >
                <div className="sb-radio-card-head">
                  <span className="sb-radio-dot" />
                  <span className="sb-radio-name">{o.n}</span>
                </div>
                <div className="sb-radio-desc">{o.d}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* 7. Costs */}
        <Section num="7" title="Costs" sub="Trading frictions applied to every fill" open={open[7]} onToggle={() => toggleSection(7)}>
          <div className="sb-grid-2" style={{ marginTop: 14, maxWidth: 420 }}>
            <NumField
              label="Commission"
              tip="Per-trade commission in basis points (1 bp = 0.01%)."
              value={cfg.commission}
              onChange={(v) => set({ commission: typeof v === 'number' ? v : 0 })}
              min={0}
              suffix="bps"
            />
            <NumField
              label="Slippage"
              tip="Assumed execution slippage in basis points."
              value={cfg.slippage}
              onChange={(v) => set({ slippage: typeof v === 'number' ? v : 0 })}
              min={0}
              suffix="bps"
            />
          </div>
        </Section>

        {/* 8. Validation */}
        <Section num="8" title="Validation window" sub="Backtest period and robustness checks" open={open[8]} onToggle={() => toggleSection(8)}>
          <div className="sb-grid-2" style={{ marginTop: 14 }}>
            <div className="sb-field" style={{ marginTop: 0 }}>
              <div className="sb-field-label">Start date</div>
              <input type="date" className="sb-input mono" value={cfg.startDate} onChange={(e) => set({ startDate: e.target.value })} />
            </div>
            <div className="sb-field" style={{ marginTop: 0 }}>
              <div className="sb-field-label">End date</div>
              <input
                type="date"
                className={`sb-input mono ${errors.endDate ? 'error' : ''}`}
                value={cfg.endDate}
                onChange={(e) => set({ endDate: e.target.value })}
              />
              {errors.endDate && (
                <div className="sb-field-error">
                  <Icon name="warn" size={11} /> {errors.endDate}
                </div>
              )}
            </div>
            <NumField
              label="Out-of-sample split"
              tip="Reserve this % of the window (most recent) for out-of-sample testing."
              value={cfg.oosSplit}
              onChange={(v) => set({ oosSplit: typeof v === 'number' ? v : 0 })}
              min={0}
              max={50}
              suffix="%"
              error={errors.oosSplit}
              hint="reserved for OOS test"
            />
            <NumField
              label="Min. trades threshold"
              tip="If the backtest produces fewer trades than this, results are flagged as low-confidence."
              value={cfg.minTrades}
              onChange={(v) => set({ minTrades: typeof v === 'number' ? v : 1 })}
              min={1}
              error={errors.minTrades}
              hint="below this = low confidence"
            />
          </div>
        </Section>
      </div>

      {/* SUMMARY */}
      <div className="sb-summary">
        <div className="sb-summary-card">
          <div className="sb-summary-title">Strategy</div>
          <input className="sb-name-input" value={cfg.name} onChange={(e) => set({ name: e.target.value })} placeholder="Strategy name" />
          <div className="sb-summary-row">
            <span className="k">Min rating</span>
            <span className="v">{cfg.minRating > 0 ? `+${cfg.minRating}` : cfg.minRating}</span>
          </div>
          <div className="sb-summary-row">
            <span className="k">Holds</span>
            <span className="v">Top {cfg.topN}</span>
          </div>
          <div className="sb-summary-row">
            <span className="k">Weighting</span>
            <span className="v">{weightLabel}</span>
          </div>
          <div className="sb-summary-row">
            <span className="k">Rebalance</span>
            <span className="v">{cfg.rebalance === 'weekly' ? 'Weekly' : 'Monthly'}</span>
          </div>
          <div className="sb-summary-row">
            <span className="k">Performance</span>
            <span className="v">{metricLabel}</span>
          </div>
          <div className="sb-summary-row">
            <span className="k">Costs</span>
            <span className="v">{cfg.commission + cfg.slippage} bps</span>
          </div>
        </div>

        <div className="sb-summary-card">
          <div className="sb-summary-title">Pre-flight checks</div>
          <div className="sb-validation-list">
            {checks.map((c, i) => (
              <div key={i} className={`sb-validation-item ${c.ok ? 'ok' : 'err'}`}>
                <span className="vi-ic">
                  <Icon name={c.ok ? 'check' : 'x'} size={14} />
                </span>
                {c.label}
              </div>
            ))}
          </div>
        </div>

        <div className="sb-cta-col">
          <button type="button" className="sb-btn accent" disabled={!canBacktest} onClick={() => onSaveBacktest(cfg)}>
            <Icon name="play" size={14} /> {busy ? 'Running…' : 'Save & backtest'}
          </button>
          <button type="button" className="sb-btn" disabled={busy} onClick={() => onSave(cfg)}>
            Save draft
          </button>
          <button type="button" className="sb-btn" onClick={onCancel} style={{ border: 0, background: 'none' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
