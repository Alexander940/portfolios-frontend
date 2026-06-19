/**
 * Shared formatting helpers for the portfolio feature.
 *
 * Extracted from PortfolioPositionsTable so the positions table and the
 * Relevant Events rail format numbers and dates identically.
 */

/** Locale-aware number formatting with a fixed number of decimals. */
export function fmtNumber(
  n: number | string | null | undefined,
  decimals = 2,
): string {
  if (n === null || n === undefined) return '—';
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Parse an ISO string into a Date for *display*, preserving the calendar day.
 *
 * `new Date("2026-06-18")` parses a date-only string as UTC midnight, which
 * `toLocaleDateString` then renders in the browser's LOCAL zone — shifting the
 * day backwards for negative-UTC users (in UTC-3 the 18th renders as the 17th).
 * Parse date-only strings (`YYYY-MM-DD`) as a LOCAL date so the day is
 * preserved; full timestamps (with a time component) are real instants and are
 * parsed as-is.
 */
export function toLocalDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(iso);
}

/** Short, human-readable date ("Jun 16, 2026") from an ISO string. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return toLocalDate(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
