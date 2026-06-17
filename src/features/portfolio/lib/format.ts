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

/** Short, human-readable date ("Jun 16, 2026") from an ISO string. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
