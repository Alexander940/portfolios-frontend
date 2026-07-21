import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from '@/components/ui';
import { searchSymbols, type SymbolSearchResult } from '@/services/symbolService';
import { createAlert, updateAlert } from './service';
import { OPERATOR_LABELS, rulePhrase } from './lib';
import type { Alert, AlertField, AlertWithValue, TriggerMode } from './types';

const CATEGORY_LABELS: Record<string, string> = {
  rating_tendencia: 'Rating / Tendencia',
  precio: 'Precio / Técnicos',
  eventos_fundamentales: 'Fundamentales / Eventos',
};

/** Sufijo del input de umbral según la unidad del catálogo. El usuario SIEMPRE
 * escribe en la unidad visible; para `fraction` la API recibe v/100. */
const UNIT_SUFFIX: Record<string, string> = {
  fraction: '%',
  percent: '%',
  usd: 'USD',
  days: 'días',
  x: '×',
  shares: 'acciones',
  level: '',
  z: 'σ',
  ratio: '',
  none: '',
};

const NO_THRESHOLD_OPS = new Set(['change', 'becomes_true', 'becomes_false']);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Catálogo ya cargado por la página — única fuente del formulario. */
  fields: AlertField[];
  /** Alerta a editar; null/undefined = crear. Símbolo y campo quedan fijos. */
  editing?: Alert | null;
  onSaved: (alert: AlertWithValue) => void;
}

