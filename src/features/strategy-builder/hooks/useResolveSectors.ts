// Debounced resolve of a strategy universe into per-sector rows (Layer 1 base +
// display alpha). Cancels superseded requests; only runs while `enabled` (the
// weighting section is open) so a collapsed panel never fetches.
import { useEffect, useState } from 'react';

import { resolveUniverse } from '../service';
import type { AlphaWindow, ResolveUniverseResponse, UniverseSpec } from '../types';

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
): ResolveState {
  // Start "loading" when mounted open so the first paint shows a spinner, not the
  // empty state. setState lives only inside the debounce/async callbacks below —
  // never synchronously in the effect body (avoids cascading renders).
  const [state, setState] = useState<ResolveState>(() => ({
    data: null,
    loading: enabled,
    error: null,
  }));
  // Serialize so the effect only re-runs when the universe content changes
  // (buildUniverse returns a fresh object each render).
  const key = JSON.stringify(universe);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, loading: true, error: null }));
      resolveUniverse(JSON.parse(key) as UniverseSpec, { alphaWindow, signal: ctrl.signal })
        .then((data) => {
          if (!ctrl.signal.aborted) setState({ data, loading: false, error: null });
        })
        .catch(() => {
          if (!ctrl.signal.aborted)
            setState((s) => ({ ...s, loading: false, error: 'Could not resolve the universe.' }));
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [key, enabled, alphaWindow]);

  return state;
}
