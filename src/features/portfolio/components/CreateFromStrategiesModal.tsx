import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Layers, Loader2, Scale } from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import { isApiError } from '@/lib/apiErrors';
import { fmtDate, fmtMoney, fmtPct } from '@/lib/format';
// Cross-feature import, on purpose: the sleeve picker lists the SAME
// `GET /strategies/` rows the builder lists, and duplicating the call here
// would mean two DTOs to keep in sync with one endpoint.
import { listStrategies } from '@/features/strategy-builder/service';
import type { StrategyListItem } from '@/features/strategy-builder/types';
import {
  createPortfolioFromStrategies,
  previewPortfolioFromStrategies,
  type CompositeCadence,
  type CompositeExcludedReason,
  type CompositeSleeveResult,
  type PortfolioFromStrategiesCreate,
  type PortfolioFromStrategiesResponse,
  type PortfolioResponse,
} from '@/services/portfolioService';
import {
  MAX_SLEEVES,
  MIN_SLEEVES,
  buildSleeves,
  fmtCoverage,
  isBalanced,
  parseOptionalNumber,
  pctToFraction,
  splitEvenly,
  sumAllocations,
  validateCompositeDraft,
} from '../lib/sleeves';

interface CreateFromStrategiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fired with the created portfolio before navigating to its analysis page. */
  onCreated?: (portfolio: PortfolioResponse) => void;
}

type Step = 'select' | 'allocate' | 'preview';

const CADENCE_OPTIONS: { value: CompositeCadence; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semiannual', label: 'Semiannual' },
  { value: 'annual', label: 'Annual' },
];

const EXCLUDED_REASON: Record<
  CompositeExcludedReason,
  { text: string; cls: string }
> = {
  no_price: { text: 'no price data', cls: 'bg-red-100 text-red-700' },
  too_small: {
    text: 'allocation too small to buy one share',
    cls: 'bg-gray-100 text-gray-600',
  },
  capped: {
    text: 'trimmed by the per-position cap (still held)',
    cls: 'bg-amber-100 text-amber-800',
  },
  below_floor: {
    text: 'below the per-position floor',
    cls: 'bg-gray-100 text-gray-600',
  },
};

/** One colour per sleeve, by position. Literal classes so Tailwind sees them. */
const SLEEVE_CHIP_CLASSES = [
  'bg-blue-100 text-blue-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-cyan-100 text-cyan-800',
  'bg-lime-100 text-lime-800',
  'bg-fuchsia-100 text-fuchsia-800',
  'bg-orange-100 text-orange-800',
  'bg-teal-100 text-teal-800',
];

const FIELD_CLS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400';

const STEP_DESCRIPTION: Record<Step, string> = {
  select: `Pick ${MIN_SLEEVES}–${MAX_SLEEVES} of your strategies; each one becomes a sleeve of the composite.`,
  allocate: 'Split the capital across the sleeves and set the composite rules.',
  preview: 'Nothing has been created yet — this is what the composite would hold.',
};

/**
 * Error text for the composite calls.
 *
 * The backend's 422 `detail` is the useful message (it names the sleeve whose
 * coverage is too low, or the rule that is out of range), so it is shown
 * verbatim. A 404 means a selected strategy is gone or was never the caller's —
 * that is not enumerable server-side, so the copy says it without naming which.
 * Anything that is not an `ApiError` never came from the API layer, so its raw
 * message would be an internal detail, not something to show a user.
 */
function resolveCompositeError(err: unknown): string {
  if (isApiError(err)) {
    if (err.status === 404) {
      return 'One of the selected strategies is no longer available. Go back and pick it again.';
    }
    return err.detail ?? err.message;
  }
  return 'The request could not be completed. Please try again.';
}

/** `Top 25 · Monthly` — the spec chips shown next to a strategy name. */
function specChips(item: StrategyListItem): string {
  const parts: string[] = [];
  const topN = item.spec?.selection?.top_n;
  if (typeof topN === 'number' && Number.isFinite(topN)) parts.push(`Top ${topN}`);
  const cadence = item.spec?.rebalance?.cadence;
  if (cadence) parts.push(cadence[0].toUpperCase() + cadence.slice(1));
  return parts.join(' · ');
}