export function AlertBuilderModal({ isOpen, onClose, fields, editing, onSaved }: Props) {
  const editMode = Boolean(editing);

  const [symbol, setSymbol] = useState<{ symbol_id: string; ticker: string } | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [category, setCategory] = useState<string>('rating_tendencia');
  const [fieldKey, setFieldKey] = useState('');
  const [operator, setOperator] = useState('');
  const [thresholdInput, setThresholdInput] = useState('');
  const [triggerMode, setTriggerMode] = useState<TriggerMode>('recurrente');
  const [cooldown, setCooldown] = useState('0');
  const [channels, setChannels] = useState<string[]>(['email', 'in_app']);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const field = useMemo(() => fields.find((f) => f.key === fieldKey), [fields, fieldKey]);
  const catFields = useMemo(
    () => fields.filter((f) => f.category === category),
    [fields, category],
  );
  const needsThreshold = Boolean(operator) && !NO_THRESHOLD_OPS.has(operator);

  // precarga / reset al abrir
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSubmitting(false);
    if (editing) {
      const f = fields.find((x) => x.key === editing.field);
      setSymbol({ symbol_id: editing.symbol_id, ticker: editing.ticker ?? '' });
      setCategory(f?.category ?? 'rating_tendencia');
      setFieldKey(editing.field);
      setOperator(editing.operator);
      setThresholdInput(toDisplay(f, editing.threshold));
      setTriggerMode(editing.trigger_mode);
      setCooldown(String(editing.cooldown_days));
      setChannels(editing.channels);
      setMessage(editing.message ?? '');
    } else {
      setSymbol(null);
      setQuery('');
      setResults([]);
      setCategory('rating_tendencia');
      setFieldKey('');
      setOperator('');
      setThresholdInput('');
      setTriggerMode('recurrente');
      setCooldown('0');
      setChannels(['email', 'in_app']);
      setMessage('');
    }
  }, [isOpen, editing, fields]);

  // autocomplete de símbolo (crear)
  useEffect(() => {
    if (editMode || query.trim().length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        setResults(await searchSymbols(query.trim(), 8));
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(searchTimer.current);
  }, [query, editMode]);

  // al cambiar el campo, ajustar operador válido y limpiar umbral
  function pickField(key: string) {
    setFieldKey(key);
    const f = fields.find((x) => x.key === key);
    setOperator(f?.operators[0] ?? '');
    setThresholdInput('');
  }

  const nativeThreshold: string | null = useMemo(() => {
    if (!needsThreshold) return null;
    const v = parseFloat(thresholdInput);
    if (Number.isNaN(v)) return null;
    return field?.unit === 'fraction' ? String(v / 100) : String(v);
  }, [needsThreshold, thresholdInput, field]);

  const preview =
    symbol && field && operator && (!needsThreshold || nativeThreshold !== null)
      ? `Avisarme cuando ${symbol.ticker}: ${rulePhrase(field, {
          field: fieldKey,
          operator,
          threshold: nativeThreshold,
        })}`
      : 'Completa la regla para ver la vista previa.';

  const canSubmit =
    !submitting &&
    Boolean(symbol && field && operator) &&
    (!needsThreshold || nativeThreshold !== null) &&
    channels.length > 0;

  async function submit() {
    if (!canSubmit || !symbol) return;
    setSubmitting(true);
    setError(null);
    try {
      const saved = editing
        ? await updateAlert(editing.alert_id, {
            operator,
            threshold: nativeThreshold,
            trigger_mode: triggerMode,
            cooldown_days: parseInt(cooldown || '0', 10),
            channels,
            message: message.trim() || null,
          })
        : await createAlert({
            symbol_id: symbol.symbol_id,
            field: fieldKey,
            operator,
            threshold: nativeThreshold,
            trigger_mode: triggerMode,
            cooldown_days: parseInt(cooldown || '0', 10),
            channels,
            message: message.trim() || null,
          });
      onSaved(saved);
      onClose();
    } catch (e) {
      // transformAxiosError devuelve un ApiError plano (no Error): leer .message
      const msg = (e as { message?: string } | null)?.message;
      setError(msg || 'No se pudo guardar la alerta.');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleChannel(ch: string) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  }

  const selectCls =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-[#1e3a5f] focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editMode ? 'Editar alerta' : 'Nueva alerta'}
      description="Reglas evaluadas al cierre del mercado; avisan solo al cruzar el umbral."
      size="xl"
    >
      <div className="space-y-4">
        {/* Símbolo */}
        <div>
          <label className={labelCls}>Símbolo</label>
          {editMode || symbol ? (
            <div className="flex items-center gap-2">
              <span
                data-testid="picked-symbol"
                className="inline-flex items-center rounded-lg bg-[#1e3a5f]/10 px-3 py-1.5 text-sm font-semibold text-[#1e3a5f]"
              >
                {symbol?.ticker}
              </span>
              {!editMode && (
                <button
                  type="button"
                  className="text-xs text-gray-500 underline"
                  onClick={() => {
                    setSymbol(null);
                    setQuery('');
                  }}
                >
                  cambiar
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                data-testid="symbol-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca por ticker o nombre…"
                className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none"
              />
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-52 overflow-auto">
                  {results.map((r) => (
                    <button
                      key={r.symbol_id}
                      type="button"
                      data-testid="symbol-option"
                      onClick={() => {
                        setSymbol({ symbol_id: r.symbol_id, ticker: r.ticker });
                        setResults([]);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="font-semibold">{r.ticker}</span>
                      <span className="truncate text-gray-500">{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Categoría + campo + operador */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Categoría</label>
            <select
              data-testid="category-select"
              className={selectCls}
              value={category}
              disabled={editMode}
              onChange={(e) => {
                setCategory(e.target.value);
                setFieldKey('');
                setOperator('');
              }}
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Campo</label>
            <select
              data-testid="field-select"
              className={selectCls}
              value={fieldKey}
              disabled={editMode}
              onChange={(e) => pickField(e.target.value)}
            >
              <option value="" disabled>
                Elige un campo…
              </option>
              {catFields.map((f) => (
                <option key={f.key} value={f.key} disabled={!f.enabled}>
                  {f.label}
                  {!f.enabled ? ' (Próximamente)' : ''}
                </option>
              ))}
            </select>
            {field && <p className="mt-1 text-[11px] text-gray-500">{field.description}</p>}
          </div>
          <div>
            <label className={labelCls}>Condición</label>
            <select
              data-testid="operator-select"
              className={selectCls}
              value={operator}
              disabled={!field}
              onChange={(e) => setOperator(e.target.value)}
            >
              {(field?.operators ?? []).map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_LABELS[op] ?? op}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Umbral */}
        {needsThreshold && (
          <div className="max-w-xs">
            <label className={labelCls}>Umbral</label>
            <div className="flex items-center gap-2">
              <input
                data-testid="threshold-input"
                type="number"
                step="any"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none"
              />
              <span className="text-sm text-gray-500" data-testid="unit-suffix">
                {UNIT_SUFFIX[field?.unit ?? 'none']}
              </span>
            </div>
          </div>
        )}

        {/* Vista previa */}
        <div
          data-testid="preview"
          className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700"
        >
          {preview}
        </div>

        {/* Canales */}
        <div>
          <label className={labelCls}>Notificarme por</label>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                data-testid="channel-email"
                checked={channels.includes('email')}
                onChange={() => toggleChannel('email')}
              />
              Email
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                data-testid="channel-in_app"
                checked={channels.includes('in_app')}
                onChange={() => toggleChannel('in_app')}
              />
              Campana
            </label>
            <label className="flex items-center gap-1.5 text-gray-400">
              <input type="checkbox" data-testid="channel-sms" disabled checked={false} readOnly />
              SMS (Próximamente)
            </label>
          </div>
        </div>

        {/* Avanzado */}
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600">Opciones avanzadas</summary>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Modo de disparo</label>
              <select
                data-testid="trigger-mode"
                className={selectCls}
                value={triggerMode}
                onChange={(e) => setTriggerMode(e.target.value as TriggerMode)}
              >
                <option value="recurrente">Recurrente (se re-arma)</option>
                <option value="una_vez">Una sola vez</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Cooldown (días)</label>
              <input
                data-testid="cooldown-input"
                type="number"
                min={0}
                max={365}
                value={cooldown}
                onChange={(e) => setCooldown(e.target.value)}
                className={selectCls}
              />
            </div>
            <div className="sm:col-span-3">
              <label className={labelCls}>Nota personal (va en la notificación)</label>
              <input
                data-testid="message-input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Opcional…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none"
              />
            </div>
          </div>
        </details>

        {error && (
          <div
            data-testid="builder-error"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            data-testid="builder-save"
            disabled={!canSubmit}
            onClick={submit}
            className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : editMode ? 'Guardar cambios' : 'Crear alerta'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Umbral nativo (API) → unidad visible del input (fraction ×100). */
function toDisplay(field: AlertField | undefined, native: string | null): string {
  if (native === null || native === undefined) return '';
  const v = parseFloat(native);
  if (Number.isNaN(v)) return '';
  const shown = field?.unit === 'fraction' ? v * 100 : v;
  return String(parseFloat(shown.toFixed(6)));
}
