import { apiClient } from '@/lib/axios';
import type { ScreenerRequest } from '@/features/screener/types';
// The composite backtest (#206) reuses the builder's backtest payloads verbatim
// (`BacktestMetricsOut` / the equity rows), so its types are imported instead of
// re-declared — a drift between the two would be invisible otherwise.
import type {
  BacktestMetrics,
  EquityPoint,
} from '@/features/strategy-builder/types';

/**
 * Position-sizing methods. The `sector_*` family (#124/#125) first gives each
 * sector its market-cap share of the FULL filtered screener universe, then
 * splits the sector budget by the suffix method — only available in flows
 * with a screener universe (create-from-screener + rebalance).
 */
export type WeightingMethod =
  | 'equal'
  | 'rating_weighted'
  | 'market_cap'
  | 'sector_equal'
  | 'sector_rating_weighted'
  | 'sector_inverse_atr_calm'
  | 'sector_market_cap'
  | 'manual';

/**
 * Effective role the caller has on a portfolio. `owner` is implicit (the primary
 * owner, never a share row); `co_owner`/`viewer` come from a share grant.
 */
export type PortfolioPermission = 'owner' | 'co_owner' | 'viewer';

/**
 * Role a share grant can carry — a subset of PortfolioPermission (ownership is
 * not "shared"; use transferOwnership for that).
 */
export type SharePermission = 'viewer' | 'co_owner';

export interface PortfolioResponse {
  portfolio_id: string;
  user_id: string;
  name: string;
  description: string | null;
  portfolio_type: string;
  currency: string;
  initial_cash: number;
  is_default: boolean;
  is_public: boolean;
  weighting_method: WeightingMethod;
  screener_filters: Record<string, unknown> | null;
  last_rebalance_date: string | null;
  analysis_start_date: string | null;
  created_at: string;
  updated_at: string;
  // Sharing — decide ownership from `is_owner`, NEVER by comparing ids
  // (client User.id is a number, user_id is a uuid string; they never match).
  is_owner: boolean | null;
  permission: PortfolioPermission | null;
  owner_email: string | null;
}

export interface PortfolioFromScreenerCreate {
  name: string;
  description?: string | null;
  initial_cash?: number;
  weighting_method?: WeightingMethod;
  screener_filters: ScreenerRequest;
}

export interface PortfolioFromScreenerResponse {
  portfolio: PortfolioResponse;
  positions_count: number;
}

export async function createPortfolioFromScreener(
  payload: PortfolioFromScreenerCreate,
  signal?: AbortSignal,
): Promise<PortfolioFromScreenerResponse> {
  const { data } = await apiClient.post<PortfolioFromScreenerResponse>(
    '/portfolios/from-screener',
    payload,
    { signal },
  );
  return data;
}

export interface PortfolioFromTickersCreate {
  name: string;
  description?: string | null;
  initial_cash?: number;
  weighting_method?: WeightingMethod;
  tickers: string[];
}

export interface PortfolioFromTickersResponse {
  portfolio: PortfolioResponse;
  positions_count: number;
  skipped_tickers: string[];
}

export async function createPortfolioFromTickers(
  payload: PortfolioFromTickersCreate,
  signal?: AbortSignal,
): Promise<PortfolioFromTickersResponse> {
  const { data } = await apiClient.post<PortfolioFromTickersResponse>(
    '/portfolios/from-tickers',
    payload,
    { signal },
  );
  return data;
}

// =============================================================================
// Excel import — server-side parse/verify (preview) then create (confirm)
// =============================================================================

export type ImportRowStatus =
  | 'found'
  | 'normalized'
  | 'not_found'
  | 'duplicate'
  | 'invalid_quantity';

export interface ImportPreviewRow {
  input_ticker: string;
  status: ImportRowStatus;
  resolved_ticker: string | null;
  symbol_id: string | null;
  name: string | null;
  recent_price: number | null;
  quantity: number | null;
}

export interface ImportPreviewResponse {
  rows: ImportPreviewRow[];
  has_quantity_column: boolean;
  found_count: number;
  not_found_count: number;
}

/**
 * Upload an .xlsx/.csv; the backend parses it (first sheet's ticker column +
 * optional `quantity` column), verifies each ticker against the catalog (with a
 * `.`→`-` share-class fallback), and returns a preview. Read-only — nothing is
 * created. Multipart upload: the JSON default Content-Type is cleared so the
 * browser sets the multipart boundary.
 */
export async function previewPortfolioFromExcel(
  file: File,
  signal?: AbortSignal,
): Promise<ImportPreviewResponse> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<ImportPreviewResponse>(
    '/portfolios/import/preview',
    form,
    { signal, timeout: 60000, headers: { 'Content-Type': undefined } },
  );
  return data;
}

export interface ImportPositionInput {
  ticker: string;
  quantity?: number | null;
}

export interface ImportConfirmCreate {
  name: string;
  description?: string | null;
  /** Analyze-from date, `YYYY-MM-DD`. */
  start_date: string;
  positions: ImportPositionInput[];
  /** Weighting mode only (omit in quantities mode). */
  initial_cash?: number | null;
  /** Weighting mode only (omit in quantities mode). */
  weighting_method?: WeightingMethod | null;
}

export type ImportSkipReason =
  | 'unknown_symbol'
  | 'no_price_asof'
  | 'before_coverage'
  | 'too_small_to_size'
  | 'invalid_quantity';

export interface SkippedTicker {
  ticker: string;
  reason: ImportSkipReason;
}

export interface ImportConfirmResponse {
  portfolio: PortfolioResponse;
  positions_count: number;
  /** The effective trading day the portfolio was anchored at. */
  analysis_start_date: string;
  skipped: SkippedTicker[];
}

/**
 * Create a portfolio from the confirmed preview, anchored at `start_date` with
 * as-of prices, and backfill its snapshot series. Two mutually exclusive modes:
 * - quantities: every position has a `quantity`; omit `initial_cash`/`weighting_method`.
 * - weighting: no position has a `quantity`; send `initial_cash` + `weighting_method`.
 */
export async function confirmImportPortfolio(
  payload: ImportConfirmCreate,
  signal?: AbortSignal,
): Promise<ImportConfirmResponse> {
  const { data } = await apiClient.post<ImportConfirmResponse>(
    '/portfolios/import/confirm',
    payload,
    { signal },
  );
  return data;
}

