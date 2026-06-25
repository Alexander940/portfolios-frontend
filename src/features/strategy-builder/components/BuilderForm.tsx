import { useMemo, useState } from 'react';

import { Icon } from '../icons';
import {
  buildUniverse,
  FILTER_CATEGORIES,
  formatFilterRange,
  LAYER3_OPTIONS,
  MARKET_CAP_BUCKETS,
  PERFORMANCE_METRICS,
  SCREENER_FILTERS,
  SORT_FIELDS,
} from '../mapping';
import type { BuilderConfig, ScreenerFieldKey } from '../types';
import { ExclusionPicker } from './ExclusionPicker';
import { NumField, Section, Tip } from './formBits';
import { SectorWeighting } from './SectorWeighting';
import { FilterChip, SelectionFilterModal } from './SelectionFilterModal';

interface Props {
  initialCfg: BuilderConfig;
  busy?: boolean;
  onCancel: () => void;
  onSave: (cfg: BuilderConfig) => void;
  onSaveBacktest: (cfg: BuilderConfig) => void;
}

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
  });
  const set = (patch: Partial<BuilderConfig>) => setCfg((c) => ({ ...c, ...patch }));
  // Which Selection-rules filter the modal is editing (null = closed).
  const [editingKey, setEditingKey] = useState<ScreenerFieldKey | null>(null);
  const removeFund = (key: ScreenerFieldKey) =>
    setCfg((c) => ({ ...c, fundamentals: c.fundamentals.filter((f) => f.key !== key) }));
  // Add-or-update a filter from the modal: no bounds → not stored (removed);
  // existing key keeps its position; new key is appended.
  const upsertFund = (key: ScreenerFieldKey, min: number | '', max: number | '') =>
    setCfg((c) => {
      if (min === '' && max === '') {
        return { ...c, fundamentals: c.fundamentals.filter((f) => f.key !== key) };
      }
      if (c.fundamentals.some((f) => f.key === key)) {
        return {
          ...c,
          fundamentals: c.fundamentals.map((f) => (f.key === key ? { key, min, max } : f)),
        };
      }
      return { ...c, fundamentals: [...c.fundamentals, { key, min, max }] };
    });
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

  const layer3Label = LAYER3_OPTIONS.find((o) => o.k === cfg.layer3Method)?.n ?? 'Equal weight';
  const hasTilts = Object.keys(cfg.sectorDeltas ?? {}).length > 0;
  const weightLabel = `Sector → ${layer3Label}${hasTilts ? ' (tilted)' : ''}`;
  const metricLabel =
    PERFORMANCE_METRICS.find((m) => m.k === cfg.performanceMetric)?.label ?? cfg.performanceMetric;
  const rankLabel = SORT_FIELDS.find((f) => f.k === cfg.sortBy)?.label ?? cfg.sortBy;

  // Selection rules is dynamic: the add-selector offers only fields the user
  // hasn't added yet; the modal edits whichever field `editingKey` points at.
  const activeFundKeys = new Set(cfg.fundamentals.map((f) => f.key));
  const availableFundamentals = SCREENER_FILTERS.filter((f) => !activeFundKeys.has(f.key));
  const editingDef = editingKey ? SCREENER_FILTERS.find((f) => f.key === editingKey) ?? null : null;
  const editingFilter = editingKey ? cfg.fundamentals.find((f) => f.key === editingKey) ?? null : null;

  return (
    <div className="sb-build-grid">
      <div className="sb-form">
        {/* 1. General parameters */}
        <Section
          num="1"
          title="General parameters"
          sub="Rebalance, currency, performance, benchmark"
          open={open[1]}
          onToggle={() => toggleSection(1)}
        >
          <div className="sb-grid-3" style={{ marginTop: 14 }}>
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

        {/* 3. Selection rules */}
        <Section
          num="3"
          title="Selection rules"
          sub="Fundamental + performance filters (point-in-time)"
          open={open[3]}
          onToggle={() => toggleSection(3)}
        >
          <div className="sb-universe-result">
            <Icon name="check" size={15} />
            <span>
              Screener fields evaluated <b>as-of each rebalance</b> — fundamentals from
              quarterly filings (90-day reporting lag), performance from price history.
              Add the fields you want to filter by; leave a bound blank for one-sided.
            </span>
          </div>
          {cfg.fundamentals.length > 0 && (
            <div className="sb-chips" style={{ marginTop: 14 }}>
              {cfg.fundamentals.map((active) => {
                const meta = SCREENER_FILTERS.find((f) => f.key === active.key);
                if (!meta) return null;
                return (
                  <FilterChip
                    key={active.key}
                    label={meta.label}
                    value={formatFilterRange(active.min, active.max, meta)}
                    onClick={() => setEditingKey(active.key)}
                    onRemove={() => removeFund(active.key)}
                  />
                );
              })}
            </div>
          )}
          {availableFundamentals.length > 0 ? (
            <div className="sb-fund-add">
              <div className="sb-select-wrap">
                <select
                  className="sb-select"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setEditingKey(e.target.value as ScreenerFieldKey);
                  }}
                >
                  <option value="">+ Add a filter…</option>
                  {FILTER_CATEGORIES.map((cat) => {
                    const opts = availableFundamentals.filter((f) => f.category === cat);
                    return opts.length === 0 ? null : (
                      <optgroup key={cat} label={cat}>
                        {opts.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              {cfg.fundamentals.length === 0 && (
                <span className="sb-fund-add-hint">No filters yet — pick a field to add one.</span>
              )}
            </div>
          ) : (
            <div className="sb-fund-add-hint" style={{ marginTop: 12 }}>
              All available fields added.
            </div>
          )}
        </Section>

        {editingKey && editingDef && (
          <SelectionFilterModal
            key={editingKey}
            def={editingDef}
            initialMin={editingFilter?.min ?? ''}
            initialMax={editingFilter?.max ?? ''}
            exists={!!editingFilter}
            onApply={(min, max) => {
              upsertFund(editingKey, min, max);
              setEditingKey(null);
            }}
            onRemove={() => {
              removeFund(editingKey);
              setEditingKey(null);
            }}
            onClose={() => setEditingKey(null)}
          />
        )}

        {/* 4. Ranking */}
        <Section
          num="4"
          title="Ranking"
          sub="Order the filtered universe, then keep the top N"
          open={open[4]}
          onToggle={() => toggleSection(4)}
        >
          <div className="sb-universe-result">
            <Icon name="check" size={15} />
            <span>
              After the filters, the universe is ranked by your chosen field{' '}
              <b>as-of each rebalance</b> and cut to the number of holdings.{' '}
              <b>Market Cap</b> and <b>Alpha</b> are point-in-time from 2015 onward;
              the technical fields go deeper.
            </span>
          </div>
          <div className="sb-grid-3" style={{ marginTop: 14 }}>
            <div className="sb-field" style={{ marginTop: 0 }}>
              <div className="sb-field-label">
                Rank by{' '}
                <Tip text="The parameter the filtered universe is ordered by before taking the top N." />
              </div>
              <div className="sb-select-wrap">
                <select
                  className="sb-select"
                  value={cfg.sortBy}
                  onChange={(e) => set({ sortBy: e.target.value })}
                >
                  {SORT_FIELDS.map((f) => (
                    <option key={f.k} value={f.k}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="sb-field" style={{ marginTop: 0 }}>
              <div className="sb-field-label">
                Direction{' '}
                <Tip text="Highest first keeps the top scorers (e.g. largest market cap, highest alpha)." />
              </div>
              <div className="sb-segment full" style={{ marginTop: 2 }}>
                {(['desc', 'asc'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`sb-seg-btn ${cfg.sortOrder === k ? 'active' : ''}`}
                    onClick={() => set({ sortOrder: k })}
                  >
                    {k === 'desc' ? 'Highest first' : 'Lowest first'}
                  </button>
                ))}
              </div>
            </div>
            <NumField
              label="Number of holdings"
              tip="How many names the strategy holds at once (the top N after ranking)."
              value={cfg.topN}
              onChange={(v) => set({ topN: typeof v === 'number' ? v : 1 })}
              min={1}
              error={errors.topN}
            />
          </div>
        </Section>

        {/* 5. Weighting — layered: sector base → alpha tilt → intra-sector method */}
        <Section
          num="5"
          title="Weighting"
          sub="Sector base → alpha tilt → stock weighting"
          open={open[5]}
          onToggle={() => toggleSection(5)}
        >
          <SectorWeighting
            universe={buildUniverse(cfg)}
            enabled={!!open[5]}
            layer3Method={cfg.layer3Method}
            layer3Gamma={cfg.layer3Gamma}
            sectorDeltas={cfg.sectorDeltas}
            onChange={set}
          />
        </Section>

        {/* 6. Costs */}
        <Section num="6" title="Costs" sub="Trading frictions applied to every fill" open={open[6]} onToggle={() => toggleSection(6)}>
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

        {/* 7. Validation */}
        <Section num="7" title="Validation window" sub="Backtest period and robustness checks" open={open[7]} onToggle={() => toggleSection(7)}>
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
            <span className="k">Ranked by</span>
            <span className="v">
              {rankLabel} {cfg.sortOrder === 'asc' ? '↑' : '↓'}
            </span>
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
