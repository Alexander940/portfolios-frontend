import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, Save, Shield } from 'lucide-react';
import { Modal, Button, toast } from '@/components/ui';
import { getErrorMessage, isApiError } from '@/lib/apiErrors';
import { fmtDate, fmtMoney, fmtPct } from '@/lib/format';
import {
  applyRebalance,
  listPortfolios,
  listSharedWithMe,
  parseCreationSpec,
  previewRebalance,
  type PortfolioRankingSpec,
  type PortfolioResponse,
  type RebalanceDiffAction,
  type RebalanceDiffItem,
  type RebalancePreviewResponse,
  type RebalanceRequest,
  type RebalanceSkipReason,
  type RebalanceWeighting,
} from '@/services/portfolioService';
import { useScreenerStore } from '../stores';
import { specMatchesSelection, toApiPercentFilters } from '../services';
import { ADDITIONAL_FILTERS, FILTER_CATEGORIES } from '../constants';

interface RebalancePortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalCount: number;
  /** True while the screener results are (re)loading — Preview stays disabled. */
  resultsLoading?: boolean;
  /**
   * Prefills for the redirect flow from the portfolio view (US6 #114):
   * target preselected + saved ranking/weighting restored. Applied each time
   * the modal opens; the user can still change everything.
   */
  initialPortfolioId?: string | null;
  initialRanking?: PortfolioRankingSpec | null;
  initialWeighting?: RebalanceWeighting | null;
}

/** A rebalance target: one of the user's own portfolios or a co-owned share. */
interface TargetOption {
  portfolio: PortfolioResponse;
  shared: boolean;
}

const WEIGHTING_OPTIONS: { value: RebalanceWeighting; label: string; hint: string }[] = [
  { value: 'equal', label: 'Equal Weight', hint: 'Same allocation for every stock' },
  { value: 'rating_weighted', label: 'Rating Weighted', hint: 'Higher rating → higher weight' },
  { value: 'market_cap', label: 'Market Cap Weighted', hint: 'Larger companies get more weight' },
];

/**
 * Fields offered for the ranking cut: Rating (a primary filter, so absent from
 * ADDITIONAL_FILTERS) plus every numeric (range-type) screener field, grouped
 * by the same categories the filter menu uses. Every apiKey here is a
 * screenable FIELD_MAPPING key on the backend.
 */
const RANKING_SORT_GROUPS: { label: string; options: { value: string; label: string }[] }[] =
  FILTER_CATEGORIES.map((cat) => ({
    label: cat.label,
    options: [
      // Rating lives in the primary filters, so it is absent from
      // ADDITIONAL_FILTERS — surface it at the top of the Trend group.
      ...(cat.key === 'trendrating' ? [{ value: 'rating', label: 'Rating' }] : []),
      ...ADDITIONAL_FILTERS.filter(
        (f) => f.category === cat.key && f.type === 'range',
      ).map((f) => ({ value: f.apiKey, label: f.label })),
    ],
  })).filter((g) => g.options.length > 0);

const ACTION_ORDER: Record<RebalanceDiffAction, number> = {
  entry: 0,
  increase: 1,
  reduction: 2,
  exit: 3,
  unchanged: 4,
};

const ACTION_BADGE: Record<RebalanceDiffAction, { text: string; cls: string }> = {
  entry: { text: 'Entry', cls: 'bg-green-100 text-green-700' },
  increase: { text: 'Increase', cls: 'bg-blue-100 text-blue-700' },
  reduction: { text: 'Reduction', cls: 'bg-amber-100 text-amber-800' },
  exit: { text: 'Exit', cls: 'bg-red-100 text-red-700' },
  unchanged: { text: 'Unchanged', cls: 'bg-gray-100 text-gray-500' },
};

const COUNT_LABEL: Record<RebalanceDiffAction, [singular: string, plural: string]> = {
  entry: ['entry', 'entries'],
  increase: ['increase', 'increases'],
  reduction: ['reduction', 'reductions'],
  exit: ['exit', 'exits'],
  unchanged: ['unchanged', 'unchanged'],
};

const SKIP_REASON: Record<RebalanceSkipReason, string> = {
  no_price: 'no current price data',
  too_small: 'allocation too small to buy one share',
};

const FIELD_CLS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400';

