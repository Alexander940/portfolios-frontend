import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { fmtDate, fmtNumber, fmtPct } from '@/lib/format';
import { useTrackerStore } from '../store';
import type { DriftResponse } from '../types';

const GENERIC_EXIT_REASON = 'Dejó de pasar los filtros o cayó del top-N';

type DriftTab = 'entries' | 'exits' | 'drift';

/** Valor del campo sort_by de la estrategia (rating, sharpe, retorno…). */
function fmtScore(score: unknown): string {
  if (score === null || score === undefined) return '—';
  const num = Number(score);
  if (!Number.isFinite(num)) return String(score);
  return fmtNumber(num, Math.abs(num) >= 10 ? 1 : 2);
}

function EntriesBox({ drift, active }: { drift: DriftResponse; active: boolean }) {
  const entries = drift.entries ?? [];
  const scoreTooltip = drift.sort_by
    ? `Valor de ${drift.sort_by}`
    : 'Valor del campo de ordenamiento de la estrategia';
  return (
    <div className={`trk-drift-box ${active ? 'active' : ''}`} data-testid="drift-entries">
      <div className="trk-drift-box-title">
        Entrarían <span className="trk-drift-count">{entries.length}</span>
      </div>
      {entries.map((e) => (
        <div className="trk-drift-row" key={e.symbol_id}>
          <div>
            <strong>{e.ticker}</strong>
            <span className="dim" style={{ marginLeft: 6, fontSize: 12 }}>
              {e.sector ?? ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
            <span title={scoreTooltip}>{fmtScore(e.score)}</span>
            <span className="dim">{fmtPct(e.target_weight_pct, 1)}</span>
          </div>
        </div>
      ))}
      {entries.length === 0 && <div className="trk-drift-none">Sin entradas</div>}
    </div>
  );
}

function ExitsBox({ drift, active }: { drift: DriftResponse; active: boolean }) {
  const exits = drift.exits ?? [];
  return (
    <div className={`trk-drift-box ${active ? 'active' : ''}`} data-testid="drift-exits">
      <div className="trk-drift-box-title">
        Saldrían <span className="trk-drift-count">{exits.length}</span>
      </div>
      {exits.map((e) => (
        <div className="trk-drift-row" key={e.symbol_id}>
          <div>
            <strong>{e.ticker}</strong>
            {e.stale && <span className="trk-tag noquote">posible deslistada</span>}
            <div className="dim" style={{ fontSize: 12 }}>
              {e.reason ?? GENERIC_EXIT_REASON}
            </div>
          </div>
          <span className="dim" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmtPct(e.current_weight_pct, 1)}
          </span>
        </div>
      ))}
      {exits.length === 0 && <div className="trk-drift-none">Sin salidas</div>}
    </div>
  );
}

function WeightDriftBox({ drift, active }: { drift: DriftResponse; active: boolean }) {
  const items = drift.weight_drift ?? [];
  const maxAbs = Math.max(...items.map((i) => Math.abs(Number(i.delta_pct))), 0.0001);
  return (
    <div className={`trk-drift-box ${active ? 'active' : ''}`} data-testid="drift-weights">
      <div className="trk-drift-box-title">Desvío de pesos</div>
      {items.map((i) => {
        const delta = Number(i.delta_pct);
        const over = delta > 0;
        const width = (Math.abs(delta) / maxAbs) * 100;
        return (
          <div className="trk-drift-row" key={i.symbol_id} data-testid={`drift-bar-${i.ticker}`}>
            <strong style={{ width: 52 }}>{i.ticker}</strong>
            <div className="trk-drift-track">
              <div className="trk-drift-half">
                {!over && (
                  <div className="trk-drift-bar under" style={{ width: `${width}%` }} />
                )}
              </div>
              <div className="trk-drift-half">
                {over && (
                  <div className="trk-drift-bar over" style={{ width: `${width}%` }} />
                )}
              </div>
            </div>
            <span
              className={over ? 'trk-drift-over' : 'trk-drift-under'}
              style={{ width: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
            >
              {fmtPct(delta, 1, true)}
            </span>
          </div>
        );
      })}
      {items.length === 0 && <div className="trk-drift-none">Sin desvíos</div>}
    </div>
  );
}

export function DriftPanel() {
  const drift = useTrackerStore((s) => s.drift);
  const loading = useTrackerStore((s) => s.driftLoading);
  const error = useTrackerStore((s) => s.driftError);
  const loadDrift = useTrackerStore((s) => s.loadDrift);
  const [tab, setTab] = useState<DriftTab>('entries');

  return (
    <div className="card" style={{ marginBottom: 16 }} data-testid="drift-panel">
      <div className="card-head">
        <div>
          <div className="card-title">Próximo rebalanceo</div>
          <div className="card-sub">Qué cambiaría si la estrategia rebalanceara hoy</div>
        </div>
        {loading && <Loader2 className="animate-spin" size={16} aria-hidden />}
      </div>

      {error ? (
        <div className="trk-error-box" data-testid="drift-error">
          <div>{error}</div>
          <Button size="sm" variant="secondary" onClick={() => void loadDrift()}>
            Reintentar
          </Button>
        </div>
      ) : !drift ? null : (drift.entries ?? []).length === 0 &&
        (drift.exits ?? []).length === 0 &&
        (drift.weight_drift ?? []).length === 0 ? (
        <div className="trk-empty" data-testid="drift-empty">
          <h3>Tu libro coincide con el target</h3>
          <p>Si la estrategia rebalanceara hoy, no habría cambios.</p>
        </div>
      ) : (
        <>
          <div className="tabs trk-drift-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'entries'}
              className={`tab ${tab === 'entries' ? 'active' : ''}`}
              onClick={() => setTab('entries')}
            >
              Entrarían
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'exits'}
              className={`tab ${tab === 'exits' ? 'active' : ''}`}
              onClick={() => setTab('exits')}
            >
              Saldrían
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'drift'}
              className={`tab ${tab === 'drift' ? 'active' : ''}`}
              onClick={() => setTab('drift')}
            >
              Desvío
            </button>
          </div>

          <div className="trk-drift-grid">
            <EntriesBox drift={drift} active={tab === 'entries'} />
            <ExitsBox drift={drift} active={tab === 'exits'} />
            <WeightDriftBox drift={drift} active={tab === 'drift'} />
          </div>

          <div className="trk-drift-footer" data-testid="drift-footer">
            <span>
              Próximo rebalanceo:{' '}
              <strong>{fmtDate(drift.next_rebalance_date)}</strong>
            </span>
            {drift.coverage_pct !== undefined && (
              <span>
                Cobertura del universo:{' '}
                <strong>{fmtPct(Number(drift.coverage_pct) * 100, 1)}</strong>
              </span>
            )}
            {(drift.warnings ?? []).map((w) => (
              <span className="trk-drift-warning" key={w}>
                <AlertTriangle size={12} aria-hidden /> {w}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