export interface PortfolioList {
  items: PortfolioResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface PortfolioPositionDetail {
  position_id: string;
  symbol_id: string;
  ticker: string;
  name: string;
  sector: string | null;
  country: string | null;
  quantity: number;
  average_cost: number;
  weight_pct: number | null;
  entry_date: string | null;
  entry_rating: number | null;
  current_price: number | null;
  current_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  current_rating: number | null;
  rating_changed: boolean;
}

export interface PortfolioPositionDetailList {
  items: PortfolioPositionDetail[];
  total: number;
  limit: number;
  offset: number;
}

export type PositionSortField =
  | 'weight'
  | 'pnl_pct'
  | 'ticker'
  | 'entry_date'
  | 'current_value';

export type SortOrder = 'asc' | 'desc';

export async function listPortfolios(
  limit = 50,
  offset = 0,
  signal?: AbortSignal,
): Promise<PortfolioList> {
  const { data } = await apiClient.get<PortfolioList>('/portfolios/', {
    params: { limit, offset },
    signal,
  });
  return data;
}

export async function deletePortfolio(
  portfolioId: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiClient.delete(`/portfolios/${portfolioId}`, { signal });
}

/**
 * Export the holdings of the selected portfolios as one `.xlsx` (one sheet per
 * portfolio). POST /portfolios/export. The caller triggers the browser download
 * from the returned blob.
 */
export async function exportPortfolios(
  portfolioIds: string[],
  signal?: AbortSignal,
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiClient.post<Blob>(
    '/portfolios/export',
    { portfolio_ids: portfolioIds },
    { responseType: 'blob', signal },
  );
  return {
    blob: response.data,
    filename: _exportFilename(
      response.headers['content-disposition'] as string | undefined,
    ),
  };
}

function _exportFilename(disposition: string | undefined): string {
  if (!disposition) return 'portfolios.xlsx';
  const quoted = /filename="([^"]+)"/i.exec(disposition);
  if (quoted) return quoted[1];
  const unquoted = /filename=([^;]+)/i.exec(disposition);
  if (unquoted) return unquoted[1].trim();
  return 'portfolios.xlsx';
}

export async function getPortfolio(
  portfolioId: string,
  signal?: AbortSignal,
): Promise<PortfolioResponse> {
  const { data } = await apiClient.get<PortfolioResponse>(
    `/portfolios/${portfolioId}`,
    { signal },
  );
  return data;
}

export async function listPortfolioPositions(
  portfolioId: string,
  params: {
    sort_by?: PositionSortField;
    sort_order?: SortOrder;
    limit?: number;
    offset?: number;
  } = {},
  signal?: AbortSignal,
): Promise<PortfolioPositionDetailList> {
  const { data } = await apiClient.get<PortfolioPositionDetailList>(
    `/portfolios/${portfolioId}/positions`,
    {
      params: {
        sort_by: params.sort_by ?? 'weight',
        sort_order: params.sort_order ?? 'desc',
        limit: params.limit ?? 200,
        offset: params.offset ?? 0,
      },
      signal,
    },
  );
  return data;
}

// =============================================================================
// Rebalance — preview the diff toward the current screener selection, then
// confirm (Alexander940/portfolios-backend#111 / #113)
// =============================================================================

/**
 * Weighting methods the rebalance endpoints accept — `manual` is rejected by
 * the backend validator (a rebalance always re-sizes from a rule).
 */
export type RebalanceWeighting = Exclude<WeightingMethod, 'manual'>;

/**
 * Cross-sectional ranking cut applied to the screener matches before sizing:
 * order by `sort_by` (any screenable field) in `sort_order` and keep the best
 * `top_n`. A `top_n` larger than the match count keeps everything.
 */
export interface PortfolioRankingSpec {
  sort_by: string;
  sort_order: SortOrder;
  top_n: number;
  per_sector?: number | null;
}

/**
 * Body of POST /portfolios/{id}/rebalance/preview. Two mutually exclusive
 * modes: inline (`filters` + optional `ranking` + `weighting_method`) or
 * `use_saved: true` (replay the portfolio's stored spec — no filters/ranking).
 */
export interface RebalanceRequest {
  use_saved?: boolean;
  filters?: ScreenerRequest | null;
  ranking?: PortfolioRankingSpec | null;
  weighting_method?: RebalanceWeighting;
  /**
   * Prioridad para posiciones actuales (#117/#118): las que siguen cumpliendo
   * los filtros quedan sí o sí (bypasean el corte top_n del ranking); los
   * candidatos nuevos compiten por los cupos restantes. Flag de ejecución —
   * válido con ambos modos, nunca se persiste dentro del spec guardado.
   */
  prioritize_held?: boolean;
}

/**
 * Body of POST /portfolios/{id}/rebalance (the confirm step). `as_of` must be
 * the date the preview returned — the backend answers 409 when newer prices
 * arrived in between (re-preview and confirm again). `update_saved_spec` also
 * stores the applied filters+ranking as the portfolio's saved spec (US6 —
 * always send false from the US5 flow).
 */
export interface RebalanceApplyRequest extends RebalanceRequest {
  /** ISO date `YYYY-MM-DD`, echoed from the preview response. */
  as_of: string;
  update_saved_spec?: boolean;
}

export type RebalanceDiffAction =
  | 'exit'
  | 'entry'
  | 'increase'
  | 'reduction'
  | 'unchanged';

/**
 * Per-symbol diff between the current position and the sized target.
 * `delta` = quantity_after − quantity_before (signed); `amount` = |delta| ×
 * price. Decimals arrive as strings. `price` is null only for a held symbol
 * with no price data at all (kept untouched + warned, never traded).
 */
export interface RebalanceDiffItem {
  symbol_id: string;
  ticker: string;
  action: RebalanceDiffAction;
  quantity_before: number;
  quantity_after: number;
  delta: number;
  price: string | null;
  amount: string;
  /** Target's screener rating; null when the symbol left the target. */
  rating: number | null;
}

/** One executable order of the plan (sells listed before buys). */
export interface RebalanceOrderItem {
  symbol_id: string;
  ticker: string;
  side: 'sell' | 'buy';
  quantity: number;
  price: string;
  total_amount: string;
}

