/* eslint-disable react-refresh/only-export-components --
 * This module intentionally co-locates the RatingBadge component with the
 * RATING_CONFIG constant and formatRatingLabel helper it depends on, so every
 * consumer imports all three from one place. The rule only affects Vite
 * fast-refresh granularity, not correctness. */

/**
 * Shared rating UI (ADE scale).
 *
 * Rating domain is the integer set {-3,-2,-1,1,2,3} (no 0); higher = more
 * bullish. Positive ratings render green, negative red. Moved here from
 * `features/portfolio/components/RatingBadge.tsx` so the tracker and the
 * portfolio features share one visual mapping; the portfolio module
 * re-exports from here.
 */

export const RATING_CONFIG: Record<number, { color: string }> = {
  3: { color: 'var(--c-pos)' },
  2: { color: 'var(--c-pos)' },
  1: { color: 'var(--c-pos)' },
  [-1]: { color: 'var(--c-neg)' },
  [-2]: { color: 'var(--c-neg)' },
  [-3]: { color: 'var(--c-neg)' },
};

/** "+2" for bullish, "-1" for bearish. */
export function formatRatingLabel(rating: number): string {
  return rating > 0 ? `+${rating}` : `${rating}`;
}

export function RatingBadge({ rating }: { rating: number | null | undefined }) {
  if (rating === null || rating === undefined) {
    return <span style={{ color: 'var(--c-text-dim)', fontSize: 11 }}>—</span>;
  }
  const cfg = RATING_CONFIG[rating];
  if (!cfg)
    return <span style={{ color: 'var(--c-text-dim)', fontSize: 11 }}>—</span>;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 28,
        height: 22,
        padding: '0 6px',
        borderRadius: 11,
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        background: cfg.color,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {formatRatingLabel(rating)}
    </span>
  );
}