export function RebalancePortfolioModal({
  isOpen,
  onClose,
  totalCount,
  resultsLoading = false,
  initialPortfolioId = null,
  initialRanking = null,
  initialWeighting = null,
}: RebalancePortfolioModalProps) {
  const navigate = useNavigate();
  const getApiRequest = useScreenerStore((s) => s.getApiRequest);

  const [step, setStep] = useState<'setup' | 'preview' | 'saveSpec'>('setup');

  // Target portfolios (own + co-owned shares)
  const [targets, setTargets] = useState<TargetOption[] | null>(null);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');

  // Selection spec: optional ranking cut + weighting method
  const [rankingEnabled, setRankingEnabled] = useState(false);
  const [topN, setTopN] = useState('20');
  const [sortBy, setSortBy] = useState('rating');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [weighting, setWeighting] = useState<RebalanceWeighting>('equal');
  // Prioridad para posiciones actuales (#117/#118): flag de ejecución, se
  // elige en cada rebalanceo — nunca forma parte del spec guardado.
  const [prioritizeHeld, setPrioritizeHeld] = useState(false);

  // Preview / confirm state
  const [preview, setPreview] = useState<RebalancePreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** Which saveSpec action is in flight — drives the right button's spinner. */
  const [applyChoice, setApplyChoice] = useState<'save' | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);

  const selectedTarget = useMemo(
    () => targets?.find((t) => t.portfolio.portfolio_id === selectedId) ?? null,
    [targets, selectedId],
  );

  // Apply the redirect-flow prefills every time the modal opens (state is
  // reset on close, so a later manual open re-seeds the same target).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      if (initialPortfolioId) setSelectedId(initialPortfolioId);
      if (initialRanking) {
        setRankingEnabled(true);
        setTopN(String(initialRanking.top_n));
        setSortBy(initialRanking.sort_by);
        setSortOrder(initialRanking.sort_order);
      }
      if (initialWeighting) setWeighting(initialWeighting);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initialPortfolioId, initialRanking, initialWeighting]);

  const sortedDiff = useMemo(() => {
    if (!preview) return [];
    return [...preview.diff].sort(
      (a, b) =>
        ACTION_ORDER[a.action] - ACTION_ORDER[b.action] ||
        a.ticker.localeCompare(b.ticker),
    );
  }, [preview]);

  // Load the eligible targets each time the modal opens: the user's own
  // portfolios plus the ones shared with co_owner (viewers can't rebalance).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setTargets(null);
    setTargetsError(null);
    (async () => {
      try {
        const [own, shared] = await Promise.all([
          listPortfolios(100, 0),
          listSharedWithMe(100, 0),
        ]);
        if (cancelled) return;
        setTargets([
          ...own.items.map((p) => ({ portfolio: p, shared: false })),
          ...shared.items
            .filter((p) => p.permission === 'co_owner')
            .map((p) => ({ portfolio: p, shared: true })),
        ]);
      } catch (err) {
        if (!cancelled) setTargetsError(getErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  function resetAll() {
    setStep('setup');
    setSelectedId('');
    setRankingEnabled(false);
    setTopN('20');
    setSortBy('rating');
    setSortOrder('desc');
    setWeighting('equal');
    setPrioritizeHeld(false);
    setPreview(null);
    setPreviewing(false);
    setConfirming(false);
    setApplyChoice(null);
    setError(null);
    setStaleNotice(null);
  }

  function handleClose() {
    resetAll();
    onClose();
  }

  function parsedTopN(): number | null {
    const n = Math.floor(Number(topN));
    return Number.isFinite(n) && n >= 1 ? n : null;
  }

  /**
   * Inline-mode request body: the CURRENT screener filters (same object the
   * Save-as-Portfolio flow sends, percent fields converted at the boundary),
   * minus pagination — the backend collects every match regardless.
   */
  function buildRequest(): RebalanceRequest {
    const filters = { ...toApiPercentFilters(getApiRequest()) };
    delete filters.limit;
    delete filters.offset;
    let ranking: PortfolioRankingSpec | null = null;
    if (rankingEnabled) {
      const n = parsedTopN();
      if (n !== null) {
        ranking = { sort_by: sortBy, sort_order: sortOrder, top_n: n };
      }
    }
    return {
      filters,
      ranking,
      weighting_method: weighting,
      prioritize_held: prioritizeHeld,
    };
  }

  function validate(): string | null {
    if (!selectedId) return 'Pick the portfolio to rebalance.';
    if (rankingEnabled && parsedTopN() === null) {
      return 'Number of holdings must be a whole number of at least 1.';
    }
    return null;
  }

  async function runPreview() {
    setError(null);
    setPreviewing(true);
    try {
      const resp = await previewRebalance(selectedId, buildRequest());
      setPreview(resp);
      setStep('preview');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleContinue() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setStaleNotice(null);
    await runPreview();
  }

  /**
   * The portfolio's stored creation spec, in normalized form (null when it
   * has none — from-tickers/import portfolios or a target not yet loaded).
   */
  const savedSpec = useMemo(
    () =>
      parseCreationSpec(selectedTarget?.portfolio.screener_filters ?? null),
    [selectedTarget],
  );

  /**
   * Would `update_saved_spec` be a no-op? True only when the spec about to be
   * applied (current filters + ranking) deep-equals the saved one AND the
   * weighting is unchanged (the flag also overwrites the portfolio's
   * weighting_method).
   */
  function selectionMatchesSavedSpec(): boolean {
    if (!selectedTarget) return false;
    if (selectedTarget.portfolio.weighting_method !== weighting) return false;
    const req = buildRequest();
    return specMatchesSelection(savedSpec, req.filters ?? {}, req.ranking ?? null);
  }

  /**
   * Confirm click on the preview step: skip the save-spec question when the
   * applied spec already equals the saved one (send update_saved_spec=false);
   * otherwise ask first — both for a differing spec and for a portfolio with
   * no spec yet (attach). Applies to BOTH entry paths (direct screener flow
   * and the portfolio-view redirect).
   */
  function handleConfirmClick() {
    if (!preview) return;
    if (selectionMatchesSavedSpec()) {
      void doApply(false);
    } else {
      setError(null);
      setStep('saveSpec');
    }
  }

  async function doApply(updateSavedSpec: boolean) {
    if (!preview) return;
    setError(null);
    setStaleNotice(null);
    setConfirming(true);
    setApplyChoice(updateSavedSpec ? 'save' : 'skip');
    try {
      const resp = await applyRebalance(selectedId, {
        ...buildRequest(),
        as_of: preview.as_of,
        update_saved_spec: updateSavedSpec,
      });
      const name = selectedTarget?.portfolio.name ?? 'portfolio';
      toast(
        'success',
        `Rebalanced "${name}": ${resp.n_sells} sell${resp.n_sells === 1 ? '' : 's'}, ` +
          `${resp.n_buys} buy${resp.n_buys === 1 ? '' : 's'}.` +
          (updateSavedSpec ? ' Filters saved to the portfolio.' : ''),
      );
      resetAll();
      onClose();
      navigate(`/dashboard/analysis/${resp.portfolio_id}`);
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        // Prices moved since the preview — tell the user and re-preview
        // automatically so they can confirm against the fresh plan.
        setStep('preview');
        setStaleNotice(
          'Prices changed since this preview was computed. The preview below has been refreshed — review it and confirm again.',
        );
        await runPreview();
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setConfirming(false);
      setApplyChoice(null);
    }
  }

  const noResults = totalCount === 0;
  const targetsLoading = targets === null && targetsError === null;
  const noTargets = targets !== null && targets.length === 0;
  const ownTargets = targets?.filter((t) => !t.shared) ?? [];
  const sharedTargets = targets?.filter((t) => t.shared) ?? [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Rebalance Portfolio"
      description={
        step === 'setup'
          ? 'Replace the holdings of an existing portfolio with the current screener selection.'
          : step === 'preview'
            ? 'Review the plan — nothing is executed until you confirm.'
            : 'One last thing before applying.'
      }
      size={step === 'preview' ? '2xl' : 'md'}
    >
      {step === 'setup' ? (
        <div className="space-y-4">
          {/* Target portfolio */}
          <div>
            <label
              htmlFor="rebalance-target"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Portfolio to rebalance
            </label>
            {targetsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 px-3 py-2">
                <Loader2 size={14} className="animate-spin" />
                Loading your portfolios…
              </div>
            ) : targetsError ? (
              <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
                {targetsError}
              </div>
            ) : noTargets ? (
              <div className="p-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-sm">
                You have no portfolios you can rebalance. Create one first with
                &ldquo;Save as Portfolio&rdquo;.
              </div>
            ) : (
              <select
                id="rebalance-target"
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setError(null);
                }}
                className={FIELD_CLS}
              >
                <option value="" disabled>
                  Select a portfolio…
                </option>
                {ownTargets.length > 0 && (
                  <optgroup label="My portfolios">
                    {ownTargets.map((t) => (
                      <option
                        key={t.portfolio.portfolio_id}
                        value={t.portfolio.portfolio_id}
                      >
                        {t.portfolio.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {sharedTargets.length > 0 && (
                  <optgroup label="Shared with me (co-owner)">
                    {sharedTargets.map((t) => (
                      <option
                        key={t.portfolio.portfolio_id}
                        value={t.portfolio.portfolio_id}
                      >
                        {t.portfolio.name}
                        {t.portfolio.owner_email
                          ? ` — ${t.portfolio.owner_email}`
                          : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
          </div>

          {/* Optional ranking cut */}
          <div className="p-3 rounded-lg border border-gray-200 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rankingEnabled}
                onChange={(e) => setRankingEnabled(e.target.checked)}
                className="mt-0.5 accent-[#1e3a5f]"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  Limit number of holdings
                </div>
                <div className="text-xs text-gray-500">
                  Rank the matches and keep only the top N. Off = every match
                  becomes a holding.
                </div>
              </div>
            </label>

            {rankingEnabled && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label
                    htmlFor="rebalance-top-n"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    Holdings
                  </label>
                  <input
                    id="rebalance-top-n"
                    type="number"
                    min={1}
                    step={1}
                    value={topN}
                    onChange={(e) => setTopN(e.target.value)}
                    className={FIELD_CLS}
                  />
                </div>
                <div>
                  <label
                    htmlFor="rebalance-sort-by"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    Rank by
                  </label>
                  <select
                    id="rebalance-sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className={FIELD_CLS}
                  >
                    {RANKING_SORT_GROUPS.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="rebalance-sort-order"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    Order
                  </label>
                  <select
                    id="rebalance-sort-order"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    className={FIELD_CLS}
                  >
                    <option value="desc">Highest first</option>
                    <option value="asc">Lowest first</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Prioritize current holdings (#117/#118) */}
          <div className="p-3 rounded-lg border border-gray-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                data-testid="rebalance-prioritize-held"
                checked={prioritizeHeld}
                onChange={(e) => setPrioritizeHeld(e.target.checked)}
                className="mt-0.5 accent-[#1e3a5f]"
              />
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  <Shield size={14} className="shrink-0 text-[#1e3a5f]" />
                  Prioritize current holdings
                </div>
                <div className="text-xs text-gray-500">
                  Holdings that still match the filters keep their spot no
                  matter what; the ranking only decides which new names fill
                  the remaining slots. Has no effect without a holdings limit.
                </div>
              </div>
            </label>
          </div>

          {/* Weighting method */}
          <div>
            <div className="block text-sm font-medium text-gray-700 mb-2">
              Weighting method
            </div>
            <div className="space-y-2">
              {WEIGHTING_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`
                    flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors
                    ${
                      weighting === opt.value
                        ? 'border-[#1e3a5f] bg-[#f0f4fa]'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="rebalance-weighting"
                    value={opt.value}
                    checked={weighting === opt.value}
                    onChange={() => setWeighting(opt.value)}
                    className="mt-1 accent-[#1e3a5f]"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Selection summary */}
          <div
            className={`
              flex items-center gap-2 p-3 rounded-lg text-sm
              ${
                noResults && !resultsLoading
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }
            `}
          >
            <RefreshCw size={16} />
            {resultsLoading ? (
              <span>Loading the stocks that match the current filters…</span>
            ) : noResults ? (
              <span>No stocks match the current filters.</span>
            ) : (
              <span>
                <strong>{totalCount.toLocaleString()} stocks</strong> match the
                current filters
                {rankingEnabled && parsedTopN() !== null
                  ? ` — the top ${parsedTopN()!.toLocaleString()} will become the new holdings.`
                  : ' — all of them will become the new holdings.'}
              </span>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={previewing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleContinue}
              isLoading={previewing}
              disabled={noResults || resultsLoading || !selectedId || previewing}
            >
              {previewing ? 'Computing preview…' : 'Preview Rebalance'}
            </Button>
          </div>
        </div>
      ) : step === 'preview' && preview ? (
        <div className="space-y-4">
          {/* Stale-preview notice (409 on confirm → auto re-preview) */}
          {staleNotice && (
            <div className="p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-sm">
              {staleNotice}
            </div>
          )}

          {/* Plan summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500">As of</div>
              <div className="text-sm font-medium text-gray-900">
                {fmtDate(preview.as_of)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500">Total value</div>
              <div className="text-sm font-medium text-gray-900">
                {fmtMoney(preview.total_value)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500">Turnover</div>
              <div className="text-sm font-medium text-gray-900">
                {fmtPct(preview.turnover_pct)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500">Cash after</div>
              <div className="text-sm font-medium text-gray-900">
                {fmtMoney(preview.cash_after)}
              </div>
              <div className="text-xs text-gray-500">
                before {fmtMoney(preview.cash_before)}
              </div>
            </div>
          </div>

          {/* Action counts */}
          <div className="flex flex-wrap gap-2 text-xs">
            {(
              [
                ['entry', preview.diff_summary.entries],
                ['increase', preview.diff_summary.increases],
                ['reduction', preview.diff_summary.reductions],
                ['exit', preview.diff_summary.exits],
                ['unchanged', preview.diff_summary.unchanged],
              ] as [RebalanceDiffAction, number][]
            ).map(([action, count]) => (
              <span
                key={action}
                className={`inline-block px-2 py-0.5 rounded font-medium ${ACTION_BADGE[action].cls}`}
              >
                {count} {COUNT_LABEL[action][count === 1 ? 0 : 1]}
              </span>
            ))}
            {preview.diff_summary.prioritize_held && (
              <span
                data-testid="rebalance-held-kept"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium bg-emerald-100 text-emerald-700"
                title="Current holdings still matching the filters were kept unconditionally"
              >
                <Shield size={11} />
                {preview.diff_summary.held_kept ?? 0} kept by priority
              </span>
            )}
          </div>

          {/* Diff table */}
          <div className="max-h-72 overflow-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Ticker</th>
                  <th className="px-3 py-2 font-medium text-right">Shares</th>
                  <th className="px-3 py-2 font-medium text-right">Δ</th>
                  <th className="px-3 py-2 font-medium text-right">Price</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sortedDiff.map((d: RebalanceDiffItem) => {
                  const badge = ACTION_BADGE[d.action];
                  return (
                    <tr
                      key={d.symbol_id}
                      className={`border-t border-gray-100 ${
                        d.action === 'unchanged' ? 'opacity-55' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}
                        >
                          {badge.text}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">{d.ticker}</td>
                      <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                        {d.quantity_before.toLocaleString()} →{' '}
                        {d.quantity_after.toLocaleString()}
                      </td>
                      <td
                        className={`px-3 py-2 text-right whitespace-nowrap ${
                          d.delta > 0
                            ? 'text-green-700'
                            : d.delta < 0
                              ? 'text-red-700'
                              : 'text-gray-500'
                        }`}
                      >
                        {d.delta > 0 ? `+${d.delta.toLocaleString()}` : d.delta.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {d.price !== null ? fmtMoney(d.price) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {fmtMoney(d.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Skipped target names */}
          {preview.skipped.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-sm">
              <div className="font-medium mb-1">
                {preview.skipped.length}{' '}
                {preview.skipped.length === 1 ? 'stock was' : 'stocks were'} skipped
              </div>
              <ul className="text-xs text-amber-800 space-y-0.5">
                {preview.skipped.map((s) => (
                  <li key={s.ticker}>
                    <strong>{s.ticker}</strong> — {SKIP_REASON[s.reason]}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings (e.g. stale holdings) */}
          {preview.warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-sm">
              <div className="font-medium mb-1">Warnings</div>
              <ul className="text-xs text-amber-800 space-y-0.5">
                {preview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep('setup');
                setError(null);
                setStaleNotice(null);
              }}
              disabled={confirming || previewing}
            >
              Back
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {preview.orders.length} order{preview.orders.length === 1 ? '' : 's'} will
                be executed on &ldquo;{selectedTarget?.portfolio.name ?? 'the portfolio'}&rdquo;
              </span>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={confirming || previewing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmClick}
                isLoading={confirming || previewing}
                disabled={confirming || previewing}
              >
                {confirming
                  ? 'Applying…'
                  : previewing
                    ? 'Refreshing preview…'
                    : 'Confirm Rebalance'}
              </Button>
            </div>
          </div>
        </div>
      ) : step === 'saveSpec' && preview ? (
        <div className="space-y-4">
          {/* update_saved_spec question (US6): shown only when the spec being
              applied differs from the portfolio's saved one, or when the
              portfolio has none yet. */}
          <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <Save size={16} className="shrink-0" />
              Save these filters to the portfolio?
            </div>
            <p className="text-sm text-gray-600">
              {savedSpec
                ? `The filters, ranking or weighting you are about to apply are different from the ones saved on "${
                    selectedTarget?.portfolio.name ?? 'the portfolio'
                  }". Saving them makes this selection the portfolio's spec for future rebalances.`
                : `"${
                    selectedTarget?.portfolio.name ?? 'The portfolio'
                  }" has no saved screener filters yet. You can attach this selection so future rebalances can start from it.`}
            </p>
            <p className="text-xs text-gray-500">
              Either way, the rebalance itself is applied exactly as previewed.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep('preview');
                setError(null);
              }}
              disabled={confirming}
            >
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void doApply(false)}
                isLoading={confirming && applyChoice === 'skip'}
                disabled={confirming}
              >
                Rebalance without saving
              </Button>
              <Button
                type="button"
                onClick={() => void doApply(true)}
                isLoading={confirming && applyChoice === 'save'}
                disabled={confirming}
              >
                Save filters & Rebalance
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