export type RebalanceSkipReason = 'no_price' | 'too_small';

/** A target name dropped from the plan, with the reason. */
export interface RebalanceSkippedItem {
  ticker: string;
  reason: RebalanceSkipReason;
}

export interface RebalancePreStateHolding {
  symbol_id: string;
  ticker: string;
  qty: number;
  /** Null (along with value/weight_pct/unrealized_pnl) when the position had no price data. */
  price: number | null;
  value: number | null;
  weight_pct: number | null;
  avg_cost: number;
  unrealized_pnl: number | null;
  sector: string | null;
}

/** Snapshot of the portfolio BEFORE the rebalance (floats, not Decimals). */
export interface RebalancePreState {
  totals: { total_value: number; cash: number; invested: number };
  holdings: RebalancePreStateHolding[];
  sector_breakdown: { sector: string; value: number; weight_pct: number }[];
}

export interface RebalanceDiffSummary {
  exits: number;
  entries: number;
  increases: number;
  reductions: number;
  unchanged: number;
  turnover_pct: number;
  /** #118 — whether the plan ran with held-priority (optional: older rows lack it). */
  prioritize_held?: boolean;
  /** Held positions protected into the final target by the priority (0 when off). */
  held_kept?: number;
  skipped: RebalanceSkippedItem[];
  warnings: string[];
}

/**
 * The full rebalance plan. Decimal fields (`total_value`, `cash_*`,
 * `turnover_pct`, item prices/amounts) are serialized as strings by the
 * backend. `as_of` must be echoed back in the confirm request.
 */
export interface RebalancePreviewResponse {
  portfolio_id: string;
  as_of: string;
  weighting_method: WeightingMethod;
  total_value: string;
  cash_before: string;
  cash_after: string;
  turnover_pct: string;
  pre_state: RebalancePreState;
  diff: RebalanceDiffItem[];
  orders: RebalanceOrderItem[];
  diff_summary: RebalanceDiffSummary;
  spec_used: Record<string, unknown>;
  /** Sector-balanced plans (#125): target allocation per sector (pre
   * whole-share rounding, sums to ~100). Absent/null for plain methods. */
  sector_weights?: Record<string, number> | null;
  /**
   * Mangas resueltas del plan (#204). Presente SOLO en el preview de un
   * portafolio compuesto; ausente/null en los planes v1/v2, que no tienen
   * mangas. Ver `RebalanceSleeveResolved` en el bloque «Composite sleeves».
   */
  sleeves?: RebalanceSleeveResolved[] | null;
  skipped: RebalanceSkippedItem[];
  warnings: string[];
}

// =============================================================================
// Creation spec (`PortfolioResponse.screener_filters`) — versioned format.
// Mirror of backend app/services/portfolio_spec.py (#110 / #114).
// =============================================================================

/** Version written by the backend today. */
export const CREATION_SPEC_VERSION = 2;

/** Version assigned on read to legacy flat dicts (pre-#110). Never stored. */
export const LEGACY_SPEC_VERSION = 1;

/**
 * Normalized view of a stored creation spec, whatever its on-disk format.
 * `filters` is a serialized ScreenerRequest in API units (percent fields are
 * fractions, numerics may arrive as strings — the backend dumps Decimals as
 * JSON strings); `ranking` is a serialized PortfolioRankingSpec or null.
 * Both are left untyped on purpose: stored specs may predate the current
 * schemas, so validation belongs to the consumer that replays them.
 */
export interface ParsedCreationSpec {
  version: number;
  filters: Record<string, unknown>;
  ranking: Record<string, unknown> | null;
  /** v3 (composite portfolio, épica #197): `"composite"`. Absent in v1/v2. */
  kind: string | null;
  /** v3 `rules` block (cadence, on, max_position_weight…). Null in v1/v2. */
  rules: Record<string, unknown> | null;
}

/**
 * Read a stored `screener_filters` value in any known format. Mirror of the
 * backend's `parse_creation_spec`:
 * - `null` (from-tickers / import portfolios) → `null`.
 * - Flat dict without a `version` key → legacy: the dict IS the serialized
 *   ScreenerRequest → `version=1, filters=raw, ranking=null`.
 * - Versioned dict (v2 or any future version) → passed through as-is; extra
 *   keys (e.g. a future `weighting_method`) are ignored, and unknown future
 *   versions never throw — consumers decide what to do with them.
 * - v3 (composite, #197) carries no screener filters at all: `kind` and `rules`
 *   are surfaced so callers can tell a composite from a screener portfolio,
 *   and `filters` stays `{}` rather than throwing.
 */
export function parseCreationSpec(
  raw: Record<string, unknown> | null | undefined,
): ParsedCreationSpec | null {
  if (raw === null || raw === undefined) return null;
  if (!('version' in raw)) {
    return {
      version: LEGACY_SPEC_VERSION,
      filters: raw,
      ranking: null,
      kind: null,
      rules: null,
    };
  }
  const filters =
    raw.filters && typeof raw.filters === 'object' && !Array.isArray(raw.filters)
      ? (raw.filters as Record<string, unknown>)
      : {};
  const ranking =
    raw.ranking && typeof raw.ranking === 'object' && !Array.isArray(raw.ranking)
      ? (raw.ranking as Record<string, unknown>)
      : null;
  const rules =
    raw.rules && typeof raw.rules === 'object' && !Array.isArray(raw.rules)
      ? (raw.rules as Record<string, unknown>)
      : null;
  const kind = typeof raw.kind === 'string' ? raw.kind : null;
  const version =
    typeof raw.version === 'number' ? raw.version : Number(raw.version);
  return { version, filters, ranking, kind, rules };
}

/** Spec version written for a composite portfolio (#197). */
export const COMPOSITE_SPEC_VERSION = 3;

/**
 * Whether a portfolio was created from strategy sleeves (composite, #197).
 * Reads the stored creation spec: `version === 3` OR `kind === "composite"` —
 * either marker alone is enough, so a future v4 that keeps the `kind` still
 * reads as composite.
 */
export function isCompositePortfolio(
  portfolio: Pick<PortfolioResponse, 'screener_filters'> | null | undefined,
): boolean {
  const spec = parseCreationSpec(portfolio?.screener_filters);
  if (!spec) return false;
  return spec.version === COMPOSITE_SPEC_VERSION || spec.kind === 'composite';
}

