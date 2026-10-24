// Debounced resolve of a strategy universe into per-sector rows (Layer 1 base +
// display alpha). Cancels superseded requests; only runs while `enabled` (the
// weighting section is open) so a collapsed panel never fetches.
import { useEffect, useState } from 'react';
import { create } from 'zustand';

import { resolveUniverse, ResolveUniverseError } from '../service';
import type { AlphaWindow, Layer1Spec, ResolveUniverseResponse, UniverseSpec } from '../types';

/** The basket a `resolve-universe` call just rejected with 422
 *  `basket_not_found` (#296), or null. The preview runs inside the weighting
 *  panel, but the error belongs on the basket selector (section 2) — this tiny
 *  store carries it across without a second request. Cleared by the next
 *  successful resolve. */
export const useBasketResolveError = create<{ notFound: string | null }>(() => ({
  notFound: null,
}));

const DEBOUNCE_MS = 400;

interface ResolveState {
  data: ResolveUniverseResponse | null;
  loading: boolean;
  error: string | null;
}

export function useResolveSectors(
  universe: UniverseSpec,
  enabled: boolean,
  alphaWindow: AlphaWindow,
  layer1: Layer1Spec,
): ResolveState {
  // Start "loading" when mounted open so the first paint shows a spinner, not the
  // empty state. setState lives only inside the debounce/async callbacks below —
  // never synchronously in the effect body (avoids cascading renders).
  const [state, setState] = useState<ResolveState>(() => ({
    data: null,
    loading: enabled,
    error: null,
  }));
  // Serialize so the effect only re-runs when the CONTENT changes (both the
  // universe and the Layer-1 clause are rebuilt fresh on every render, so the
  // raw objects would refire the effect endlessly).
  const key = JSON.stringify(universe);
  const layer1Key = JSON.stringify(layer1);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, loading: true, error: null }));
      resolveUniverse(JSON.parse(key) as UniverseSpec, {
        alphaWindow,
        layer1: JSON.parse(layer1Key) as Layer1Spec,
        signal: ctrl.signal,
      })
        .then((data) => {
          if (ctrl.signal.aborted) return;
          setState({ data, loading: false, error: null });
          useBasketResolveError.setState({ notFound: null });
        })
        .catch((e: unknown) => {
          if (ctrl.signal.aborted) return;
          const notFound = e instanceof ResolveUniverseError && e.code === 'basket_not_found';
          if (notFound) {
            const sent = (JSON.parse(key) as UniverseSpec).basket_id ?? null;
            useBasketResolveError.setState({ notFound: e.basketId ?? sent });
          }
          setState((s) => ({
            ...s,
            loading: false,
            error: notFound ? 'Basket not found — pick another basket.' : 'Could not resolve the universe.',
          }));
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // `layer1Key` is load-bearing: without it the request would carry the new
    // Layer-1 clause only by accident, and switching method or editing top_n
    // would leave the table showing the OLD base — a wrong-data bug that looks
    // exactly like a working feature. The 400 ms debounce covers top_n typing.
  }, [key, layer1Key, enabled, alphaWindow]);

  return state;
}
