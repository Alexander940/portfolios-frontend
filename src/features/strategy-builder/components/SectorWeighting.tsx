// Layered weighting panel (section 5): Layer 1 (sector base, locked) → Layer 2
// (sector tilt by alpha, locked) → Layer 3 (intra-sector method, pluggable).
// The Layer-2 sector table is gated on the universe resolving — its rows (base
// weight + alpha vs S&P 500) come from POST /strategies/resolve-universe.
import { useState } from 'react';

import { Icon } from '../icons';
import { LAYER3_OPTIONS } from '../mapping';
import type { AlphaWindow, BuilderConfig, Layer3Method, UniverseSpec } from '../types';
import { useResolveSectors } from '../hooks/useResolveSectors';
import { Tip } from './formBits';

const ALPHA_WINDOWS: AlphaWindow[] = ['3m', '6m', '12m'];
const WINDOW_LABEL: Record<AlphaWindow, string> = {
  '3m': '3-month',
  '6m': '6-month',
  '12m': '12-month',
};

interface Props {
  universe: UniverseSpec;
  enabled: boolean; // the section is open → resolve the universe
  layer3Method: Layer3Method;
  layer3Gamma: number | '';
  sectorDeltas: Record<string, number>; // FMP sector → % relative tilt
  sectorCaps: Record<string, number>; // FMP sector → max weight in PERCENT
  onChange: (patch: Partial<BuilderConfig>) => void;
}

/** A locked single-method layer (1 & 2): one always-selected, non-clickable card
 *  that documents what the layer does and that more methods come later. */
