import { useEffect, useState } from 'react';
import { fmtNumber } from '@/lib/format';
import { sectorColor } from '@/lib/sectorColors';
import { useScreenerStore } from '../stores';
import { screenerService } from '../services/screenerService';
import type { SectorDistributionResponse } from '../types';

/**
 * Market-cap share per sector of the FULL filtered universe, shown inside
 * the "Save as Portfolio" modal. This is the Layer-1 base the sector_*
 * weighting methods use, so the bars match what the created portfolio will
 * allocate per sector — it does NOT depend on the chosen weighting method,
 * hence a single fetch on mount and no refetch when the radio changes.
 *
 * The preview is best-effort: while loading it shows a skeleton, and if the
 * request fails it degrades to a muted line — it never blocks creation.
 */
export function SectorDistributionPreview() {
  const getApiRequest = useScreenerStore((s) => s.getApiRequest);
  const [data, setData] = useState<SectorDistributionResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    // The backend ignores pagination on this route, but strip it anyway so
    // the request mirrors handleExport's "full filtered set" intent.
    const filters = { ...getApiRequest() };
    delete filters.limit;
    delete filters.offset;

    screenerService
      .getSectorDistribution(filters, controller.signal)
      .then(setData)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div
        className="text-xs text-gray-400"
        data-testid="save-portfolio-sector-distribution-error"
      >
        Sector preview unavailable
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="space-y-1.5 animate-pulse"
        data-testid="save-portfolio-sector-distribution-loading"
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-40 shrink-0 h-3 rounded bg-gray-100" />
            <span className="flex-1 h-1.5 rounded bg-gray-100" />
            <span className="w-14 h-3 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  if (data.sectors.length === 0) return null;

  return (
    <div data-testid="save-portfolio-sector-distribution">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
        Sector distribution (by market cap)
      </div>
      <div className="space-y-1.5">
        {data.sectors.map((row) => (
          <div
            key={row.sector}
            className="flex items-center gap-3 text-sm"
            data-testid={`sector-dist-${row.sector}`}
          >
            <span className="w-40 shrink-0 truncate text-gray-700" title={row.sector}>
              {row.sector}
            </span>
            <span className="flex-1 h-1.5 rounded bg-gray-100 overflow-hidden">
              <span
                className="block h-full rounded"
                style={{
                  width: `${Math.max(0, Math.min(100, row.weight_pct))}%`,
                  background: sectorColor(row.sector),
                }}
              />
            </span>
            <span className="w-14 text-right font-medium text-gray-900 whitespace-nowrap">
              {fmtNumber(row.weight_pct, 1)}%
            </span>
          </div>
        ))}
      </div>
      {data.members_without_market_cap > 0 && !data.used_equal_fallback && (
        <div className="text-xs text-gray-400 mt-2">
          {data.members_without_market_cap} stock
          {data.members_without_market_cap === 1 ? '' : 's'} without market cap
          excluded from the base
        </div>
      )}
      {data.used_equal_fallback && (
        <div className="text-xs text-gray-400 mt-2">
          No market-cap data — sectors will be weighted equally
        </div>
      )}
    </div>
  );
}
