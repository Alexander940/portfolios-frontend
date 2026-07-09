/**
 * Formatting helpers, re-exported from the shared lib.
 *
 * The implementations moved to `src/lib/format.ts` so non-portfolio features
 * can use them without cross-feature imports; existing portfolio imports keep
 * working through this module.
 */
export { fmtNumber, toLocalDate, fmtDate } from '@/lib/format';
