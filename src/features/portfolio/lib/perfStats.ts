import type { PerformanceCurveResponse } from '@/services/portfolioService';

/** Summary metrics derived from a portfolio-vs-benchmark performance curve. */
export interface PerfStats {
  portfolioPct: number | null;
  benchmarkPct: number | null;
  alphaPct: number | null;
  sharpe: number | null;
  maxDdPct: number | null;
  volPct: number | null;
}

/**
 * Total return, alpha, annualized Sharpe/vol and max drawdown from a curve's
 * daily ``portfolio_value`` series. Shared by the portfolio Overview tab and the
 * Compare modal so both compute identical numbers.
 */
export function computeStats(data: PerformanceCurveResponse): PerfStats {
  const points = data.points;
  const last = points.length > 0 ? points[points.length - 1] : null;

  const portfolioPct = last ? Number(last.portfolio_return_pct) : null;
  const benchmarkPct =
    data.benchmark_available && last && last.benchmark_return_pct != null
      ? Number(last.benchmark_return_pct)
      : null;
  const alphaPct =
    last && last.relative_return_pct != null
      ? Number(last.relative_return_pct)
      : portfolioPct != null && benchmarkPct != null
        ? portfolioPct - benchmarkPct
        : null;

  const values = points
    .map((p) => Number(p.portfolio_value))
    .filter((v) => Number.isFinite(v));

  if (values.length < 2) {
    return { portfolioPct, benchmarkPct, alphaPct, sharpe: null, maxDdPct: null, volPct: null };
  }

  const returns: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1];
    if (prev !== 0) returns.push(values[i] / prev - 1);
  }

  let sharpe: number | null = null;
  let volPct: number | null = null;
  if (returns.length >= 1) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
    const stdev = Math.sqrt(variance);
    if (stdev > 0) {
      volPct = stdev * Math.sqrt(252) * 100;
      sharpe = (mean / stdev) * Math.sqrt(252);
    }
  }

  let runningMax = values[0];
  let maxDd = 0;
  for (const v of values) {
    if (v > runningMax) runningMax = v;
    if (runningMax > 0) {
      const dd = v / runningMax - 1;
      if (dd < maxDd) maxDd = dd;
    }
  }
  const maxDdPct = maxDd * 100;

  return { portfolioPct, benchmarkPct, alphaPct, sharpe, maxDdPct, volPct };
}
