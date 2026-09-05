/**
 * Pure chart transformation for the composite backtest view (#209).
 *
 * The composite response (#206) carries the blended curve and, per sleeve, only
 * its metrics — each child's equity curve is fetched separately with
 * `GET /backtests/{job_id}`, so the child series cover their OWN (longer)
 * windows while the composite covers the intersection.
 *
 * The rule that makes the overlay honest — and the identity oracle work:
 *
 * 1. The composite curve is the **spine**: one row per composite date, in order.
 *    A child value is read by date lookup, so anything outside the common window
 *    is dropped rather than shifting the series.
 * 2. Every series is rebased to its OWN first value **inside that spine**, so
 *    all of them start at 100 (or at the composite's starting capital in
 *    `capital` mode). Rebasing a child over its full window instead would make
 *    a single 100 % sleeve diverge from the composite it IS.
 *
 * Consequence (the O4 identity of the epic): with one sleeve at 100 % the
 * backend returns a composite curve equal to that child's, and rebasing both
 * with the same base yields point-by-point identical numbers.
 *
 * No React, no I/O — the transform is a plain function so it can be checked
 * against a fixture on its own.
 */

/** Minimal shape of a backtest equity row — structurally satisfied by both
 *  `EquityPoint` (builder) and the composite response's `equity` rows. */
export interface CompositeCurvePoint {
  date: string;
  total_value: number;
  benchmark_value?: number | null;
}

/** One sleeve's curve, keyed by the dataKey its `<Line>` will read. */
export interface CompositeChildCurve {
  /** Stable recharts dataKey for the rebased series (e.g. `child0`). */
  key: string;
  /** Human label for the legend/tooltip (the sleeve name). */
  label: string;
  points: CompositeCurvePoint[];
}

/**
 * A recharts row. `portfolio`/`benchmark` are rebased to 100 and
 * `totalValue`/`benchmarkValue` are the same series in capital, mirroring the
 * builder's `DisplayResult['curve']` so the Base 100 ↔ Capital toggle (#134)
 * works the same way. Each child adds `<key>` (rebased) and `<key>Value`
 * (capital); a date the child does not cover is `null` (a gap, never a zero).
 */
export interface CompositeChartRow {
  date: string;
  portfolio: number;
  benchmark: number | null;
  totalValue: number;
  benchmarkValue: number | null;
  [series: string]: string | number | null;
}

/** Capital dataKey paired with a rebased series key. */
export function capitalKey(key: string): string {
  return `${key}Value`;
}

function rebase(value: number, base: number, target: number): number {
  return (value / base) * target;
}

/**
 * Build the chart rows for the composite + its sleeves + the benchmark.
 *
 * @param composite the blended curve (the spine; also the source of the SPY series)
 * @param children  the sleeves' own curves, in display order
 */
export function buildCompositeChartRows(
  composite: readonly CompositeCurvePoint[],
  children: readonly CompositeChildCurve[] = [],
): CompositeChartRow[] {
  if (composite.length === 0) return [];

  const base = composite[0].total_value || 1;
  const benchBase =
    composite.find((p) => p.benchmark_value != null)?.benchmark_value ?? null;

  // Per child: a date → value index plus the base taken at the first spine date
  // the child actually covers (normally the first one).
  const indexed = children.map((child) => {
    const byDate = new Map<string, number>();
    for (const p of child.points) byDate.set(p.date, p.total_value);
    let childBase: number | null = null;
    for (const row of composite) {
      const v = byDate.get(row.date);
      if (v != null && v !== 0) {
        childBase = v;
        break;
      }
    }
    return { key: child.key, byDate, childBase };
  });

  return composite.map((p) => {
    const row: CompositeChartRow = {
      date: p.date,
      portfolio: rebase(p.total_value, base, 100),
      benchmark:
        p.benchmark_value != null && benchBase
          ? rebase(p.benchmark_value, benchBase, 100)
          : null,
      totalValue: p.total_value,
      // The benchmark in capital is anchored at the composite's starting
      // capital so both series share one starting point (builder's rule).
      benchmarkValue:
        p.benchmark_value != null && benchBase
          ? rebase(p.benchmark_value, benchBase, base)
          : null,
    };
    for (const child of indexed) {
      const v = child.byDate.get(p.date);
      const ok = v != null && child.childBase != null;
      row[child.key] = ok ? rebase(v, child.childBase as number, 100) : null;
      row[capitalKey(child.key)] = ok
        ? rebase(v, child.childBase as number, base)
        : null;
    }
    return row;
  });
}
