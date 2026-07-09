import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Loader2, Rocket, XCircle } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { getErrorMessage, isApiError } from '@/lib/apiErrors';
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from '@/lib/format';
import { createTracker, getStrategyHoldings } from '../service';
import { useTrackerStore } from '../store';
import {
  hasEmptyUniverseWarning,
  hasInertWarning,
  type HoldingsPreviewResponse,
} from '../types';

const CAPITAL_CHIPS = [50_000, 100_000, 250_000];
const DEFAULT_CAPITAL = 100_000;

interface PreviewRow {
  ticker: string;
  name: string;
  weightPct: number;
  price: number;
  shares: number;
  invested: number;
}

/**
 * Client-side re-materialization with the backend's formula:
 * shares = floor(capital * weight_pct/100 / price); cash = capital - Σ invested.
 * The API computes shares for a fixed initial_cash of 100000, so the preview
 * must recompute locally when the user picks another capital (no refetch).
 */
function computeRows(preview: HoldingsPreviewResponse, capital: number): PreviewRow[] {
  return (preview.holdings ?? []).map((h) => {
    const price = Number(h.price);
    const weightPct = Number(h.weight_pct);
    const shares =
      capital > 0 && price > 0 ? Math.floor((capital * weightPct) / 100 / price) : 0;
    return {
      ticker: h.ticker,
      name: h.name,
      weightPct,
      price,
      shares,
      invested: shares * price,
    };
  });
}

interface PreviewFetch {
  preview: HoldingsPreviewResponse | null;
  isLoading: boolean;
  fetchError: string | null;
}

export function ActivationFlow({ strategyId }: { strategyId: string }) {
  const load = useTrackerStore((s) => s.load);
  // El componente se desmonta/remonta al cambiar de estrategia (el store
  // resetea notFound durante load), así que el estado inicial cubre cada fetch.
  const [{ preview, isLoading, fetchError }, setFetch] = useState<PreviewFetch>({
    preview: null,
    isLoading: true,
    fetchError: null,
  });
  const [capitalInput, setCapitalInput] = useState(String(DEFAULT_CAPITAL));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getStrategyHoldings(strategyId, controller.signal)
      .then((data) => {
        setFetch({ preview: data, isLoading: false, fetchError: null });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setFetch({ preview: null, isLoading: false, fetchError: getErrorMessage(err) });
      });
    return () => controller.abort();
  }, [strategyId]);

  const capital = Number(capitalInput) || 0;
  const rows = useMemo(
    () => (preview ? computeRows(preview, capital) : []),
    [preview, capital],
  );
  const invested = rows.reduce((acc, r) => acc + r.invested, 0);
  const cash = capital - invested;
  const allSharesZero = rows.length > 0 && rows.every((r) => r.shares === 0);
  const canActivate = !creating && capital > 0 && rows.length > 0 && !allSharesZero;

  const handleActivate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      await createTracker(strategyId, capital);
      // 201 → el detalle ya existe: recargar el store lo muestra.
      await load(strategyId);
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        // Ya existe un tracker: cargar el detalle existente.
        await load(strategyId);
        return;
      }
      setCreateError(getErrorMessage(err));
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="trk-error-box" data-testid="activation-loading">
        <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto' }} />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="card">
        <div className="trk-error-box" data-testid="activation-fetch-error">
          <div>{fetchError}</div>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  const inertWarning = hasInertWarning(preview.warnings);
  const emptyUniverse =
    hasEmptyUniverseWarning(preview.warnings) || (preview.holdings ?? []).length === 0;

  if (emptyUniverse) {
    return (
      <div className="card">
        <div className="trk-empty" data-testid="activation-empty">
          <AlertTriangle size={32} style={{ color: 'var(--c-warn)' }} aria-hidden />
          <h3>El universo resolvió vacío</h3>
          <p>
            Con los datos actuales, las reglas de la estrategia no seleccionan
            ningún activo. Revisa la estrategia en el builder antes de activar el
            tracker.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="activation-flow">
      <div className="page-header">
        <div>
          <div className="trk-head-row">
            <h1 className="page-title">Activar tracker</h1>
            {preview.data_as_of && (
              <span className="trk-asof" data-testid="activation-asof">
                <CalendarClock size={12} aria-hidden />
                Precios al cierre · {fmtDate(preview.data_as_of)}
              </span>
            )}
          </div>
          <p className="page-sub">
            Define el capital, revisa el portafolio que se materializará hoy
            (acciones enteras + cash remanente) y activa el seguimiento.
          </p>
        </div>
      </div>

      {inertWarning && (
        <div className="trk-banner warn" data-testid="banner-inert">
          <AlertTriangle size={16} aria-hidden />
          <div className="trk-banner-body">
            <div className="trk-banner-title">Cláusula inerte</div>
            {inertWarning}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div className="card-title" style={{ marginBottom: 10 }}>
          1 · Capital inicial
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 220 }}>
            <Input
              label="Capital (USD)"
              type="number"
              min={0}
              value={capitalInput}
              onChange={(e) => setCapitalInput(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {CAPITAL_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip ${capital === c ? 'active' : ''}`}
                onClick={() => setCapitalInput(String(c))}
              >
                ${c / 1000}k
              </button>
            ))}
          </div>
        </div>
        {allSharesZero && (
          <div className="trk-banner warn" style={{ marginTop: 12 }} data-testid="banner-low-capital">
            <AlertTriangle size={16} aria-hidden />
            <div className="trk-banner-body">
              Con este capital ninguna posición alcanza 1 acción entera. Aumenta el
              capital para poder activar el tracker.
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">2 · Portafolio a materializar</div>
            <div className="card-sub">
              {preview.eligible_count !== undefined
                ? `${preview.eligible_count} activos elegibles`
                : ''}
              {preview.coverage_pct !== undefined
                ? ` · cobertura ${fmtPct(Number(preview.coverage_pct) * 100, 1)}`
                : ''}
            </div>
          </div>
        </div>
        <table className="tbl" data-testid="activation-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Nombre</th>
              <th className="num">Peso target</th>
              <th className="num">Precio</th>
              <th className="num">Acciones</th>
              <th className="num">Invertido</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker}>
                <td>{r.ticker}</td>
                <td className="name-cell">{r.name}</td>
                <td className="num">{fmtPct(r.weightPct, 1)}</td>
                <td className="num">{fmtMoney(r.price)}</td>
                <td className="num">{fmtNumber(r.shares, 0)}</td>
                <td className="num">{fmtMoney(r.invested)}</td>
              </tr>
            ))}
            <tr data-testid="activation-cash-row">
              <td>CASH</td>
              <td className="name-cell dim">Remanente sin invertir</td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num">{fmtMoney(cash)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {createError && (
        <div className="trk-banner error" data-testid="activation-error">
          <XCircle size={16} aria-hidden />
          <div className="trk-banner-body">
            <div className="trk-banner-title">No se pudo activar el tracker</div>
            {createError}
          </div>
        </div>
      )}

      <div className="trk-actions">
        <div className="spacer" />
        <Button
          leftIcon={<Rocket size={15} />}
          onClick={handleActivate}
          isLoading={creating}
          disabled={!canActivate}
          data-testid="activation-cta"
        >
          Activar tracker con {fmtMoney(capital)}
        </Button>
      </div>
    </div>
  );
}
