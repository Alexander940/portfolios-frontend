import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowUpCircle, Loader2, Scale } from 'lucide-react';

import {
  getPortfolioSleeves,
  rebaseSleeve,
  type PortfolioSleevesResponse,
  type SleeveBreakdownItem,
} from '@/services/portfolioService';
import { getErrorMessage, isApiError } from '@/lib/apiErrors';
import { fmtDate, fmtMoney, fmtNumber } from '@/lib/format';
import { toast } from '@/components/ui';
import {
  CADENCE_LABELS,
  REBALANCE_ON_LABELS,
  fmtCoverage,
} from '../lib/sleeves';
import { EditSleeveAllocationsModal } from './EditSleeveAllocationsModal';

interface SleevesTabProps {
  portfolioId: string;
  /** Owner o co_owner: sin esto la pestaña es de solo lectura (#205). */
  canEdit: boolean;
}

const DASH = '—';

/** Fracción → porcentaje con un decimal; `null` → «—». */
function pctFromFraction(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return `${(v * 100).toFixed(decimals)}%`;
}

/** Porcentaje ya en unidades de porcentaje. */
function pct(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return `${v.toFixed(decimals)}%`;
}

/** Deriva con signo: lo que la manga explica hoy menos lo que pidió. */
function drift(v: number, decimals = 1): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(decimals)}%`;
}

/** «Mensual, al cierre del período · tope 12 % · colchón 5 %». */
function rulesSummary(rules: PortfolioSleevesResponse['rules']): string {
  const parts: string[] = [];
  const cadence = CADENCE_LABELS[rules.cadence] ?? rules.cadence;
  const on = REBALANCE_ON_LABELS[rules.on] ?? rules.on;
  parts.push(`${cadence}, ${on}`);
  if (rules.max_position_weight != null) {
    parts.push(`tope por nombre ${pctFromFraction(rules.max_position_weight)}`);
  }
  if (rules.min_position_weight != null) {
    parts.push(`piso por nombre ${pctFromFraction(rules.min_position_weight)}`);
  }
  if (rules.cash_buffer_pct != null) {
    parts.push(`colchón de efectivo ${pctFromFraction(rules.cash_buffer_pct)}`);
  }
  return parts.join(' · ');
}

function resolveError(err: unknown): string {
  if (isApiError(err)) {
    if (err.status === 400) {
      return 'Este portafolio no es compuesto: no tiene mangas que mostrar.';
    }
    if (err.status === 403) {
      return 'Tu rol sobre este portafolio no permite cambiar las mangas.';
    }
    if (err.status === 404) return 'No se encontró el portafolio.';
    return err.detail ?? err.message;
  }
  return getErrorMessage(err);
}

/**
 * SleevesTab (#208) — el desglose por manga de un portafolio compuesto (#197).
 *
 * Lee `GET /portfolios/{id}/sleeves` (#203) y ofrece las dos únicas acciones
 * que v1 admite sobre la mezcla (#205): reescribir TODAS las asignaciones
 * (`PUT`) y adoptar la última versión de una estrategia (`PATCH`, rebase
 * explícito). Ninguna de las dos mueve el libro — el cambio se materializa en
 * el próximo rebalanceo, y por eso los botones lo dicen.
 *
 * Los dos pesos de la tabla NO son lo mismo y la columna «deriva» existe para
 * hacer visible la diferencia: `target_weight_pct` es lo que la manga pidió en
 * el último target guardado y `current_weight_pct` lo que explica HOY del valor
 * total, atribuyendo cada posición entre las mangas que la eligieron en
 * proporción a su contribución. No hay libros por manga: el compuesto tiene un
 * solo ledger.
 */
export function SleevesTab({ portfolioId, canEdit }: SleevesTabProps) {
  const [data, setData] = useState<PortfolioSleevesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  /** Manga con el rebase en vuelo (id) — deshabilita su botón. */
  const [rebasing, setRebasing] = useState<string | null>(null);
  /** Manga cuyo rebase espera confirmación: en v1 no se puede volver atrás. */
  const [confirmRebase, setConfirmRebase] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    // Mismo ciclo de request que el resto de los bloques que se auto-cargan.
    setIsLoading(true);
    setError(null);

    getPortfolioSleeves(portfolioId, controller.signal)
      .then((resp) => {
        if (controller.signal.aborted) return;
        setData(resp);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(resolveError(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [portfolioId, attempt]);

  /** Las tres mutaciones devuelven el shape de `GET /sleeves`: se repinta con
   *  la respuesta en vez de re-pedir el desglose. */
  const applyFresh = useCallback((fresh: PortfolioSleevesResponse) => {
    setData(fresh);
    setError(null);
  }, []);

  async function handleRebase(sleeve: SleeveBreakdownItem) {
    setConfirmRebase(null);
    setRebasing(sleeve.strategy_id);
    try {
      const fresh = await rebaseSleeve(portfolioId, sleeve.strategy_id);
      applyFresh(fresh);
      toast(
        'success',
        `«${sleeve.name}» quedó pineada en la v${sleeve.latest_version}. ` +
          'Se aplica en el próximo rebalanceo.',
      );
    } catch (err) {
      toast('error', resolveError(err));
    } finally {
      setRebasing(null);
    }
  }

  if (isLoading && !data) {
    return (
      <div
        className="card"
        style={{
          padding: 48,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Loader2
          size={24}
          color="var(--c-text-dim)"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="card" style={{ padding: 24 }} data-testid="sleeves-error">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertTriangle
            size={18}
            color="var(--c-warn)"
            style={{ flexShrink: 0, marginTop: 2 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
              No se pudo cargar el desglose por manga
            </div>
            <p style={{ margin: 0, color: 'var(--c-text-soft)', fontSize: 13 }}>
              {error}
            </p>
            <button
              type="button"
              className="topbar-btn"
              style={{ marginTop: 12 }}
              onClick={() => setAttempt((a) => a + 1)}
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const invested = 100 - data.cash_pct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Resumen del compuesto */}
      <div className="card" data-testid="sleeves-summary">
        <div className="card-head">
          <div>
            <div className="card-title">Mangas del compuesto</div>
            <div className="card-sub">
              {data.sleeves.length}{' '}
              {data.sleeves.length === 1 ? 'estrategia' : 'estrategias'} ·{' '}
              {rulesSummary(data.rules)}
            </div>
          </div>
          {canEdit && data.sleeves.length > 0 && (
            <button
              type="button"
              className="topbar-btn"
              style={{ border: '1px solid var(--c-border)' }}
              onClick={() => setEditOpen(true)}
              data-testid="sleeves-edit-allocations"
            >
              <Scale size={14} />
              Cambiar asignaciones
            </button>
          )}
        </div>

        <div
          style={{
            padding: '14px 16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 16,
          }}
        >
          {[
            { label: 'Valor total', value: fmtMoney(data.total_value) },
            { label: 'Efectivo', value: pct(data.cash_pct) },
            { label: 'Invertido', value: pct(invested) },
            {
              label: 'Nombres solapados',
              value: fmtNumber(data.overlap_count, 0),
            },
            { label: 'Datos al', value: fmtDate(data.as_of) },
            {
              label: 'Último rebalanceo',
              value: data.last_rebalance_date
                ? fmtDate(data.last_rebalance_date)
                : 'Nunca',
            },
          ].map((m) => (
            <div key={m.label}>
              <div
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--c-text-dim)',
                  fontWeight: 500,
                  marginBottom: 3,
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla de mangas */}
      <div className="card">
        <table className="tbl" data-testid="sleeves-table">
          <thead>
            <tr>
              <th>Manga</th>
              <th className="num">Asignación</th>
              <th>Versión</th>
              <th className="num">Peso objetivo</th>
              <th className="num">Peso actual</th>
              <th className="num">Deriva</th>
              <th className="num">Posiciones</th>
              <th className="num">Cobertura</th>
              <th>Target al</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {data.sleeves.map((s) => {
              const d = s.current_weight_pct - s.target_weight_pct;
              return (
                <tr key={s.strategy_id}>
                  <td className="name-cell">
                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                    {s.warnings.length > 0 && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--c-warn)',
                          marginTop: 2,
                        }}
                      >
                        {s.warnings.join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="num">{pctFromFraction(s.allocation, 2)}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      v{s.pinned_version}
                    </span>
                    {s.outdated && (
                      <span
                        className="type-badge"
                        title={`La estrategia ya va por la v${s.latest_version}; el compuesto sigue corriendo con la v${s.pinned_version} hasta que la actualices.`}
                        style={{
                          marginLeft: 6,
                          background: 'var(--c-bg-soft)',
                          color: 'var(--c-warn)',
                          border: '1px solid var(--c-border)',
                        }}
                      >
                        desactualizada · v{s.latest_version}
                      </span>
                    )}
                  </td>
                  <td className="num">{pct(s.target_weight_pct)}</td>
                  <td className="num">{pct(s.current_weight_pct)}</td>
                  <td
                    className={`num ${Math.abs(d) < 0.05 ? 'dim' : d > 0 ? 'pos' : 'neg'}`}
                  >
                    {drift(d)}
                  </td>
                  <td className="num">{fmtNumber(s.holdings_count, 0)}</td>
                  <td className="num">{fmtCoverage(s.coverage_pct)}</td>
                  <td className="dim">
                    {s.target_as_of ? fmtDate(s.target_as_of) : DASH}
                  </td>
                  {canEdit && (
                    <td className="num">
                      {s.outdated &&
                        (confirmRebase === s.strategy_id ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              gap: 6,
                              alignItems: 'center',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            <span
                              style={{ fontSize: 11, color: 'var(--c-text-soft)' }}
                            >
                              ¿Pinear la v{s.latest_version}?
                            </span>
                            <button
                              type="button"
                              className="topbar-btn"
                              onClick={() => void handleRebase(s)}
                              disabled={rebasing !== null}
                            >
                              Sí
                            </button>
                            <button
                              type="button"
                              className="topbar-btn"
                              onClick={() => setConfirmRebase(null)}
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="topbar-btn"
                            style={{ border: '1px solid var(--c-border)' }}
                            onClick={() => setConfirmRebase(s.strategy_id)}
                            disabled={rebasing !== null}
                            title="Adopta la última versión publicada de la estrategia. No mueve el libro: se aplica en el próximo rebalanceo."
                            data-testid={`sleeve-rebase-${s.strategy_id}`}
                          >
                            {rebasing === s.strategy_id ? (
                              <Loader2
                                size={13}
                                style={{ animation: 'spin 1s linear infinite' }}
                              />
                            ) : (
                              <ArrowUpCircle size={13} />
                            )}
                            Actualizar a la última versión
                          </button>
                        ))}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        <p
          style={{
            margin: 0,
            padding: '10px 16px',
            borderTop: '1px solid var(--c-border)',
            fontSize: 11.5,
            color: 'var(--c-text-dim)',
          }}
          data-testid="sleeves-attribution-note"
        >
          El «peso actual» es una <strong>atribución proporcional al último
          target</strong>: el compuesto tiene un solo libro, así que cada posición
          se reparte entre las mangas que la eligieron según cuánto aportó cada
          una al target guardado. No son libros separados por manga.
        </p>
      </div>

      {/* Exposición sectorial agregada */}
      {data.sector_exposure.length > 0 && (
        <div className="card" data-testid="sleeves-sector-exposure">
          <div className="card-head">
            <div>
              <div className="card-title">Exposición sectorial</div>
              <div className="card-sub">
                En % del valor total del portafolio, sumando todas las mangas.
              </div>
            </div>
          </div>
          <div
            style={{
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {data.sector_exposure.map((se) => (
              <div
                key={se.sector}
                style={{ display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <span
                  style={{
                    width: 170,
                    flexShrink: 0,
                    fontSize: 12.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={se.sector}
                >
                  {se.sector}
                </span>
                <span
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    background: 'var(--c-bg-softer)',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      borderRadius: 3,
                      background: 'var(--c-accent)',
                      width: `${Math.max(0, Math.min(100, se.weight_pct))}%`,
                    }}
                  />
                </span>
                <span
                  style={{
                    width: 56,
                    textAlign: 'right',
                    fontSize: 12.5,
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {pct(se.weight_pct)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Avisos del desglose (lo que rompería Σ pesos = 100 − efectivo) */}
      {data.warnings.length > 0 && (
        <div className="card" style={{ padding: '12px 16px' }}>
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              color: 'var(--c-text-soft)',
              fontSize: 12.5,
            }}
          >
            <AlertTriangle
              size={15}
              color="var(--c-warn)"
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {canEdit && (
        <EditSleeveAllocationsModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          portfolioId={portfolioId}
          sleeves={data.sleeves}
          onSaved={applyFresh}
        />
      )}
    </div>
  );
}