export function CreateFromStrategiesModal({
  isOpen,
  onClose,
  onCreated,
}: CreateFromStrategiesModalProps) {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('select');

  const [strategies, setStrategies] = useState<StrategyListItem[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);

  // Selection order is meaningful: it drives the sleeve order in the payload
  // and the colour each sleeve gets in the preview.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialCash, setInitialCash] = useState('100000');
  const [cadence, setCadence] = useState<CompositeCadence>('monthly');
  const [maxPositionWeight, setMaxPositionWeight] = useState('');
  const [cashBuffer, setCashBuffer] = useState('');

  const [preview, setPreview] = useState<PortfolioFromStrategiesResponse | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load the caller's strategies once per open.
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setLoadingStrategies(true);
    setStrategiesError(null);
    listStrategies()
      .then((items) => {
        if (!controller.signal.aborted) setStrategies(items);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setStrategiesError(resolveCompositeError(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStrategies(false);
      });
    return () => controller.abort();
  }, [isOpen]);

  const byId = useMemo(() => {
    const map = new Map<string, StrategyListItem>();
    for (const s of strategies) map.set(s.strategy_id, s);
    return map;
  }, [strategies]);

  const allocationPcts = useMemo(
    () => selectedIds.map((id) => allocations[id]),
    [selectedIds, allocations],
  );
  const allocationTotal = sumAllocations(allocationPcts);
  const balanced = isBalanced(allocationPcts);

  const draft = {
    strategyIds: selectedIds,
    allocationsPct: allocations,
    name,
    initialCashRaw: initialCash,
    maxPositionWeightRaw: maxPositionWeight,
    cashBufferRaw: cashBuffer,
  };
  const draftError = validateCompositeDraft(draft);

  /** Colour index of a sleeve, by its position in the selection. */
  function chipClass(strategyId: string): string {
    const i = selectedIds.indexOf(strategyId);
    return SLEEVE_CHIP_CLASSES[(i < 0 ? 0 : i) % SLEEVE_CHIP_CLASSES.length];
  }

  /** Display name of a sleeve: the backend's, falling back to the picked row. */
  function sleeveName(strategyId: string): string {
    const fromPreview = preview?.sleeves.find(
      (s) => s.strategy_id === strategyId,
    );
    return fromPreview?.name ?? byId.get(strategyId)?.name ?? 'Strategy';
  }

  function resetAll() {
    setStep('select');
    setSelectedIds([]);
    setAllocations({});
    setName('');
    setDescription('');
    setInitialCash('100000');
    setCadence('monthly');
    setMaxPositionWeight('');
    setCashBuffer('');
    setPreview(null);
    setPreviewLoading(false);
    setPreviewError(null);
    setSubmitting(false);
    setSubmitError(null);
  }

  function handleClose() {
    resetAll();
    onClose();
  }

  /**
   * Toggle a strategy and re-split the capital evenly.
   *
   * Re-splitting on every change is deliberate: it keeps Σ at exactly 100 % by
   * construction, so the flow is always one click from valid. Editing an
   * allocation by hand afterwards is what the inputs (and "Split evenly") are
   * for.
   */
  function toggleStrategy(strategyId: string) {
    const next = selectedIds.includes(strategyId)
      ? selectedIds.filter((id) => id !== strategyId)
      : selectedIds.length >= MAX_SLEEVES
        ? selectedIds
        : [...selectedIds, strategyId];
    if (next === selectedIds) return; // already at the cap
    setSelectedIds(next);
    setAllocations(evenAllocations(next));
    setPreview(null);
    setPreviewError(null);
  }

  function evenAllocations(ids: string[]): Record<string, number> {
    const parts = splitEvenly(ids.length);
    const next: Record<string, number> = {};
    ids.forEach((id, i) => {
      next[id] = parts[i];
    });
    return next;
  }

  function updateAllocation(strategyId: string, raw: string) {
    const parsed = raw.trim() === '' ? Number.NaN : Number(raw);
    setAllocations((prev) => ({ ...prev, [strategyId]: parsed }));
    setPreview(null);
    setPreviewError(null);
  }

  function buildPayload(): PortfolioFromStrategiesCreate {
    return {
      name: name.trim(),
      description: description.trim() || null,
      initial_cash: Number(initialCash),
      sleeves: buildSleeves(selectedIds, allocations),
      rules: {
        cadence,
        on: 'period_start',
        max_position_weight: pctToFraction(
          parseOptionalNumber(maxPositionWeight),
        ),
        // Not exposed in v1 of this modal; sent explicitly so the rules object
        // always matches `CompositeRules` field for field.
        min_position_weight: null,
        cash_buffer_pct: pctToFraction(parseOptionalNumber(cashBuffer)),
        overlap: 'sum',
      },
    };
  }

  async function handlePreview() {
    if (draftError) return;
    setStep('preview');
    setPreview(null);
    setPreviewError(null);
    setSubmitError(null);
    setPreviewLoading(true);
    try {
      setPreview(await previewPortfolioFromStrategies(buildPayload()));
    } catch (err) {
      setPreviewError(resolveCompositeError(err));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleConfirm() {
    if (draftError || !preview) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await createPortfolioFromStrategies(buildPayload());
      const portfolio = created.portfolio;
      if (portfolio) onCreated?.(portfolio);
      handleClose();
      if (portfolio) navigate(`/dashboard/analysis/${portfolio.portfolio_id}`);
    } catch (err) {
      setSubmitError(resolveCompositeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const selectionValid =
    selectedIds.length >= MIN_SLEEVES && selectedIds.length <= MAX_SLEEVES;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Portfolio from Strategies"
      description={STEP_DESCRIPTION[step]}
      size="4xl"
    >
      {step === 'select' && (
        <div className="space-y-4">
          {loadingStrategies ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
              <Loader2 size={18} className="animate-spin text-[#1e3a5f]" />
              Loading your strategies…
            </div>
          ) : strategiesError ? (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
              {strategiesError}
            </div>
          ) : strategies.length === 0 ? (
            <div className="p-6 rounded-lg border border-dashed border-gray-300 text-center text-sm text-gray-600">
              <Layers size={22} className="mx-auto mb-2 text-gray-400" />
              You have no saved strategies yet. Build one in the Strategy Builder
              and it will show up here.
            </div>
          ) : (
            <div className="max-h-80 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {strategies.map((s) => {
                const checked = selectedIds.includes(s.strategy_id);
                const full = !checked && selectedIds.length >= MAX_SLEEVES;
                const chips = specChips(s);
                return (
                  <label
                    key={s.strategy_id}
                    className={`flex items-start gap-3 p-3 transition-colors ${
                      full
                        ? 'opacity-45 cursor-not-allowed'
                        : 'cursor-pointer hover:bg-gray-50'
                    } ${checked ? 'bg-[#f0f4fa]' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={full}
                      onChange={() => toggleStrategy(s.strategy_id)}
                      className="mt-1 accent-[#1e3a5f]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">
                          {s.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          v{s.latest_version}
                        </span>
                        {chips && (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
                            {chips}
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <div className="text-xs text-gray-500 truncate">
                          {s.description}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-xs text-gray-500">
              {selectedIds.length} selected — pick between {MIN_SLEEVES} and{' '}
              {MAX_SLEEVES}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => setStep('allocate')}
                disabled={!selectionValid}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'allocate' && (
        <div className="space-y-4">
          {/* Allocations */}
          <div className="border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-medium text-gray-700">
                Capital allocation
              </span>
              <button
                type="button"
                onClick={() => setAllocations(evenAllocations(selectedIds))}
                className="inline-flex items-center gap-1.5 text-xs text-[#1e3a5f] hover:underline"
              >
                <Scale size={13} />
                Split evenly
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {selectedIds.map((id) => (
                <div key={id} className="flex items-center gap-3 px-3 py-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${chipClass(id)}`}
                    aria-hidden="true"
                  />
                  <span className="text-sm text-gray-900 truncate flex-1">
                    {byId.get(id)?.name ?? id}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={Number.isFinite(allocations[id]) ? allocations[id] : ''}
                      onChange={(e) => updateAllocation(id, e.target.value)}
                      aria-label={`Allocation for ${byId.get(id)?.name ?? id}`}
                      className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
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
              <span className="font-medium">
                {Number.isFinite(allocationTotal)
                  ? `${allocationTotal.toFixed(2)}%`
                  : '—'}
                {!balanced && ' — must be 100%'}
              </span>
            </div>
          </div>

          {/* Composite rules */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="composite-cadence"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Rebalance cadence
              </label>
              <select
                id="composite-cadence"
                value={cadence}
                onChange={(e) => setCadence(e.target.value as CompositeCadence)}
                className={FIELD_CLS}
              >
                {CADENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="composite-cap"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Max position weight (%)
              </label>
              <input
                id="composite-cap"
                type="number"
                min={0}
                max={100}
                step="0.5"
                placeholder="No cap"
                value={maxPositionWeight}
                onChange={(e) => setMaxPositionWeight(e.target.value)}
                className={FIELD_CLS}
              />
            </div>
            <div>
              <label
                htmlFor="composite-buffer"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Cash buffer (%)
              </label>
              <input
                id="composite-buffer"
                type="number"
                min={0}
                max={100}
                step="0.5"
                placeholder="None"
                value={cashBuffer}
                onChange={(e) => setCashBuffer(e.target.value)}
                className={FIELD_CLS}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            When two sleeves pick the same stock its weights add up, then the cap
            trims the result. Portfolios buy whole shares, so the final weights
            land near — not exactly on — these targets.
          </p>

          {/* Identity */}
          <Input
            label="Portfolio name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div>
            <label
              htmlFor="composite-description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description (optional)
            </label>
            <textarea
              id="composite-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={FIELD_CLS}
            />
          </div>
          <Input
            label="Initial capital (USD)"
            type="number"
            step="1000"
            value={initialCash}
            onChange={(e) => setInitialCash(e.target.value)}
          />

          {draftError && (
            <div className="p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-sm">
              {draftError}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep('select')}
            >
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handlePreview}
                disabled={draftError !== null}
              >
                Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          {previewLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
              <Loader2 size={18} className="animate-spin text-[#1e3a5f]" />
              Resolving every sleeve…
            </div>
          ) : previewError ? (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
              {previewError}
            </div>
          ) : preview ? (
            <>
              {/* Result summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <SummaryCell
                  label="Positions"
                  value={String(preview.positions_count)}
                />
                <SummaryCell
                  label="Cash left"
                  value={fmtPct(preview.cash_pct, 2)}
                />
                <SummaryCell label="Priced as of" value={fmtDate(preview.as_of)} />
                <SummaryCell
                  label="Sleeves"
                  value={String(preview.sleeves.length)}
                />
              </div>

              {/* Sleeve rail */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {preview.sleeves.map((s) => (
                  <SleeveCard
                    key={s.strategy_id}
                    sleeve={s}
                    chipCls={chipClass(s.strategy_id)}
                  />
                ))}
              </div>

              {/* Holdings */}
              <div className="max-h-72 overflow-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-gray-500">
                      <th className="px-3 py-2 font-medium">Ticker</th>
                      <th className="px-3 py-2 font-medium">Sleeves</th>
                      <th className="px-3 py-2 font-medium text-right">Price</th>
                      <th className="px-3 py-2 font-medium text-right">Shares</th>
                      <th className="px-3 py-2 font-medium text-right">Value</th>
                      <th className="px-3 py-2 font-medium text-right">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.holdings.map((h) => (
                      <tr key={h.symbol_id} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900">
                            {h.ticker}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[160px]">
                            {h.name ?? '—'}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {h.sleeves.map((sl) => (
                              <span
                                key={`${h.symbol_id}-${sl.strategy_id}`}
                                title={`${sleeveName(sl.strategy_id)} — ${fmtPct(sl.weight_pct, 2)}`}
                                className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium max-w-[130px] truncate ${chipClass(sl.strategy_id)}`}
                              >
                                {sleeveName(sl.strategy_id)} ·{' '}
                                {fmtPct(sl.weight_pct, 1)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {fmtMoney(h.price)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {h.shares}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {fmtMoney(h.est_value, 0)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-gray-900 font-medium">
                            {fmtPct(h.weight_realized_pct ?? h.weight_pct, 2)}
                          </span>
                          {h.weight_realized_pct !== null && (
                            <div className="text-[11px] text-gray-400">
                              target {fmtPct(h.weight_pct, 2)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Overlap */}
              {preview.overlap.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-700 mb-1.5">
                    Overlap — {preview.overlap.length}{' '}
                    {preview.overlap.length === 1 ? 'name' : 'names'} picked by
                    more than one sleeve
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.overlap.map((o) => (
                      <span
                        key={o.ticker}
                        title={o.sleeves.map(sleeveName).join(' + ')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray-200 bg-gray-50 text-xs text-gray-700"
                      >
                        <strong className="text-gray-900">{o.ticker}</strong>
                        <span className="flex gap-0.5">
                          {o.sleeves.map((sid) => (
                            <span
                              key={`${o.ticker}-${sid}`}
                              className={`w-2 h-2 rounded-full ${chipClass(sid)}`}
                              aria-hidden="true"
                            />
                          ))}
                        </span>
                        <span className="text-gray-500">
                          ×{o.sleeves.length}
                        </span>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Their sleeve weights are summed into a single position.
                  </p>
                </div>
              )}

              {/* Excluded */}
              {preview.excluded.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-700 mb-1.5">
                    Left out or trimmed — {preview.excluded.length}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.excluded.map((x) => {
                      const badge = EXCLUDED_REASON[x.reason];
                      return (
                        <span
                          key={`${x.ticker}-${x.reason}`}
                          className={`inline-block px-2 py-0.5 rounded text-xs ${
                            badge?.cls ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <strong>{x.ticker}</strong> — {badge?.text ?? x.reason}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-sm">
                  <div className="flex items-center gap-1.5 font-medium mb-1">
                    <AlertTriangle size={14} />
                    Warnings
                  </div>
                  <ul className="text-xs space-y-0.5 list-disc list-inside">
                    {preview.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}

          {submitError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep('allocate')}
              disabled={submitting}
            >
              Back
            </Button>
            <div className="flex items-center gap-3">
              {preview && (
                <span className="text-xs text-gray-500">
                  {preview.positions_count} position
                  {preview.positions_count === 1 ? '' : 's'} ·{' '}
                  {fmtMoney(Number(initialCash), 0)}
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                isLoading={submitting}
                disabled={!preview || draftError !== null}
              >
                {submitting ? 'Creating…' : 'Create Portfolio'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-lg px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}

function SleeveCard({
  sleeve,
  chipCls,
}: {
  sleeve: CompositeSleeveResult;
  chipCls: string;
}) {
  return (
    <div className="shrink-0 w-56 border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${chipCls}`}
          aria-hidden="true"
        />
        <span
          className="text-sm font-medium text-gray-900 truncate"
          title={sleeve.name}
        >
          {sleeve.name}
        </span>
        <span className="text-xs text-gray-400 shrink-0">v{sleeve.version}</span>
      </div>
      <div className="text-xs text-gray-600 space-y-0.5">
        <div className="flex justify-between">
          <span className="text-gray-500">Allocation</span>
          <span className="font-medium text-gray-900">
            {fmtPct(sleeve.allocation * 100, 2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">In composite</span>
          <span>{fmtPct(sleeve.target_weight_pct, 2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Names</span>
          <span>
            {sleeve.holdings_count}
            {sleeve.eligible_count !== null && (
              <span className="text-gray-400"> / {sleeve.eligible_count}</span>
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Coverage</span>
          <span>{fmtCoverage(sleeve.coverage_pct)}</span>
        </div>
        {sleeve.data_as_of && (
          <div className="flex justify-between">
            <span className="text-gray-500">Data as of</span>
            <span>{fmtDate(sleeve.data_as_of)}</span>
          </div>
        )}
      </div>
      {sleeve.warnings.length > 0 && (
        <ul className="mt-1.5 text-[11px] text-amber-800 space-y-0.5">
          {sleeve.warnings.map((w) => (
            <li key={w} className="flex gap-1">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
