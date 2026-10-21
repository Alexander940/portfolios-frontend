// Pure helpers for the per-rebalance trade log (issue #278): formatting of the
// backend's FRACTIONS, index sorting and the summary derivations. DB/DOM-free so
// the fase 4 detail screen reuses them.
import type { Cadence, RebalanceIndexRow } from './types';

/** Index page size (D4). */
export const REBALANCES_PAGE_SIZE = 25;

/** Fraction → signed percent: 0.048316 → "+4.8%", -0.017 → "-1.7%". null → "—". */
export function fmtFracPct(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const p = v * 100;
  return `${p > 0 ? '+' : ''}${p.toFixed(d)}%`;
}

/** Fraction → unsigned percent for magnitudes (turnover, weights): 0.253 → "25.3%". */
export function fmtFracPctPlain(v: number | null | undefined, d = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(d)}%`;
}

/** CSS sign class for a return-like value. */
export function signCls(v: number | null | undefined): '' | 'pos' | 'neg' {
  if (v == null || !Number.isFinite(v) || v === 0) return '';
  return v > 0 ? 'pos' : 'neg';
}

const CADENCE_ES: Record<Cadence, string> = {
  weekly: 'semanal',
  monthly: 'mensual',
  quarterly: 'trimestral',
  semiannual: 'semestral',
  annual: 'anual',
};

/** Spanish label of a rebalance cadence; null for an unknown/missing one. */
export function cadenceLabelEs(c: string | null | undefined): string | null {
  return c && c in CADENCE_ES ? CADENCE_ES[c as Cadence] : null;
}

export type RebalanceSortKey = 'decision_date' | 'period_return' | 'excess' | 'turnover_pct' | 'n_exits';

export const REBALANCE_SORT_OPTIONS: { k: RebalanceSortKey; label: string }[] = [
  { k: 'decision_date', label: 'Fecha' },
  { k: 'period_return', label: 'Retorno del período' },
  { k: 'excess', label: 'Exceso vs SPY' },
  { k: 'turnover_pct', label: 'Rotación' },
  { k: 'n_exits', label: 'Salidas' },
];

/** Sorted copy: `decision_date` is chronological (ascending, = seq order);
 *  every metric key is descending (biggest first) with nulls last; ties keep
 *  seq order. */
export function sortRebalances(rows: RebalanceIndexRow[], key: RebalanceSortKey): RebalanceIndexRow[] {
  const out = [...rows];
  if (key === 'decision_date') return out.sort((a, b) => a.seq - b.seq);
  return out.sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return a.seq - b.seq;
    if (va == null) return 1;
    if (vb == null) return -1;
    return vb - va || a.seq - b.seq;
  });
}

/** "k de N" behind `pct_periods_beating_bench`: periods with `excess > 0`
 *  over periods that have a benchmark (same rule as the backend summary). */
export function beatingCounts(rows: RebalanceIndexRow[]): { k: number; n: number } {
  const withBench = rows.filter((r) => r.excess != null);
  return { k: withBench.filter((r) => (r.excess as number) > 0).length, n: withBench.length };
}

/** Bar height in % of the half-strip for each row: ∝ |period_return|, scaled
 *  to the largest magnitude in the run (0 when every return is 0/null). */
export function barScale(rows: RebalanceIndexRow[]): number {
  let max = 0;
  for (const r of rows) {
    if (r.period_return != null) max = Math.max(max, Math.abs(r.period_return));
    if (r.excess != null) max = Math.max(max, Math.abs(r.excess));
  }
  return max;
}
