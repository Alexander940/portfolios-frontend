import type {
  ParsedCreationSpec,
  PortfolioRankingSpec,
} from '@/services/portfolioService';
import {
  ADDITIONAL_FILTERS,
  PERCENTAGE_FIELDS,
  RATING_VALUES,
  isMarketCapCategory,
} from '../constants';
import type { ColumnPresetId } from '../constants';
import type {
  DateRangeFilter,
  FilterValue,
  PresetCriteria,
  RangeFilter,
  ScreenerRequest,
} from '../types';

/**
 * Creation-spec ⇄ screener-UI mapping (US6 #114).
 *
 * A portfolio's saved spec (`screener_filters`, parsed by
 * `parseCreationSpec`) stores filters in API units: percent fields as
 * fractions, numerics possibly as strings (backend Decimal → JSON string).
 * This module converts that dict into the shape the screener store
 * understands (`PresetCriteria`, applied via `applyPreset` — the same
 * mechanism saved screens use), reports the keys the current UI catalog
 * doesn't recognize (the catalog evolves — #98/#104 — and old specs must
 * never break the page), and provides the normalized deep-equal used to
 * decide whether to offer "save these filters to the portfolio"
 * (`update_saved_spec`) at rebalance-confirm time.
 */

const PERCENT_FIELD_SET: ReadonlySet<string> = new Set(PERCENTAGE_FIELDS);

/** UI filter catalog indexed by API key (key === apiKey for every def). */
const DEF_BY_API_KEY = new Map(ADDITIONAL_FILTERS.map((d) => [d.apiKey, d]));

/**
 * Fields offered by the ranking "Rank by" selector: Rating plus every
 * range-type filter of the catalog (mirrors RANKING_SORT_GROUPS in
 * RebalancePortfolioModal).
 */
const RANKING_SORT_FIELDS: ReadonlySet<string> = new Set([
  'rating',
  ...ADDITIONAL_FILTERS.filter((f) => f.type === 'range').map((f) => f.apiKey),
]);

export function isKnownRankingSortField(field: string): boolean {
  return RANKING_SORT_FIELDS.has(field);
}

export interface SpecPreloadResult {
  /** Full criteria object ready for `useScreenerStore.applyPreset`. */
  criteria: PresetCriteria;
  /** Saved filter keys the current UI could not represent (never throws). */
  ignored: string[];
}

/**
 * Convert a saved spec's `filters` dict (API units) into screener-store
 * criteria. Unknown or malformed entries are collected in `ignored` instead
 * of throwing; `null` values (unset fields of the backend's full model dump)
 * and pagination are skipped silently.
 */
export function specFiltersToCriteria(
  rawFilters: Record<string, unknown>,
  columnPreset: ColumnPresetId,
): SpecPreloadResult {
  const ignored: string[] = [];
  const criteria: PresetCriteria = {
    exchanges: [],
    sectors: [],
    countries: [],
    ratings: [],
    marketCapCategories: [],
    additionalFilters: {},
    sortBy: 'ticker',
    sortOrder: 'asc',
    columnPreset,
  };

  for (const [key, value] of Object.entries(rawFilters)) {
    if (value === null || value === undefined) continue;
    if (key === 'limit' || key === 'offset') continue;

    switch (key) {
      case 'sort_by':
        if (typeof value === 'string' && value) criteria.sortBy = value;
        continue;
      case 'sort_order':
        if (value === 'asc' || value === 'desc') criteria.sortOrder = value;
        continue;
      case 'exchange':
      case 'sector':
      case 'country': {
        const arr = toStringArray(value);
        if (arr === null) {
          ignored.push(key);
        } else if (arr.length > 0) {
          if (key === 'exchange') criteria.exchanges = arr;
          else if (key === 'sector') criteria.sectors = arr;
          else criteria.countries = arr;
        }
        continue;
      }
      case 'market_cap_category': {
        const arr = toStringArray(value);
        if (arr === null) {
          ignored.push(key);
          continue;
        }
        const valid = arr.filter(isMarketCapCategory);
        if (valid.length > 0) criteria.marketCapCategories = valid;
        const bad = arr.filter((x) => !isMarketCapCategory(x));
        if (bad.length > 0) ignored.push(`market_cap_category (${bad.join(', ')})`);
        continue;
      }
      case 'rating': {
        // The API stores a {min, max} range; the UI shows a discrete set —
        // expand the range back into every rating value inside it.
        const range = parseRange(value, false);
        if (range === null) {
          ignored.push(key);
          continue;
        }
        if (range === 'empty') continue;
        const min = range.min ?? -3;
        const max = range.max ?? 3;
        const selected = RATING_VALUES.filter((r) => r >= min && r <= max);
        if (selected.length > 0) criteria.ratings = selected;
        else ignored.push(key);
        continue;
      }
      default:
        break;
    }

    const def = DEF_BY_API_KEY.get(key);
    if (!def) {
      if (isMeaningfulValue(value)) ignored.push(key);
      continue;
    }

    let parsed: FilterValue | 'empty' | null;
    switch (def.type) {
      case 'range':
        parsed = parseRange(value, PERCENT_FIELD_SET.has(key));
        break;
      case 'daterange':
        parsed = parseDateRange(value);
        break;
      case 'boolean':
        // The UI only expresses `true` (FilterModal removes the filter
        // otherwise) and the backend treats null as unset.
        parsed = value === true ? true : value === false ? 'empty' : null;
        break;
      case 'multiselect': {
        const arr = toStringArray(value);
        parsed = arr === null ? null : arr.length > 0 ? arr : 'empty';
        break;
      }
      default:
        parsed = null;
        break;
    }

    if (parsed === null) ignored.push(key);
    else if (parsed !== 'empty') criteria.additionalFilters[key] = parsed;
  }

  return { criteria, ignored };
}