function LockedLayer({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="sb-radio-grid">
      <div className="sb-radio-card active sb-locked" aria-disabled="true">
        <div className="sb-radio-card-head">
          <span className="sb-radio-dot" />
          <span className="sb-radio-name">{name}</span>
          <span className="sb-lock-pill">
            v1 · locked <Tip text="Only one method in v1 — more selectable methods for this layer are coming." />
          </span>
        </div>
        <div className="sb-radio-desc">{desc}</div>
      </div>
    </div>
  );
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
function fmtAlpha(a: number | null): string {
  if (a == null) return '—';
  return `${a > 0 ? '+' : ''}${a.toFixed(1)}%`;
}

export function SectorWeighting({
  universe,
  enabled,
  layer3Method,
  layer3Gamma,
  sectorDeltas,
  sectorCaps,
  onChange,
}: Props) {
  const [alphaWindow, setAlphaWindow] = useState<AlphaWindow>('12m');
  const { data, loading, error } = useResolveSectors(universe, enabled, alphaWindow);
  const sectors = data?.sectors ?? [];
  const thin = data != null && (data.coverage_pct < 0.6 || data.eligible_count < 20);

  const setDelta = (sector: string, raw: string) => {
    const pct = raw === '' ? 0 : parseFloat(raw);
    const next = { ...sectorDeltas };
    if (!pct || Number.isNaN(pct)) delete next[sector];
    else next[sector] = pct;
    onChange({ sectorDeltas: next });
  };
  const setCap = (sector: string, raw: string) => {
    const pct = raw === '' ? 0 : parseFloat(raw);
    const next = { ...sectorCaps };
    // empty/0/negative → no cap; the backend rejects > 100% (fraction > 1) so clamp.
    if (!pct || Number.isNaN(pct) || pct <= 0) delete next[sector];
    else next[sector] = Math.min(pct, 100);
    onChange({ sectorCaps: next });
  };
  const netTilt = Object.values(sectorDeltas).reduce((a, b) => a + b, 0);
  const nCaps = Object.keys(sectorCaps).length;

  return (
    <div className="sb-layers">
      {/* LAYER 1 — sector base (locked) */}
      <div className="sb-layer">
        <div className="sb-layer-head">
          <span className="sb-layer-tag">Layer 1</span>
          <span className="sb-layer-title">Sector base</span>
          <Tip text="The base weight of each sector = its market-cap share of the resolved investment universe." />
        </div>
        <LockedLayer
          name="Market-cap share of the universe"
          desc="Each sector starts at its share of the universe's total market cap."
        />
      </div>

      {/* LAYER 2 — sector tilt by alpha (locked method, user deltas) */}
      <div className="sb-layer">
        <div className="sb-layer-head">
          <span className="sb-layer-tag">Layer 2</span>
          <span className="sb-layer-title">Sector tilt</span>
          <Tip text="Nudge each sector up or down. The alpha vs the S&P 500 is a guide only — your ± is what's applied (multiplicatively, then renormalized)." />
        </div>
        <LockedLayer
          name="Manual ± guided by alpha vs S&P 500"
          desc="Raise or lower each sector relative to its base; weights are renormalized to 100%."
        />

        {/* sector table — gated on the universe resolving */}
        <div className="sb-sw-table-wrap">
          {enabled && (data || loading) && (
            <div className="sb-sw-controls">
              <span className="sb-sw-advisory">
                {data ? (
                  <>
                    Median {WINDOW_LABEL[alphaWindow]} alpha vs the S&amp;P 500, as of {data.as_of} —
                    a guide, not point-in-time.
                  </>
                ) : (
                  'Resolving the universe…'
                )}
              </span>
              <div className="sb-segment sb-sw-window">
                {ALPHA_WINDOWS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={`sb-seg-btn ${alphaWindow === w ? 'active' : ''}`}
                    onClick={() => setAlphaWindow(w)}
                  >
                    {w.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!enabled ? null : loading && sectors.length === 0 ? (
            <div className="sb-sw-note">
              <span className="sb-spinner" /> Resolving the universe…
            </div>
          ) : error ? (
            <div className="sb-sw-note err">
              <Icon name="warn" size={13} /> {error}
            </div>
          ) : sectors.length === 0 ? (
            <div className="sb-sw-note">
              No sectors yet — fill the investment universe (size, sector, filters) to see sector
              weights.
            </div>
          ) : (
            <>
              {thin && (
                <div className="sb-sw-note warn">
                  <Icon name="warn" size={13} /> Thin universe ({sectors.reduce((n, s) => n + s.member_count, 0)} names,{' '}
                  {Math.round((data?.coverage_pct ?? 0) * 100)}% price coverage) — weights may be noisy.
                </div>
              )}
              <table className="sb-sw-table">
                <thead>
                  <tr>
                    <th>Sector</th>
                    <th className="num">% of universe</th>
                    <th className="num">
                      Alpha {alphaWindow.toUpperCase()}{' '}
                      <Tip
                        text={`Median ${WINDOW_LABEL[alphaWindow]} alpha (vs SPY) of the sector's members, as of today. A snapshot guide, not point-in-time.`}
                      />
                    </th>
                    <th className="num">± tilt</th>
                    <th className="num">
                      Max %{' '}
                      <Tip text="Optional ceiling on the sector's final weight. If it exceeds this after the tilt, the excess is redistributed to the uncapped sectors. Blank = no cap. (This caps the WEIGHT — the per-sector name limit is set in Selection.)" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sectors.map((s) => (
                    <tr key={s.sector}>
                      <td>
                        {s.sector}
                        <span className="sb-sw-members">{s.member_count}</span>
                      </td>
                      <td className="num mono">{fmtPct(s.base_weight_pct)}</td>
                      <td
                        className={`num mono ${
                          s.alpha_vs_spy == null ? 'dim' : s.alpha_vs_spy >= 0 ? 'pos' : 'neg'
                        }`}
                      >
                        {s.alpha_vs_spy == null ? (
                          <span className="sb-sw-na">
                            —
                            <Tip
                              text={`Only ${s.alpha_coverage} of ${s.member_count} names have an alpha — too few for a median.`}
                            />
                          </span>
                        ) : (
                          fmtAlpha(s.alpha_vs_spy)
                        )}
                      </td>
                      <td className="num">
                        <span className="sb-sw-delta">
                          <input
                            type="number"
                            className="sb-input mono"
                            value={sectorDeltas[s.sector] ?? ''}
                            placeholder="0"
                            step={5}
                            onChange={(e) => setDelta(s.sector, e.target.value)}
                          />
                          <span>%</span>
                        </span>
                      </td>
                      <td className="num">
                        <span className="sb-sw-delta">
                          <input
                            type="number"
                            className="sb-input mono"
                            value={sectorCaps[s.sector] ?? ''}
                            placeholder="—"
                            min={0}
                            max={100}
                            step={5}
                            onChange={(e) => setCap(s.sector, e.target.value)}
                          />
                          <span>%</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="sb-sw-foot">
                <span>
                  Net tilt {netTilt > 0 ? '+' : ''}
                  {netTilt}% across {Object.keys(sectorDeltas).length} sector
                  {Object.keys(sectorDeltas).length === 1 ? '' : 's'}
                  {nCaps > 0 && (
                    <>
                      {' · '}
                      {nCaps} cap{nCaps === 1 ? '' : 's'}
                    </>
                  )}
                </span>
                <span className="dim">renormalized to 100% at run time</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* LAYER 3 — intra-sector method (pluggable) */}
      <div className="sb-layer">
        <div className="sb-layer-head">
          <span className="sb-layer-tag">Layer 3</span>
          <span className="sb-layer-title">Stock weighting within sector</span>
          <Tip text="How each sector's budget is split across its stocks." />
        </div>
        <div className="sb-radio-grid">
          {LAYER3_OPTIONS.map((o) => (
            <button
              key={o.k}
              type="button"
              className={`sb-radio-card ${layer3Method === o.k ? 'active' : ''}`}
              onClick={() => onChange({ layer3Method: o.k })}
            >
              <div className="sb-radio-card-head">
                <span className="sb-radio-dot" />
                <span className="sb-radio-name">{o.n}</span>
              </div>
              <div className="sb-radio-desc">{o.d}</div>
            </button>
          ))}
        </div>
        {layer3Method === 'rating_weighted' && (
          <div className="sb-field" style={{ maxWidth: 220 }}>
            <div className="sb-field-label">
              Gamma (γ){' '}
              <Tip text="Sharpens the rating tilt: 0 = equal, 1 = linear by rating, higher = more concentrated. Blank uses the default (1)." />
            </div>
            <div className="sb-input-suffix">
              <input
                type="number"
                className="sb-input mono"
                value={layer3Gamma}
                placeholder="1.0"
                min={0}
                step={0.5}
                onChange={(e) =>
                  onChange({ layer3Gamma: e.target.value === '' ? '' : parseFloat(e.target.value) })
                }
              />
              <span>γ</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
