import { useMemo } from 'react';
import { fmtPct } from '@/lib/format';
import { useTrackerStore } from '../store';

const UNCLASSIFIED = 'Unclassified';
const CASH = 'Cash';

/** Colores por sector del design system (tokens --c-sector-*). */
const SECTOR_TOKEN: Record<string, string> = {
  Technology: 'var(--c-sector-1)',
  'Financial Services': 'var(--c-sector-2)',
  Healthcare: 'var(--c-sector-3)',
  'Consumer Cyclical': 'var(--c-sector-4)',
  'Consumer Defensive': 'var(--c-sector-5)',
  Industrials: 'var(--c-sector-6)',
  Energy: 'var(--c-sector-7)',
  'Basic Materials': 'var(--c-sector-8)',
  'Real Estate': 'var(--c-sector-9)',
  Utilities: 'var(--c-sector-10)',
  'Communication Services': 'var(--c-sector-11)',
};

function sectorColor(sector: string): string {
  if (sector === UNCLASSIFIED) return 'var(--c-text-dim)';
  if (sector === CASH) return 'var(--c-text-soft)';
  return SECTOR_TOKEN[sector] ?? 'var(--c-sector-12)';
}

interface SectorRow {
  sector: string;
  current: number | null;
  target: number | null;
}

export function SectorComposition() {
  const tracker = useTrackerStore((s) => s.tracker);
  const positions = useTrackerStore((s) => s.positions);
  const preview = useTrackerStore((s) => s.holdingsPreview);

  // Peso actual: current_value agrupado por sector / (Σ valores + cash).
  // Peso target: sector_breakdown del preview de holdings (+ cash_pct 0-1).
  // Ambos vienen de datos ya cargados por las secciones hermanas: cero
  // requests adicionales.
  const rows: SectorRow[] = useMemo(() => {
    const cash = Number(tracker?.cash ?? 0);
    const invested = positions.reduce((acc, p) => acc + Number(p.current_value), 0);
    const total = invested + (Number.isFinite(cash) ? cash : 0);

    const current = new Map<string, number>();
    for (const p of positions) {
      const sector = p.sector ?? UNCLASSIFIED;
      current.set(sector, (current.get(sector) ?? 0) + Number(p.current_value));
    }

    const target = new Map<string, number>();
    for (const s of preview?.sector_breakdown ?? []) {
      target.set(s.sector ?? UNCLASSIFIED, Number(s.weight_pct));
    }

    const sectors = new Set<string>([...current.keys(), ...target.keys()]);
    const list: SectorRow[] = [...sectors].map((sector) => ({
      sector,
      current: total > 0 ? ((current.get(sector) ?? 0) / total) * 100 : null,
      target: target.has(sector) ? (target.get(sector) as number) : null,
    }));

    list.sort((a, b) => (b.current ?? b.target ?? 0) - (a.current ?? a.target ?? 0));

    // Buckets fijos al final: Unclassified y Cash
    const unclassified = list.filter((r) => r.sector === UNCLASSIFIED);
    const regular = list.filter((r) => r.sector !== UNCLASSIFIED);
    const cashRow: SectorRow = {
      sector: CASH,
      current: total > 0 && Number.isFinite(cash) ? (cash / total) * 100 : null,
      target:
        preview?.cash_pct !== undefined ? Number(preview.cash_pct) * 100 : null,
    };
    return [...regular, ...unclassified, cashRow];
  }, [positions, preview, tracker?.cash]);

  if (!tracker) return null;

  const hasData = positions.length > 0 || (preview?.sector_breakdown ?? []).length > 0;
  const maxWeight = Math.max(
    ...rows.map((r) => Math.max(r.current ?? 0, r.target ?? 0)),
    1,
  );

  return (
    <div className="card" style={{ marginBottom: 16 }} data-testid="sector-composition">
      <div className="card-head">
        <div>
          <div className="card-title">Composición sectorial</div>
          <div className="card-sub">Peso actual del libro vs target de la estrategia</div>
        </div>
        <div className="trk-sector-legend">
          <span className="trk-sector-legend-swatch" /> Peso actual
          <span className="trk-sector-legend-tick" /> Target (base/tilt)
        </div>
      </div>

      {!hasData ? (
        <div className="trk-error-box" data-testid="sectors-empty">
          Aún no hay datos sectoriales.
        </div>
      ) : (
        <div className="trk-sectors">
          {rows.map((r) => {
            const color = sectorColor(r.sector);
            const barWidth = ((r.current ?? 0) / maxWeight) * 100;
            const tickLeft =
              r.target !== null ? Math.min((r.target / maxWeight) * 100, 100) : null;
            return (
              <div
                className="trk-sector-row"
                key={r.sector}
                data-testid={`sector-row-${r.sector}`}
              >
                <span className="trk-sector-name">{r.sector}</span>
                <div className="trk-sector-track">
                  <div
                    className="trk-sector-bar"
                    style={{ width: `${barWidth}%`, background: color }}
                  />
                  {tickLeft !== null && (
                    <div
                      className="trk-sector-tick"
                      style={{ left: `${tickLeft}%` }}
                      title={`Target: ${fmtPct(r.target, 1)}`}
                    />
                  )}
                </div>
                <span className="trk-sector-values">
                  {fmtPct(r.current, 1)}
                  <span className="dim"> / {fmtPct(r.target, 1)}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
