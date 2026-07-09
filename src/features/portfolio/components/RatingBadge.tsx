/* eslint-disable react-refresh/only-export-components --
 * Re-export module: mixes the component with its config/helper exactly like
 * the original co-located module did. Only affects fast-refresh granularity. */

/**
 * Rating UI, re-exported from the shared design system.
 *
 * The implementation moved to `src/components/ui/RatingBadge.tsx` so the
 * tracker feature can share the exact same visual mapping; existing portfolio
 * imports keep working through this module.
 */
export { RatingBadge, RATING_CONFIG, formatRatingLabel } from '@/components/ui/RatingBadge';
