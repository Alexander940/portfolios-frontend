/**
 * Pure helpers for the composite-portfolio sleeve allocations (épica #197,
 * issue #207).
 *
 * Everything here is DB-free, React-free and side-effect-free on purpose: the
 * "the allocations must add up to 100 %" rule is the one piece of the
 * «Create from Strategies» modal worth reasoning about on its own, so it lives
 * outside the component where it can be read, reviewed and (once the repo grows
 * a unit-test runner) tested without mounting anything.
 *
 * UNITS. The UI talks PERCENTAGES (the user types `60`), the backend contract
 * talks FRACTIONS (`0.6`). The conversion happens in exactly one place —
 * `toAllocationFractions` / `pctToFraction` — so there is a single spot to look
 * at if a weight ever comes out 100× off.
 */
import type { SleeveAllocation } from '@/services/portfolioService';

/** Backend bounds for a composite (`PortfolioFromStrategiesCreate`, #202). */
export const MIN_SLEEVES = 2;
export const MAX_SLEEVES = 10;
export const MIN_INITIAL_CASH = 1000;

/**
 * Tolerance for the Σ = 100 % check, in percentage POINTS.
 *
 * The backend accepts Σ = 1 ± 1e-6 on the fractions. Percent inputs are capped
 * at two decimals, so anything the UI can produce is either exactly 100 or off
 * by ≥ 0.01 pp; half a hundredth is a safe float-noise cushion that still
 * rejects every real typo.
 */
export const ALLOCATION_TOLERANCE_PP = 0.005;

/**
 * Even split of 100 % across `count` sleeves, computed in basis points so the
 * parts add up to exactly 100 (3 sleeves → 33.34 / 33.33 / 33.33, not 3 × 33.33
 * = 99.99, which the backend would reject).
 */
export function splitEvenly(count: number): number[] {
  if (count <= 0) return [];
  const bpsEach = Math.floor(10000 / count);
  const remainder = 10000 - bpsEach * count;
  return Array.from(
    { length: count },
    (_, i) => (bpsEach + (i < remainder ? 1 : 0)) / 100,
  );
}

/** Σ of the allocations, in percentage points. Nulls count as 0. */
export function sumAllocations(pcts: (number | null)[]): number {
  return pcts.reduce<number>((acc, p) => acc + (p ?? 0), 0);
}

/** True when the allocations add up to 100 % within the tolerance. */
export function isBalanced(pcts: (number | null)[]): boolean {
  return Math.abs(sumAllocations(pcts) - 100) <= ALLOCATION_TOLERANCE_PP;
}

/**
 * Percentages → the fractions the backend wants.
 *
 * When the input is already balanced, the LAST fraction absorbs the float
 * residue (`1 − Σ others`) so the payload adds up to 1 to the last bit — the
 * naive `p / 100` sum can land on 0.9999999999999999 and trip the backend's
 * `Σ = 1 ± 1e-6` guard. An unbalanced input is passed through verbatim instead
 * of being silently "fixed": the caller is expected to have run `isBalanced`
 * first, and a silent fix would hide a real input error behind a wrong weight.
 */
export function toAllocationFractions(pcts: number[]): number[] {
  if (pcts.length === 0) return [];
  const out = pcts.map((p) => p / 100);
  if (!isBalanced(pcts)) return out;
  const head = out.slice(0, -1).reduce((a, b) => a + b, 0);
  out[out.length - 1] = 1 - head;
  return out;
}

/** A percentage in (0, 100] → a fraction in (0, 1]. `null` passes through. */
export function pctToFraction(pct: number | null): number | null {
  if (pct === null) return null;
  return pct / 100;
}

/**
 * Parse a free-text numeric field. Blank → `null` (the "not set" the optional
 * rules send as `null`); anything unparseable → `NaN`, so the caller can tell
 * "left empty" from "typed nonsense".
 */
export function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  return Number(trimmed);
}

/** The `sleeves` array of the request, in the order the user picked them. */
export function buildSleeves(
  strategyIds: string[],
  allocationsPct: Record<string, number>,
): SleeveAllocation[] {
  const pcts = strategyIds.map((id) => allocationsPct[id] ?? 0);
  const fractions = toAllocationFractions(pcts);
  return strategyIds.map((id, i) => ({
    strategy_id: id,
    allocation: fractions[i],
  }));
}

export interface CompositeDraft {
  /** Selected strategies, in pick order. */
  strategyIds: string[];
  /** Allocation per strategy id, as a PERCENTAGE. */
  allocationsPct: Record<string, number>;
  name: string;
  /** Raw field values, so "typed nonsense" can be told apart from "left empty". */
  initialCashRaw: string;
  maxPositionWeightRaw: string;
  cashBufferRaw: string;
}

/**
 * The single gate the modal's "Preview"/"Create" buttons obey. Returns the
 * first problem as a ready-to-render message, or `null` when the draft is
 * shippable. Mirrors the backend validation (2–10 sleeves, Σ = 1, allocations in
 * (0, 1], `initial_cash ≥ 1000`, `CompositeRules` ranges) so the user is told
 * what is wrong before a round trip — the backend still has the last word.
 */
export function validateCompositeDraft(draft: CompositeDraft): string | null {
  const { strategyIds, allocationsPct } = draft;

  if (strategyIds.length < MIN_SLEEVES) {
    return `Pick at least ${MIN_SLEEVES} strategies to combine.`;
  }
  if (strategyIds.length > MAX_SLEEVES) {
    return `A composite portfolio takes at most ${MAX_SLEEVES} strategies.`;
  }
  if (new Set(strategyIds).size !== strategyIds.length) {
    return 'Each strategy can only be used once.';
  }

  const pcts = strategyIds.map((id) => allocationsPct[id]);
  for (const p of pcts) {
    if (p === undefined || !Number.isFinite(p)) {
      return 'Every strategy needs an allocation.';
    }
    if (p <= 0) return 'Every allocation must be above 0 %.';
    if (p > 100) return 'No allocation can exceed 100 %.';
  }
  if (!isBalanced(pcts)) {
    const total = sumAllocations(pcts);
    return `The allocations add up to ${total.toFixed(2)} % — they must add up to 100 %.`;
  }

  if (!draft.name.trim()) return 'Portfolio name is required.';

  const cash = Number(draft.initialCashRaw);
  if (!Number.isFinite(cash) || cash < MIN_INITIAL_CASH) {
    return `Initial capital must be at least $${MIN_INITIAL_CASH.toLocaleString()}.`;
  }

  const cap = parseOptionalNumber(draft.maxPositionWeightRaw);
  if (cap !== null && (!Number.isFinite(cap) || cap <= 0 || cap > 100)) {
    return 'The per-position cap must be a percentage above 0 and at most 100.';
  }

  const buffer = parseOptionalNumber(draft.cashBufferRaw);
  if (buffer !== null && (!Number.isFinite(buffer) || buffer <= 0 || buffer >= 100)) {
    return 'The cash buffer must be a percentage above 0 and below 100.';
  }

  return null;
}

/**
 * Coverage for display. The contract names it `coverage_pct` but ships a
 * FRACTION (`0.97` = 97 %, and the backend's own warning strings print it that
 * way). A value above 1 can only be a real percentage, so it is rendered as-is
 * — that keeps the rail readable if the backend ever normalises the field, and
 * this is the single place to fix if it does.
 */
export function fmtCoverage(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}
