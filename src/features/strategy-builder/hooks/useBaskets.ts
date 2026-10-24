// Baskets available as a strategy universe (#296): the system ones first, then
// the user's. Fetched on mount via the baskets feature's own client — the
// builder never duplicates the `/baskets` DTOs (see src/features/baskets).
import { useEffect, useState } from 'react';

import { basketErrorMessage, listBaskets } from '@/features/baskets/basketService';
import type { BasketListItem } from '@/features/baskets/types';

interface BasketsState {
  baskets: BasketListItem[];
  loading: boolean;
  error: string | null;
}

/** System first (by name), then own baskets (by name). */
export function sortBaskets(items: BasketListItem[]): BasketListItem[] {
  return [...items].sort(
    (a, b) => Number(b.is_system) - Number(a.is_system) || a.name.localeCompare(b.name),
  );
}

/** Only fetches while `enabled` — the builder enables it once «Basket» is the
 *  universe source (or a result needs a basket name), so a filters-only form
 *  never calls `/baskets`. Fetched once per mount. */
export function useBaskets(enabled: boolean): BasketsState {
  const [state, setState] = useState<{ baskets: BasketListItem[]; error: string | null; done: boolean }>(
    { baskets: [], error: null, done: false },
  );
  const { done } = state;

  useEffect(() => {
    if (!enabled || done) return;
    let cancelled = false;
    listBaskets()
      .then((items) => {
        if (!cancelled) setState({ baskets: sortBaskets(items), error: null, done: true });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ baskets: [], error: basketErrorMessage(e), done: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, done]);

  return { baskets: state.baskets, error: state.error, loading: enabled && !done };
}