/**
 * React-router `location.state` contract for the "Rebalance" button on the
 * portfolio view (US6 #114): the portfolio view navigates to the screener with
 * this payload; the screener preloads the saved filters, opens the rebalance
 * modal with the target preselected, and clears the history state so a refresh
 * doesn't replay the redirect.
 */
export interface RebalanceRedirectState {
  rebalanceRedirect: {
    portfolioId: string;
    portfolioName: string;
    /** Raw `PortfolioResponse.screener_filters` (any known format, or null). */
    screenerFilters: Record<string, unknown> | null;
    /** The portfolio's stored weighting (column, not spec). */
    weightingMethod: WeightingMethod;
  };
}

/** Summary after applying a rebalance. */
export interface RebalanceApplyResponse {
  portfolio_id: string;
  as_of: string;
  n_sells: number;
  n_buys: number;
  cash_after: string;
  positions_count: number;
}

/**
 * Compute the rebalance plan (read-only — writes nothing). Requires co_owner
 * or better on the target portfolio.
 */
export async function previewRebalance(
  portfolioId: string,
  payload: RebalanceRequest,
  signal?: AbortSignal,
): Promise<RebalancePreviewResponse> {
  const { data } = await apiClient.post<RebalancePreviewResponse>(
    `/portfolios/${portfolioId}/rebalance/preview`,
    payload,
    { signal },
  );
  return data;
}

/**
 * Apply the rebalance previously previewed. Answers 409 when `as_of` is stale
 * (newer prices arrived since the preview) — re-preview and confirm again.
 */
export async function applyRebalance(
  portfolioId: string,
  payload: RebalanceApplyRequest,
  signal?: AbortSignal,
): Promise<RebalanceApplyResponse> {
  const { data } = await apiClient.post<RebalanceApplyResponse>(
    `/portfolios/${portfolioId}/rebalance`,
    payload,
    { signal },
  );
  return data;
}

// =============================================================================
// Rebalance history — list + detail of applied rebalances (US7 #115; endpoints
// from backend #112). Read access: ANY role on the portfolio, viewer included.
// =============================================================================

/** One applied rebalance, as listed by GET /portfolios/{id}/rebalances. */
export interface RebalanceHistoryItem {
  rebalance_id: string;
  /** Trading day the plan was priced at, `YYYY-MM-DD`. */
  rebalance_date: string;
  /** Wall-clock instant the rebalance was confirmed (ISO timestamp). */
  executed_at: string;
  /** Null when the executing user was since deleted. */
  executed_by_email: string | null;
  diff_summary: RebalanceDiffSummary;
}

