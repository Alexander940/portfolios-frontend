import { useEffect, useMemo, useRef, useState } from 'react';
import { Scale } from 'lucide-react';
import { Modal, Button, toast } from '@/components/ui';
import { isApiError } from '@/lib/apiErrors';
import {
  setSleeveAllocations,
  type PortfolioSleevesResponse,
  type SleeveBreakdownItem,
} from '@/services/portfolioService';
import {
  buildSleeves,
  checkAllocationPercents,
  fractionsToPercents,
  splitEvenly,
  sumAllocations,
  type AllocationIssue,
} from '../lib/sleeves';

interface EditSleeveAllocationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolioId: string;
  /** Las mangas actuales, en el orden que devuelve `GET /sleeves`. */
  sleeves: SleeveBreakdownItem[];
  /** El desglose fresco que devuelve el `PUT` (mismo shape que `GET`). */
  onSaved: (fresh: PortfolioSleevesResponse) => void;
}

/** Copy de cada problema de validación. La REGLA vive en `lib/sleeves.ts`. */
function issueMessage(issue: AllocationIssue): string {
  switch (issue.code) {
    case 'missing':
      return 'Cada manga necesita una asignación.';
    case 'non_positive':
      return 'Toda asignación tiene que ser mayor que 0 %.';
    case 'above_100':
      return 'Ninguna asignación puede pasar de 100 %.';
    default:
      return `Las asignaciones suman ${issue.total.toFixed(2)} % — tienen que sumar 100 %.`;
  }
}

function resolveError(err: unknown): string {
  if (isApiError(err)) {
    // El 422 del backend nombra el problema (Σ ≠ 1, conjunto distinto, rango).
    if (err.status === 403) {
      return 'Tu rol sobre este portafolio no permite cambiar las mangas.';
    }
    return err.detail ?? err.message;
  }
  return 'No se pudo guardar. Probá de nuevo.';
}

const FIELD_CLS =
  'w-24 px-2 py-1 text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]';

/**
 * EditSleeveAllocationsModal (#208) — «Cambiar asignaciones» del compuesto.
 *
 * Reescribe la mezcla con `PUT /portfolios/{id}/sleeves` (#205), que exige la
 * lista COMPLETA y exactamente el mismo conjunto de estrategias: dar de alta o
 * de baja una manga no existe en v1, así que el editor no deja agregar ni
 * quitar filas — solo repartir el 100 % entre las que ya están.
 *
 * La validación (Σ = 100 %, cada una en (0, 100]) es la misma función pura que
 * usa el modal de creación (#207): `checkAllocationPercents`. Acá solo se
 * traduce a copy.
 *
 * Guardar NO mueve el libro: cambia el objetivo con el que se arma el próximo
 * rebalanceo. El botón lo dice para que nadie espere ver órdenes.
 */
export function EditSleeveAllocationsModal({
  isOpen,
  onClose,
  portfolioId,
  sleeves,
  onSaved,
}: EditSleeveAllocationsModalProps) {
  /** Asignaciones en PORCENTAJE, por `strategy_id`. */
  const [pcts, setPcts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strategyIds = useMemo(
    () => sleeves.map((s) => s.strategy_id),
    [sleeves],
  );

  // Semilla en cada apertura: lo guardado hoy, ya redondeado a dos decimales
  // sin desbalancear el total (ver `fractionsToPercents`).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const percents = fractionsToPercents(sleeves.map((s) => s.allocation));
      const seeded: Record<string, string> = {};
      sleeves.forEach((s, i) => {
        seeded[s.strategy_id] = String(percents[i]);
      });
      setPcts(seeded);
      setError(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, sleeves]);

  const numeric = strategyIds.map((id) => {
    const raw = (pcts[id] ?? '').trim();
    if (raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  });
  const issue = checkAllocationPercents(numeric);
  const total = sumAllocations(numeric);
  const balanced = issue === null;

  function splitEven() {
    const parts = splitEvenly(strategyIds.length);
    const next: Record<string, string> = {};
    strategyIds.forEach((id, i) => {
      next[id] = String(parts[i]);
    });
    setPcts(next);
    setError(null);
  }

  async function handleSave() {
    if (issue) {
      setError(issueMessage(issue));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // La lista completa, en el orden actual: el backend exige el MISMO
      // conjunto de estrategias y Σ = 1 (la conversión %→fracción, con el
      // residuo en la última, es la de `buildSleeves`).
      const payload = buildSleeves(
        strategyIds,
        Object.fromEntries(
          strategyIds.map((id, i) => [id, numeric[i] as number]),
        ),
      );
      const fresh = await setSleeveAllocations(portfolioId, payload);
      onSaved(fresh);
      toast(
        'success',
        'Asignaciones actualizadas. Se aplican en el próximo rebalanceo.',
      );
      onClose();
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => undefined : onClose}
      title="Cambiar asignaciones"
      description="Repartí el 100 % del capital entre las mangas actuales. Agregar o quitar estrategias no está disponible todavía."
      size="lg"
    >
      <div className="space-y-4">
        <div className="border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-medium text-gray-700">
              Asignación de capital
            </span>
            <button
              type="button"
              onClick={splitEven}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs text-[#1e3a5f] hover:underline disabled:opacity-50"
            >
              <Scale size={13} />
              Repartir en partes iguales
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {sleeves.map((s) => (
              <div
                key={s.strategy_id}
                className="flex items-center gap-3 px-3 py-2"
              >
                <span className="text-sm text-gray-900 truncate flex-1">
                  {s.name}
                  <span className="ml-2 text-xs text-gray-500">
                    v{s.pinned_version}
                  </span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={pcts[s.strategy_id] ?? ''}
                    onChange={(e) => {
                      setPcts((prev) => ({
                        ...prev,
                        [s.strategy_id]: e.target.value,
                      }));
                      setError(null);
                    }}
                    disabled={saving}
                    aria-label={`Asignación de ${s.name}`}
                    className={FIELD_CLS}
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
            ))}
          </div>
          <div
            className={`flex items-center justify-between px-3 py-2 border-t text-sm ${
              balanced
                ? 'border-gray-100 bg-green-50 text-green-800'
                : 'border-gray-100 bg-red-50 text-red-800'
            }`}
          >
            <span>Total</span>
            <span className="font-medium" data-testid="sleeve-allocations-total">
              {Number.isFinite(total) ? `${total.toFixed(2)}%` : '—'}
              {!balanced && issue && ` — ${issueMessage(issue)}`}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Cambiar la mezcla no compra ni vende nada: reescribe el objetivo con el
          que se arma el <strong>próximo rebalanceo</strong>.
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            isLoading={saving}
            disabled={saving || !balanced}
          >
            {saving ? 'Guardando…' : 'Guardar asignaciones'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
