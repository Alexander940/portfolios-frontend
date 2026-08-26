import { useMemo, useState } from 'react';

import { Icon } from '../icons';
import {
  buildUniverse,
  CADENCE_OPTIONS,
  LAYER3_OPTIONS,
  MARKET_CAP_BUCKETS,
  PERFORMANCE_METRICS,
  REBALANCE_ON_OPTIONS,
  SORT_FIELDS,
} from '../mapping';
import type { BuilderConfig } from '../types';
import { ExclusionPicker } from './ExclusionPicker';
import { FundamentalFilterGroup } from './FundamentalFilterGroup';
import { NumField, Section, ToggleRow, Tip } from './formBits';
import { SectorWeighting } from './SectorWeighting';

interface Props {
  initialCfg: BuilderConfig;
  busy?: boolean;
  /** Universe filters the strategy carries that this form does NOT expose
   *  (live-only: dividend_yield, vol caps…). Shown read-only; they are
   *  preserved on save via the spec merge (issue #59, #34 gap). */
  preservedFilters?: string[];
  onCancel: () => void;
  onSave: (cfg: BuilderConfig) => void;
  onSaveBacktest: (cfg: BuilderConfig) => void;
}

export function BuilderForm({ initialCfg, busy, preservedFilters, onCancel, onSave, onSaveBacktest }: Props) {
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
    // Mirrors the backend validation for min_position_weight: fraction in
    // (0, 1) and strictly below the max when both are set (422 otherwise).
    if (cfg.minPositionWeight !== '') {
      if (cfg.minPositionWeight <= 0 || cfg.minPositionWeight >= 100) {
        e.minPositionWeight = 'Must be between 0 and 100';
      } else if (
        cfg.maxPositionWeight !== '' &&
        cfg.minPositionWeight >= cfg.maxPositionWeight
      ) {
        e.minPositionWeight = 'Must be below the max weight';
      }
    }
    // Reglas de rebalanceo (épica #154) — se validan aquí con los MISMOS rangos
    // que los validators de Pydantic, para que el usuario vea el error en el
    // formulario en vez de comerse un 422 al guardar.
    const pctRule = (v: number | '', key: string, maxInclusive = false) => {
      if (v === '') return;
      const overMax = maxInclusive ? v > 100 : v >= 100;
      if (v <= 0 || overMax) e[key] = maxInclusive ? 'Must be between 0 and 100' : 'Must be above 0 and below 100';
    };
    if (cfg.holdRankBuffer !== '' && cfg.holdRankBuffer <= 1) {
      e.holdRankBuffer = 'Must be above 1 (1.0 = no buffer — leave empty instead)';
    }
    if (cfg.minHoldingDays !== '' && cfg.minHoldingDays < 1) e.minHoldingDays = 'Must be at least 1 day';
    if (cfg.maxEntriesPerRebalance !== '' && cfg.maxEntriesPerRebalance < 1) {
      e.maxEntriesPerRebalance = 'Must be at least 1';
    }
    if (cfg.exitOnStalePriceDays !== '' && cfg.exitOnStalePriceDays < 0) {
      e.exitOnStalePriceDays = 'Cannot be negative';
    }
    if (cfg.trailingStopAtr !== '' && cfg.trailingStopAtr <= 0) e.trailingStopAtr = 'Must be above 0';
    pctRule(cfg.maxTurnoverPct, 'maxTurnoverPct', true); // (0, 100] en el backend
    pctRule(cfg.cashBufferPct, 'cashBufferPct');
    pctRule(cfg.minTradePct, 'minTradePct');
    pctRule(cfg.driftBandPct, 'driftBandPct');
    pctRule(cfg.stopLossPct, 'stopLossPct');
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
  const cadenceLabel = CADENCE_OPTIONS.find((o) => o.k === cfg.rebalance)?.label ?? cfg.rebalance;

  return (
    <div className="sb-build-grid">
      <div className="sb-form">
        {preservedFilters && preservedFilters.length > 0 && (
          <div className="sb-preserved-note">
            <Icon name="warn" size={13} />
            <span>
              This strategy carries {preservedFilters.length} live-only filter
              {preservedFilters.length > 1 ? 's' : ''} this form does not show (
              {preservedFilters.join(', ')}). They are preserved when you save or
              backtest — only the fields below are editable here.
            </span>
          </div>
        )}
        {/* 1. General parameters */}
        <Section
          num="1"
          title="General parameters"
          sub="Currency, performance, benchmark"
          open={open[1]}
          onToggle={() => toggleSection(1)}
        >
          <div className="sb-grid-3" style={{ marginTop: 14 }}>
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
          sub="Instrument, country, size, exclusions, additional rules"
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
          <div className="sb-field">
            <div className="sb-field-label">
              Additional rules{' '}
              <Tip text="Fundamental / performance filters that CONSTRAIN the universe — they shape which names are eligible and the sector weighting base. Evaluated point-in-time at each rebalance." />
            </div>
            <FundamentalFilterGroup
              section="universe"
              filters={cfg.additionalRules}
              onChange={(v) => set({ additionalRules: v })}
              emptyHint="No universe filters yet — pick a field to add one."
            />
          </div>
        </Section>

        {/* 3. Selection rules */}
        <Section
          num="3"
          title="Selection rules"
          sub="Post-universe filters — narrow the picks, not the universe"
          open={open[3]}
          onToggle={() => toggleSection(3)}
        >
          <div className="sb-universe-result">
            <Icon name="check" size={15} />
            <span>
              Applied <b>after</b> the universe is resolved — a later phase that
              narrows which names are ranked and picked. Unlike <b>Additional rules</b>,
              these do <b>not</b> change the universe or the sector weighting base. Same
              fields, evaluated point-in-time at each rebalance; leave a bound blank for
              one-sided.
            </span>
          </div>
          <FundamentalFilterGroup
            section="selection"
            filters={cfg.selectionFilters}
            onChange={(v) => set({ selectionFilters: v })}
            emptyHint="No selection filters yet — pick a field to add one."
          />
        </Section>

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
            layer1Method={cfg.layer1Method}
            layer1TopN={cfg.layer1TopN}
            layer3Method={cfg.layer3Method}
            layer3Gamma={cfg.layer3Gamma}
            sectorDeltas={cfg.sectorDeltas}
            sectorCaps={cfg.sectorCaps}
            onChange={set}
          />
          <div style={{ marginTop: 18, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 240 }}>
              <NumField
                label="Max weight per stock"
                tip="No single position may exceed this share of the portfolio. The excess is redistributed to the other names; if the cap is too small to fill the book (e.g. 5 names at 10%) the remainder stays in cash. Leave empty for no per-stock limit."
                value={cfg.maxPositionWeight}
                onChange={(v) => set({ maxPositionWeight: v })}
                min={0}
                max={100}
                step={0.5}
                suffix="%"
                hint="Empty = uncapped"
              />
            </div>
            <div style={{ width: 240 }}>
              <NumField
                label="Min weight per stock"
                tip="Positions that do not reach this share of the portfolio are dropped and their weight is redistributed among the remaining names — the book may end up with fewer positions than the top-N. Must be below the max weight. Leave empty for no minimum."
                value={cfg.minPositionWeight}
                onChange={(v) => set({ minPositionWeight: v })}
                min={0}
                max={100}
                step={0.5}
                suffix="%"
                hint="Empty = no minimum"
                error={errors.minPositionWeight}
              />
            </div>
          </div>
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

        {/* 8. Rebalancing */}
        <Section
          num="8"
          title="Rebalancing"
          sub="How the book moves between rebalances"
          open={open[8]}
          onToggle={() => toggleSection(8)}
        >
          <div className="sb-field" style={{ marginTop: 14 }}>
            <div className="sb-field-label">
              Cadence <Tip text="How often the book is re-priced and re-sized. Longer cadences trade less often, cutting turnover and cost drag at the expense of reacting slower to new signals." />
            </div>
            <div className="sb-segment full" style={{ marginTop: 2 }} data-testid="sb-rebalance-cadence">
              {CADENCE_OPTIONS.map((o) => (
                <button
                  key={o.k}
                  type="button"
                  data-testid={`sb-cadence-${o.k}`}
                  className={`sb-seg-btn ${cfg.rebalance === o.k ? 'active' : ''}`}
                  onClick={() => set({ rebalance: o.k })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="sb-field">
            <div className="sb-field-label">
              Fires on <Tip text="Which trading day of the period the rebalance is stamped on: the first session of the period, or the last. Start of period reproduces the engine's original behavior." />
            </div>
            <div className="sb-segment full" style={{ marginTop: 2 }} data-testid="sb-rebalance-on">
              {REBALANCE_ON_OPTIONS.map((o) => (
                <button
                  key={o.k}
                  type="button"
                  data-testid={`sb-rebalance-on-${o.k}`}
                  className={`sb-seg-btn ${cfg.rebalanceOn === o.k ? 'active' : ''}`}
                  onClick={() => set({ rebalanceOn: o.k })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* --- Permanencia en cartera ------------------------------------ */}
          <div className="sb-subhead" style={{ marginTop: 18 }}>
            Holding rules
            <Tip text="Which names survive a rebalance. Without these, a name that slips one place in the ranking is sold and often re-bought the next month — pure churn, and the bulk of a strategy's turnover." />
          </div>
          <div className="sb-grid-2" style={{ marginTop: 10 }}>
            <NumField
              label="Rank buffer for held names"
              tip="A name you already hold is only sold once its rank falls beyond top-N × this multiplier. With top-N 30 and a buffer of 1.5, a holding survives down to rank 45. It keeps occupying a top-N slot, so the book never grows. Leave empty for the plain cutoff."
              value={cfg.holdRankBuffer}
              onChange={(v) => set({ holdRankBuffer: v })}
              min={1}
              step={0.1}
              suffix="×"
              hint="Empty = plain top-N cutoff"
              error={errors.holdRankBuffer}
            />
            <NumField
              label="Max new entries per rebalance"
              tip="Hard cap on how many NEW names may enter in a single rebalance, taken in ranking order. BACKTEST ONLY: live trackers ignore it (it needs per-position entry dates that only the backtest engine keeps)."
              value={cfg.maxEntriesPerRebalance}
              onChange={(v) => set({ maxEntriesPerRebalance: v })}
              min={1}
              step={1}
              hint="Backtest only · empty = no cap"
              error={errors.maxEntriesPerRebalance}
            />
            <NumField
              label="Minimum holding period"
              tip="A position cannot be sold before this many days. It still exits if it stops matching the universe filters, or on a stop. BACKTEST ONLY: live trackers ignore it."
              value={cfg.minHoldingDays}
              onChange={(v) => set({ minHoldingDays: v })}
              min={1}
              step={1}
              suffix="days"
              hint="Backtest only · empty = no lockup"
              error={errors.minHoldingDays}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <ToggleRow
              name="Prioritise current holdings"
              desc="Names you already hold and that still pass the filters enter the target unconditionally; new candidates compete for the slots left over."
              tip="Stronger than the rank buffer: there is no rank cutoff at all for a holding. If the holdings alone already fill top-N, no new name enters and the book may exceed top-N. A holding that stops matching the filters is still sold."
              on={cfg.prioritizeHeld}
              onToggle={() => set({ prioritizeHeld: !cfg.prioritizeHeld })}
            />
          </div>

          {/* --- Ejecución -------------------------------------------------- */}
          <div className="sb-subhead" style={{ marginTop: 18 }}>
            Execution limits
            <Tip text="How much the book is allowed to move once the new target is known. Unspent budget stays in the current names or in cash — it is never redistributed." />
          </div>
          <div className="sb-grid-2" style={{ marginTop: 10 }}>
            <NumField
              label="Max turnover per rebalance"
              tip="Ceiling on how much of the book may trade in one rebalance. Forced exits (a name that left the filters) always execute; then new entries fill in target-weight order until the budget runs out; resizes go last."
              value={cfg.maxTurnoverPct}
              onChange={(v) => set({ maxTurnoverPct: v })}
              min={0}
              max={100}
              step={1}
              suffix="%"
              hint="Empty = unlimited"
              error={errors.maxTurnoverPct}
            />
            <NumField
              label="Skip rebalance within drift band"
              tip="If no holding has drifted more than this many percentage points from its target weight, the whole rebalance is skipped — no new target, no trades. The very first rebalance always runs."
              value={cfg.driftBandPct}
              onChange={(v) => set({ driftBandPct: v })}
              min={0}
              max={100}
              step={0.5}
              suffix="pp"
              hint="Empty = always rebalance"
              error={errors.driftBandPct}
            />
            <NumField
              label="Cash buffer"
              tip="Share of the portfolio deliberately left uninvested. Applied after the per-name floor and cap; the cash is not reinvested until the next rebalance."
              value={cfg.cashBufferPct}
              onChange={(v) => set({ cashBufferPct: v })}
              min={0}
              max={100}
              step={0.5}
              suffix="%"
              hint="Empty = fully invested"
              error={errors.cashBufferPct}
            />
            <NumField
              label="Minimum trade size"
              tip="Differences smaller than this share of the portfolio are not traded — the position is left as it is. A full exit always executes, however small."
              value={cfg.minTradePct}
              onChange={(v) => set({ minTradePct: v })}
              min={0}
              max={100}
              step={0.1}
              suffix="%"
              hint="Empty = trade any difference"
              error={errors.minTradePct}
            />
          </div>

          {/* --- Salidas fuera de calendario -------------------------------- */}
          <div className="sb-subhead" style={{ marginTop: 18 }}>
            Off-calendar exits
            <Tip text="Without these a strategy can only sell on a rebalance date, whatever happens in between." />
          </div>
          <div className="sb-grid-2" style={{ marginTop: 10 }}>
            <NumField
              label="Stop loss"
              tip="Sell a position on any day once it has fallen this much from its average cost. Checked daily at the close and filled at the next open, net of costs; the cash waits for the next rebalance."
              value={cfg.stopLossPct}
              onChange={(v) => set({ stopLossPct: v })}
              min={0}
              max={100}
              step={1}
              suffix="%"
              hint="Empty = no stop"
              error={errors.stopLossPct}
            />
            <NumField
              label="Trailing stop (ATR)"
              tip="A stop that follows the price up and never comes back down: it sits this many ATRs below the highest close since entry. The ATR is read as of the simulated date, never a later one."
              value={cfg.trailingStopAtr}
              onChange={(v) => set({ trailingStopAtr: v })}
              min={0}
              step={0.5}
              suffix="× ATR"
              hint="Empty = no trailing stop"
              error={errors.trailingStopAtr}
            />
            <NumField
              label="Exit on dead price feed"
              tip="Sell a holding whose price feed has not moved for this many days — a renamed ticker, a delisting not yet flagged, a frozen provider. Applies to live trackers; a backtest keeps delisted names on purpose, otherwise it would be measuring only today's survivors."
              value={cfg.exitOnStalePriceDays}
              onChange={(v) => set({ exitOnStalePriceDays: v })}
              min={0}
              step={1}
              suffix="days"
              hint="Live tracker only · empty = off"
              error={errors.exitOnStalePriceDays}
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
            <span className="k">Filters</span>
            <span className="v">
              {cfg.additionalRules.length + cfg.selectionFilters.length || 'none'}
            </span>
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
            <span className="v">{cadenceLabel}</span>
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