/**
 * Does the portfolio's saved spec already describe the selection about to be
 * applied? Compared on normalized ground: null/unset values dropped, numeric
 * strings coerced, percent fields on both sides in API units (fractions),
 * pagination and result-table sort (`sort_by`/`sort_order` of the FILTERS —
 * the ranking's own sort is compared) excluded, numbers matched with a small
 * relative epsilon (Decimal round-trips). `saved === null` (no spec yet)
 * always differs — the caller offers to attach one.
 */
export function specMatchesSelection(
  saved: ParsedCreationSpec | null,
  filters: ScreenerRequest,
  ranking: PortfolioRankingSpec | null,
): boolean {
  if (saved === null) return false;
  return (
    looseDeepEqual(
      normalizeFilterDict(saved.filters),
      normalizeFilterDict(filters as Record<string, unknown>),
    ) &&
    looseDeepEqual(normalizeRanking(saved.ranking), normalizeRanking(ranking))
  );
}

// =============================================================================
// Internals
// =============================================================================

function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter((x) => x !== null && x !== undefined)
    .map((x) => String(x));
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Trim float noise from fraction→percent conversions (0.051 → 5.1, not 5.1000000000000005). */
function tidy(n: number): number {
  return Math.round(n * 1e10) / 1e10;
}

/**
 * Parse a stored range value. Returns the RangeFilter in UI units
 * (percent fields ×100), `'empty'` when both bounds are unset (skip
 * silently) or `null` when the value isn't range-shaped (report).
 */
function parseRange(value: unknown, isPercent: boolean): RangeFilter | 'empty' | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const o = value as Record<string, unknown>;
  const result: RangeFilter = {};
  const min = coerceNumber(o.min);
  const max = coerceNumber(o.max);
  if (min !== undefined) result.min = isPercent ? tidy(min * 100) : min;
  if (max !== undefined) result.max = isPercent ? tidy(max * 100) : max;
  if (result.min === undefined && result.max === undefined) return 'empty';
  return result;
}

function parseDateRange(value: unknown): DateRangeFilter | 'empty' | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const o = value as Record<string, unknown>;
  const result: DateRangeFilter = {};
  if (typeof o.min === 'string' && o.min) result.min = o.min;
  if (typeof o.max === 'string' && o.max) result.max = o.max;
  if (!result.min && !result.max) return 'empty';
  return result;
}

/** Anything that would actually constrain the screen (→ worth warning about). */
function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((v) =>
      isMeaningfulValue(v),
    );
  }
  return true;
}

/** Keys excluded from spec comparison: pagination + result-table sort. */
const COMPARE_SKIP_KEYS: ReadonlySet<string> = new Set([
  'limit',
  'offset',
  'sort_by',
  'sort_order',
]);

/**
 * Recursively normalize a value for comparison: drop null/undefined/false and
 * empty containers, coerce numeric strings to numbers, sort string arrays
 * (multiselects are sets). Returns `undefined` for "unset".
 */
function normalizeValue(value: unknown): unknown | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'boolean') return value ? true : undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    if (value.trim() === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  if (Array.isArray(value)) {
    const items = value
      .filter((x) => x !== null && x !== undefined)
      .map((x) => String(x))
      .sort();
    return items.length > 0 ? items : undefined;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nv = normalizeValue(v);
      if (nv !== undefined) out[k] = nv;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return value;
}

function normalizeFilterDict(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (COMPARE_SKIP_KEYS.has(key)) continue;
    const nv = normalizeValue(value);
    if (nv !== undefined) out[key] = nv;
  }
  return out;
}

interface NormalizedRanking {
  sort_by: string;
  sort_order: string;
  top_n: number;
  per_sector: number | null;
}

function normalizeRanking(ranking: unknown): NormalizedRanking | null {
  if (
    ranking === null ||
    ranking === undefined ||
    typeof ranking !== 'object' ||
    Array.isArray(ranking)
  ) {
    return null;
  }
  const o = ranking as Record<string, unknown>;
  const topN = coerceNumber(o.top_n);
  if (topN === undefined) return null;
  const perSector = coerceNumber(o.per_sector);
  return {
    sort_by: typeof o.sort_by === 'string' ? o.sort_by : '',
    sort_order: o.sort_order === 'asc' ? 'asc' : 'desc',
    top_n: topN,
    per_sector: perSector ?? null,
  };
}

/** Relative-epsilon numeric equality (Decimal-string round-trips). */
function numbersClose(a: number, b: number): boolean {
  if (a === b) return true;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function looseDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return numbersClose(a, b);
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length && a.every((x, i) => looseDeepEqual(x, b[i]))
    );
  }
  if (
    typeof a === 'object' &&
    typeof b === 'object' &&
    a !== null &&
    b !== null &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const ka = Object.keys(a as Record<string, unknown>);
    const kb = Object.keys(b as Record<string, unknown>);
    if (ka.length !== kb.length) return false;
    return ka.every((k) =>
      looseDeepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    );
  }
  return false;
}