export interface RebalanceHistoryList {
  items: RebalanceHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Selection spec stored with the rebalance (versioned, same family as the
 * portfolio creation spec). Loosely typed on purpose: stored specs may predate
 * the current schemas, so every key is optional and `filters`/`ranking` stay
 * untyped for the consumer to interpret.
 */
export interface RebalanceSpecUsed {
  version?: number;
  filters?: Record<string, unknown> | null;
  ranking?: Record<string, unknown> | null;
  weighting_method?: string | null;
  /** Audit key (#119): the priority flag the rebalance actually ran with. */
  prioritize_held?: boolean | null;
  /** Audit key (#125): the per-sector target allocation a sector-balanced
   * rebalance actually used (sector → pct). Absent for plain methods. */
  sector_weights?: Record<string, number> | null;
  /** v3 (compuesto, #204): `"composite"`. Ausente en v1/v2. */
  kind?: string | null;
  /** v3: las reglas de fusión con las que corrió el plan. */
  rules?: Record<string, unknown> | null;
  /** v3: las mangas con las que se armó el target (ver `RebalanceSpecSleeve`). */
  sleeves?: RebalanceSpecSleeve[] | null;
}

/**
 * Una manga dentro de `spec_used` de un rebalanceo compuesto (#204).
 *
 * NO es el shape de `SleeveBreakdownItem`: el historial guarda la AUDITORÍA de
 * lo que se usó (qué versión, con qué asignación y si resolvió), no el
 * desglose vivo — en particular puede no traer el nombre de la estrategia, que
 * la vista resuelve o degrada a un id corto. Todo opcional a propósito: es un
 * registro inmutable que puede predatar cualquier cambio de schema.
 */
export interface RebalanceSpecSleeve {
  strategy_id?: string;
  /** Presente solo si el backend lo denormaliza; si no, se muestra el id. */
  name?: string | null;
  strategy_version_id?: string | null;
  /** Versión de la estrategia con la que se resolvió la manga. */
  version?: number | null;
  /** FRACCIÓN (0,60 = 60 %). */
  allocation?: number | null;
  as_of?: string | null;
  data_as_of?: string | null;
  /** FRACCIÓN. */
  coverage_pct?: number | null;
  /** `false` = se mantuvo su último target en vez de liquidar su parte. */
  resolved?: boolean | null;
}

/**
 * Full record from GET /portfolios/{id}/rebalances/{rebalance_id}: the list
 * item plus the snapshot of the portfolio just BEFORE the rebalance and the
 * spec that produced the plan (`spec_used` nullable for robustness).
 */
export interface RebalanceHistoryDetail extends RebalanceHistoryItem {
  portfolio_id: string;
  pre_state: RebalancePreState;
  spec_used: RebalanceSpecUsed | null;
}

/**
 * Rebalance history of a portfolio, newest first (rebalance_date DESC,
 * executed_at DESC). Viewer or better.
 */
export async function listRebalanceHistory(
  portfolioId: string,
  params: { limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<RebalanceHistoryList> {
  const { data } = await apiClient.get<RebalanceHistoryList>(
    `/portfolios/${portfolioId}/rebalances`,
    {
      params: { limit: params.limit ?? 50, offset: params.offset ?? 0 },
      signal,
    },
  );
  return data;
}

/**
 * One historical rebalance with `pre_state` + `spec_used`. The backend answers
 * 404 when the id does not exist or belongs to another portfolio.
 */
export async function getRebalanceDetail(
  portfolioId: string,
  rebalanceId: string,
  signal?: AbortSignal,
): Promise<RebalanceHistoryDetail> {
  const { data } = await apiClient.get<RebalanceHistoryDetail>(
    `/portfolios/${portfolioId}/rebalances/${rebalanceId}`,
    { signal },
  );
  return data;
}

// =============================================================================
// Performance curve (portfolio vs benchmark, total return)
// =============================================================================

export type CurveBaseMode = 'index_100' | 'initial_cash';

export interface PerformanceCurvePoint {
  date: string;
  portfolio_value: number;
  portfolio_return_pct: number;
  benchmark_value: number | null;
  benchmark_return_pct: number | null;
  relative_return_pct: number | null;
}

export interface PerformanceCurveResponse {
  portfolio_id: string;
  benchmark: string;
  return_basis: string;
  base_mode: CurveBaseMode;
  base: number;
  benchmark_available: boolean;
  start_date: string | null;
  end_date: string | null;
  points: PerformanceCurvePoint[];
}

/**
 * Rebased portfolio-vs-benchmark (total-return) equity curve for charting.
 * Both series start at the same base — 100 (`index_100`, read % directly) or
 * the portfolio's initial cash (`initial_cash`, "growth of the same dollars").
 */
export async function getPerformanceCurve(
  portfolioId: string,
  params: {
    benchmark?: string;
    base_mode?: CurveBaseMode;
    start?: string;
    end?: string;
  } = {},
  signal?: AbortSignal,
): Promise<PerformanceCurveResponse> {
  const { data } = await apiClient.get<PerformanceCurveResponse>(
    `/portfolios/${portfolioId}/performance/curve`,
    {
      params: {
        benchmark: params.benchmark ?? 'SPY',
        base_mode: params.base_mode ?? 'index_100',
        ...(params.start ? { start: params.start } : {}),
        ...(params.end ? { end: params.end } : {}),
      },
      signal,
    },
  );
  return data;
}

// =============================================================================
// Relevant events (rating upgrades/downgrades + price movers across holdings)
// =============================================================================

export type EventPeriod = 'today' | 'week';
export type RelevantEventType = 'all' | 'upgrades' | 'downgrades' | 'movers';

export interface RelevantEvent {
  event_type: 'upgrade' | 'downgrade' | 'mover';
  ticker: string;
  name: string;
  sector: string | null;
  /** Portfolio chosen for this symbol (highest current value). */
  portfolio_id: string;
  portfolio_name: string;
  /** Populated for upgrade/downgrade. */
  previous_rating: number | null;
  current_rating: number | null;
  rating_delta: number | null;
  /** Populated for movers; sign = direction (e.g. -4.8 = down 4.8%). */
  move_pct: number | null;
  /** Rating change date for upgrades/downgrades; latest perf date for movers. */
  as_of: string | null;
  /** How many of the user's portfolios hold this symbol. */
  held_in_portfolios: number;
}

export interface RelevantEventList {
  items: RelevantEvent[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Aggregated "relevant events" across the user's portfolios: rating
 * upgrades/downgrades (window-based) and notable price movers among holdings.
 * Each symbol appears once (deduped to its highest-value portfolio).
 *
 * When `portfolio_id` is provided, events are scoped to the holdings of that
 * single portfolio (which must belong to the authenticated user); when omitted,
 * the feed aggregates across ALL of the user's portfolios.
 */
export async function getRelevantEvents(
  params: {
    period: EventPeriod;
    type: RelevantEventType;
    min_move_pct?: number;
    limit?: number;
    offset?: number;
    portfolio_id?: string;
  },
  signal?: AbortSignal,
): Promise<RelevantEventList> {
  const { data } = await apiClient.get<RelevantEventList>('/portfolios/events', {
    params,
    signal,
  });
  return data;
}

// =============================================================================
// Portfolio summary (aggregate stat cards for the Portfolio Analysis page)
// =============================================================================

export interface EventsCount {
  upgrades: number;
  downgrades: number;
  total: number;
}

export interface PortfolioSummary {
  as_of: string | null;
  currency: string;
  total_aum: number | null;
  todays_pnl_abs: number | null;
  todays_pnl_pct: number | null;
  ytd_pct: number | null;
  ytd_anchor_date: string | null;
  events_24h: EventsCount;
}

/**
 * Aggregate summary metrics across ALL of the user's portfolios, powering the
 * four stat cards at the top of the Portfolio Analysis page: total AUM,
 * AUM-weighted YTD, today's P&L (abs + value-weighted pct), and the 24h rating
 * events count. When the user has no portfolios/snapshots, the numeric fields
 * and `as_of` are null and `events_24h` is all zeros.
 */
export async function getPortfolioSummary(
  signal?: AbortSignal,
): Promise<PortfolioSummary> {
  const { data } = await apiClient.get<PortfolioSummary>('/portfolios/summary', {
    signal,
  });
  return data;
}

// =============================================================================
// Sharing — grant/list/change/revoke collaborators + transfer ownership
// =============================================================================

export interface ShareResponse {
  share_id: string;
  portfolio_id: string;
  shared_with_user_id: string;
  email: string;
  permission: SharePermission;
  created_at: string;
}

export interface ShareList {
  items: ShareResponse[];
  total: number;
}

export interface ShareCreate {
  email: string;
  /** Defaults to `viewer` on the backend when omitted. */
  permission?: SharePermission;
}

export interface ShareUpdate {
  permission: SharePermission;
}

export interface TransferRequest {
  email: string;
}

/**
 * Portfolios shared WITH the current user. Same shape as `listPortfolios`; each
 * item carries `is_owner=false`, its `permission`, and the `owner_email`.
 */
export async function listSharedWithMe(
  limit = 50,
  offset = 0,
  signal?: AbortSignal,
): Promise<PortfolioList> {
  const { data } = await apiClient.get<PortfolioList>(
    '/portfolios/shared-with-me',
    { params: { limit, offset }, signal },
  );
  return data;
}

/** Collaborators on a portfolio. Owner/co_owner only. */
export async function listShares(
  portfolioId: string,
  signal?: AbortSignal,
): Promise<ShareList> {
  const { data } = await apiClient.get<ShareList>(
    `/portfolios/${portfolioId}/shares`,
    { signal },
  );
  return data;
}

/** Invite a registered user by email. Co_owner grants require the owner. */
export async function createShare(
  portfolioId: string,
  payload: ShareCreate,
  signal?: AbortSignal,
): Promise<ShareResponse> {
  const { data } = await apiClient.post<ShareResponse>(
    `/portfolios/${portfolioId}/shares`,
    payload,
    { signal },
  );
  return data;
}

/** Change a collaborator's role. Promoting to/from co_owner requires the owner. */
export async function updateShare(
  portfolioId: string,
  userId: string,
  payload: ShareUpdate,
  signal?: AbortSignal,
): Promise<ShareResponse> {
  const { data } = await apiClient.patch<ShareResponse>(
    `/portfolios/${portfolioId}/shares/${userId}`,
    payload,
    { signal },
  );
  return data;
}

/** Revoke a collaborator's access. */
export async function deleteShare(
  portfolioId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiClient.delete(`/portfolios/${portfolioId}/shares/${userId}`, {
    signal,
  });
}

/**
 * Transfer ownership to another registered user. Owner-only; the caller becomes
 * a co_owner afterwards (the returned portfolio reflects the new perspective).
 */
export async function transferOwnership(
  portfolioId: string,
  payload: TransferRequest,
  signal?: AbortSignal,
): Promise<PortfolioResponse> {
  const { data } = await apiClient.post<PortfolioResponse>(
    `/portfolios/${portfolioId}/transfer`,
    payload,
    { signal },
  );
  return data;
}

// =============================================================================
// Composite portfolio — create from strategy sleeves (épica #197, issues #202/#207)
// =============================================================================
//
// Mirror of the JSON contract fixed by the backend design doc of #202
// (`docs/loops-history/issue-202/design.md`, section «Contrato»). Everything the
// composite flow assumes about the backend lives in THIS block, so a drift in
// the contract is reconciled here and nowhere else.
//
// UNITS — the contract mixes them on purpose, so read the doc comments:
//   · `allocation`, `max_position_weight`, `min_position_weight`,
//     `cash_buffer_pct` and `coverage_pct` are FRACTIONS (0.60 = 60 %).
//   · `weight_pct`, `weight_realized_pct`, `target_weight_pct` and `cash_pct`
//     are PERCENTAGES (10.0 = 10 %).

/** Rebalance schedule of a composite. Same vocabulary as a strategy spec. */
export type CompositeCadence =
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual';

/** Day of the period the composite rebalance fires on. */
export type CompositeRebalanceOn = 'period_start' | 'period_end';

/** What happens when two sleeves pick the same ticker. Only `sum` exists in v1. */
export type CompositeOverlapPolicy = 'sum';

/** One sleeve of the request: a strategy and the share of capital it gets. */
export interface SleeveAllocation {
  strategy_id: string;
  /** Fraction in (0, 1]; the sleeves must add up to 1 ± 1e-6 (backend 422). */
  allocation: number;
}

/**
 * `CompositeRules` (backend `app/schemas/portfolio.py`). `extra="forbid"` on the
 * backend model: never send a key that is not declared here.
 */
export interface CompositeRules {
  cadence: CompositeCadence;
  on: CompositeRebalanceOn;
  /** Per-NAME cap, a fraction in (0, 1]. `null` = uncapped. */
  max_position_weight: number | null;
  /** Per-NAME floor, a fraction in (0, 1) EXCLUSIVE, below the cap. `null` = none. */
  min_position_weight: number | null;
  /** Capital deliberately left in cash, a fraction in (0, 1) EXCLUSIVE. `null` = none. */
  cash_buffer_pct: number | null;
  overlap: CompositeOverlapPolicy;
}

export interface PortfolioFromStrategiesCreate {
  name: string;
  description?: string | null;
  /** Backend minimum: 1000. */
  initial_cash: number;
  /** 2–10 sleeves, unique `strategy_id`, Σ `allocation` = 1. */
  sleeves: SleeveAllocation[];
  rules: CompositeRules;
}

/** Per-sleeve outcome of resolving a strategy's target holdings. */
export interface CompositeSleeveResult {
  strategy_id: string;
  /** Strategy name as stored server-side (the modal falls back to it). */
  name: string;
  /** Strategy version the sleeve was resolved against. */
  version: number;
  /** The requested share of capital, a FRACTION. */
  allocation: number;
  /** Universe coverage, a FRACTION (0.97 = 97 %). Below 0.5 the backend 422s. */
  coverage_pct: number | null;
  eligible_count: number | null;
  as_of: string | null;
  data_as_of: string | null;
  holdings_count: number;
  /** Share of the composite this sleeve actually claims, as a PERCENTAGE. */
  target_weight_pct: number | null;
  warnings: string[];
}

/** How much of a holding's weight came from one sleeve (a PERCENTAGE). */
export interface CompositeHoldingSleeve {
  strategy_id: string;
  weight_pct: number;
}

export interface CompositeHolding {
  symbol_id: string;
  ticker: string;
  name: string | null;
  sector: string | null;
  price: number | null;
  /** Merged target weight after cap/floor, a PERCENTAGE. */
  weight_pct: number;
  shares: number;
  est_value: number;
  /** Weight after whole-share rounding, a PERCENTAGE. */
  weight_realized_pct: number | null;
  /** Which sleeves contributed, and how much. Length > 1 = overlap. */
  sleeves: CompositeHoldingSleeve[];
}

/** A name selected by ≥ 2 sleeves. `sleeves` holds the `strategy_id`s. */
export interface CompositeOverlapItem {
  ticker: string;
  sleeves: string[];
}

/**
 * Why a name is reported apart. `capped` is INFORMATIVE — the name stays in the
 * book with its weight already trimmed by `max_position_weight`; the other three
 * mean the name is not bought.
 */
export type CompositeExcludedReason =
  | 'no_price'
  | 'too_small'
  | 'capped'
  | 'below_floor';

export interface CompositeExcludedItem {
  ticker: string;
  reason: CompositeExcludedReason;
}

/**
 * Response of BOTH endpoints. `portfolio` is present only on create — the
 * preview writes nothing, so it comes back absent/null there.
 */
export interface PortfolioFromStrategiesResponse {
  portfolio?: PortfolioResponse | null;
  positions_count: number;
  as_of: string | null;
  /** Cash left over as a PERCENTAGE of the initial capital. */
  cash_pct: number;
  /** How sleeve weights were attributed, e.g. `proportional_to_target`. */
  attribution: string;
  sleeves: CompositeSleeveResult[];
  holdings: CompositeHolding[];
  overlap: CompositeOverlapItem[];
  excluded: CompositeExcludedItem[];
  warnings: string[];
}

/**
 * Dry-run of the composite: resolves every sleeve, merges the weights under the
 * rules and sizes whole shares — WITHOUT writing anything. Same numbers the
 * create call returns (the backend is deterministic between the two), so the
 * modal only paints what comes back; it never recomputes a weight.
 *
 * 422 when coverage is too low for a sleeve (the `detail` names it), when the
 * allocations do not add up to 1, or when the rules are out of range; 404 when a
 * `strategy_id` is not the caller's (not enumerable).
 */
export async function previewPortfolioFromStrategies(
  payload: PortfolioFromStrategiesCreate,
  signal?: AbortSignal,
): Promise<PortfolioFromStrategiesResponse> {
  const { data } = await apiClient.post<PortfolioFromStrategiesResponse>(
    '/portfolios/from-strategies/preview',
    payload,
    { signal },
  );
  return data;
}

/**
 * Create the composite portfolio: positions, ledger and snapshots, plus the
 * sleeve rows that let it be rebalanced later. Same payload as the preview.
 */
export async function createPortfolioFromStrategies(
  payload: PortfolioFromStrategiesCreate,
  signal?: AbortSignal,
): Promise<PortfolioFromStrategiesResponse> {
  const { data } = await apiClient.post<PortfolioFromStrategiesResponse>(
    '/portfolios/from-strategies',
    payload,
    { signal },
  );
  return data;
}

// =============================================================================
// Composite backtest (#206/#209) — mezcla de las curvas de los backtests hijos
// =============================================================================

/**
 * A sleeve while its backtest is still queued/running (202 payload). The
 * composite result cannot be computed until every child reaches `done`.
 */
export interface CompositeBacktestPendingChild {
  strategy_id: string;
  version: number;
  job_id: string;
  status: 'queued' | 'running' | 'done' | 'error';
}

/** 202: at least one child backtest is not `done` yet — the caller polls
 *  `GET /backtests/{job_id}` for each pending child and re-POSTs afterwards. */
export interface CompositeBacktestPending {
  status: 'pending';
  children: CompositeBacktestPendingChild[];
}

/** A sleeve in the 200 payload. NOTE: it carries metrics only — the child's
 *  equity curve is NOT in this response; fetch it with `getBacktest(job_id)`. */
export interface CompositeBacktestChild {
  strategy_id: string;
  name: string;
  version: number;
  job_id: string;
  allocation: number;
  window_start: string;
  window_end: string;
  metrics: BacktestMetrics;
}

/**
 * Keys the backend documents in `approximations`. Typed as a union for the
 * copy map, but the response field stays `string[]`: an unknown future key
 * must render (as its raw key) instead of breaking the view.
 */
export type CompositeApproximationKey =
  | 'no_overlap_netting'
  | 'double_counted_costs_on_shared_names'
  | 'fractional_shares'
  | 'composite_cap_not_applied'
  | 'no_remix_costs';

/** 200: the blended curve + metrics, the sleeves, and what it approximates. */
export interface CompositeBacktestDone {
  status: 'done';
  /** Always `composite_curve_approx` — this is NOT an engine backtest. */
  fill_convention: string;
  /** Common window = intersection of the children's windows. */
  window_start: string;
  window_end: string;
  cadence: string;
  on: string;
  equity: EquityPoint[];
  metrics: BacktestMetrics;
  children: CompositeBacktestChild[];
  approximations: string[];
}

export type CompositeBacktestResponse =
  | CompositeBacktestPending
  | CompositeBacktestDone;

/**
 * Run (or resume) the composite backtest of a portfolio created from strategy
 * sleeves. Stateless and idempotent: it recomputes the blend from the children's
 * cached backtests, enqueueing the ones that are missing.
 *
 * - **202** → `{ status: 'pending' }` with a job per sleeve. 202 is a success
 *   status, so axios does NOT reject it; the discriminator is the payload's
 *   `status` (with `res.status` as the fallback for a body that omits it).
 * - **200** → `{ status: 'done' }` with the blended curve, metrics per sleeve
 *   and the `approximations` block.
 * - **422** (rejected) → a child backtest failed (the detail names the sleeve)
 *   or the common window is shorter than 60 days.
 * - **400** (rejected) → the portfolio is not composite. **404** → no link.
 */
export async function runCompositeBacktest(
  portfolioId: string,
  signal?: AbortSignal,
): Promise<CompositeBacktestResponse> {
  const res = await apiClient.post<CompositeBacktestResponse>(
    `/portfolios/${portfolioId}/composite-backtest`,
    undefined,
    { signal },
  );
  const data = res.data;
  if (data?.status === 'pending' || (res.status === 202 && !data?.status)) {
    return {
      status: 'pending',
      children: (data as CompositeBacktestPending)?.children ?? [],
    };
  }
  return data as CompositeBacktestDone;
}

// =============================================================================
// Composite sleeves — desglose, re-pineo y asignaciones (#203/#205) y el
// rebalanceo `use_saved` del compuesto (#204)
// =============================================================================
//
// Espejo de los contratos fijados por el backend:
//   · `GET  /portfolios/{id}/sleeves`                 → #203 (PortfolioSleevesResponse)
//   · `PATCH /portfolios/{id}/sleeves/{strategy_id}`  → #205 (rebase_to_latest)
//   · `PUT  /portfolios/{id}/sleeves`                 → #205 (lista COMPLETA, Σ = 1)
//   · `POST /portfolios/{id}/rebalance[/preview]`     → #204 (use_saved, sin filtros)
//
// TODO lo que el FE asume de esos tres loops vive en ESTE bloque: si el
// contrato cambia al mergearlos, se reconcilia acá y en ningún otro lado.
//
// UNIDADES (mismas del bloque de creación, #202/#207):
//   · `allocation` y `coverage_pct` son FRACCIONES (0,60 = 60 %).
//   · `target_weight_pct`, `current_weight_pct`, `cash_pct` y `weight_pct` de
//     la exposición sectorial son PORCENTAJES (10.0 = 10 %).

/** Una manga vista desde el libro existente (`SleeveBreakdownItem`, #203). */
export interface SleeveBreakdownItem {
  strategy_id: string;
  name: string;
  /** Versión pineada en la manga: con la que corre el compuesto hoy. */
  pinned_version: number;
  /** Última versión publicada de la estrategia. */
  latest_version: number;
  /** `latest_version > pinned_version` — nunca se adopta sola (D6). */
  outdated: boolean;
  /** Porción del capital que pidió la manga, FRACCIÓN. */
  allocation: number;
  /** Lo que la manga pidió en el último target guardado, PORCENTAJE. */
  target_weight_pct: number;
  /** Lo que la manga explica hoy del valor total, PORCENTAJE (atribución
   *  `proportional_to_target`; la diferencia con el target es la deriva). */
  current_weight_pct: number;
  /** Posiciones ACTUALES que la manga reclama (no el tamaño de su target). */
  holdings_count: number;
  /** Cobertura del universo, FRACCIÓN. */
  coverage_pct: number | null;
  eligible_count: number | null;
  /** Fecha del último target guardado de la manga (`YYYY-MM-DD`). */
  target_as_of: string | null;
  data_as_of: string | null;
  warnings: string[];
}

/** Exposición sectorial agregada del compuesto, en % del valor total. */
export interface SectorExposureItem {
  sector: string;
  weight_pct: number;
}

/**
 * Respuesta de `GET /portfolios/{id}/sleeves` (#203).
 *
 * `attribution` viaja en la respuesta (y no solo en la documentación) porque
 * `current_weight_pct` NO es un libro por manga: el compuesto tiene un solo
 * ledger y cada posición se reparte entre las mangas que la eligieron, en
 * proporción a su contribución al último target.
 *
 * `warnings` reporta lo que rompería la identidad
 * `Σ current_weight_pct == 100 − cash_pct` (posiciones sin precio, o que
 * ninguna manga reclama).
 */
export interface PortfolioSleevesResponse {
  portfolio_id: string;
  kind: string;
  attribution: string;
  rules: CompositeRules;
  as_of: string;
  last_rebalance_date: string | null;
  total_value: number;
  /** Efectivo como PORCENTAJE del valor total. */
  cash_pct: number;
  sleeves: SleeveBreakdownItem[];
  sector_exposure: SectorExposureItem[];
  /** Nombres elegidos por ≥ 2 mangas. */
  overlap_count: number;
  warnings: string[];
}

/**
 * Desglose por manga del compuesto. Solo lectura — cualquier rol con acceso al
 * portafolio lo ve. 400 si el portafolio no es compuesto; 404 sin vínculo.
 */
export async function getPortfolioSleeves(
  portfolioId: string,
  signal?: AbortSignal,
): Promise<PortfolioSleevesResponse> {
  const { data } = await apiClient.get<PortfolioSleevesResponse>(
    `/portfolios/${portfolioId}/sleeves`,
    { signal },
  );
  return data;
}

/**
 * Adopta la ÚLTIMA versión de la estrategia en esa manga (rebase explícito,
 * #205). Requiere `co_owner`; no toca el libro — el cambio se ve en el próximo
 * preview de rebalanceo. Sobre una manga ya al día es un no-op idempotente.
 * Responde con el mismo shape que `GET /sleeves`.
 */
export async function rebaseSleeve(
  portfolioId: string,
  strategyId: string,
  signal?: AbortSignal,
): Promise<PortfolioSleevesResponse> {
  const { data } = await apiClient.patch<PortfolioSleevesResponse>(
    `/portfolios/${portfolioId}/sleeves/${strategyId}`,
    { rebase_to_latest: true },
    { signal },
  );
  return data;
}

/**
 * Reescribe las asignaciones de TODAS las mangas (#205). El body lleva la lista
 * completa, con exactamente el mismo conjunto de `strategy_id` que ya tiene el
 * portafolio (alta/baja de mangas no existe en v1 → 422) y Σ `allocation` = 1.
 * Atómico: o cambian todas o ninguna. Requiere `co_owner`; no mueve el libro.
 */
export async function setSleeveAllocations(
  portfolioId: string,
  sleeves: SleeveAllocation[],
  signal?: AbortSignal,
): Promise<PortfolioSleevesResponse> {
  const { data } = await apiClient.put<PortfolioSleevesResponse>(
    `/portfolios/${portfolioId}/sleeves`,
    { sleeves },
    { signal },
  );
  return data;
}

/**
 * Una manga tal como la resolvió el plan de rebalanceo (#204): el shape de
 * #203 más `resolved`.
 *
 * `resolved: false` = la manga no pudo resolverse (universo vacío o cobertura
 * baja) y el plan mantuvo su ÚLTIMO target en lugar de liquidar su parte —
 * misma regla de seguridad que el tracker. Nunca significa "vendida".
 */
export interface RebalanceSleeveResolved extends SleeveBreakdownItem {
  resolved: boolean;
}

/**
 * Body del preview/confirm de un rebalanceo COMPUESTO (#204).
 *
 * Un compuesto no tiene filtros de screener que replicar: el plan sale de las
 * versiones pineadas de sus mangas, así que el request es exactamente
 * `{ use_saved: true }` — sin `filters`, sin `ranking`, sin `weighting_params`
 * (el backend responde 422 si viajan con `use_saved`) y sin `weighting_method`
 * ni `prioritize_held` (los ignora: el sizing es la fusión de las mangas y la
 * histéresis viene del spec de cada estrategia).
 *
 * Vive acá, y no dentro del modal, para que el body del compuesto se pueda
 * verificar sin montar React.
 */
export function buildCompositeRebalanceRequest(): RebalanceRequest {
  return { use_saved: true };
}

/**
 * Body del confirm de un rebalanceo compuesto: el request de arriba + la fecha
 * que devolvió el preview. `update_saved_spec` va SIEMPRE en `false` — no hay
 * spec inline que guardar y el backend lo rechaza con 400 si va en `true`.
 */
export function buildCompositeRebalanceApplyRequest(
  asOf: string,
): RebalanceApplyRequest {
  return { ...buildCompositeRebalanceRequest(), as_of: asOf, update_saved_spec: false };
}
