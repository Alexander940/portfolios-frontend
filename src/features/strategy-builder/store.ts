// Saved-strategies list. `strategies` are local (drafts + this client's backtested
// runs, persisted in localStorage). `server` is hydrated from the backend
// (GET /strategies) — strategies persisted server-side, incl. ones the AI
// assistant created — and is NOT persisted (re-fetched each session).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { specToConfig } from './mapping';
import { deleteStrategy, listStrategies } from './service';
import type { SavedStrategy } from './types';

interface StrategyStore {
  strategies: SavedStrategy[];
  server: SavedStrategy[];
  upsert: (s: SavedStrategy) => void;
  remove: (id: string) => Promise<void>;
  loadServer: () => Promise<void>;
}

/** A 404 means the server row is already gone — treat as a successful delete so
 *  the local removal still happens. Tolerates both the transformed ApiError
 *  (`.status`) and a raw AxiosError (`.response.status`). */
function isNotFound(e: unknown): boolean {
  if (e && typeof e === 'object') {
    const err = e as { status?: number; response?: { status?: number } };
    return err.status === 404 || err.response?.status === 404;
  }
  return false;
}

export const useStrategyStore = create<StrategyStore>()(
  persist(
    (set) => ({
      strategies: [],
      server: [],
      upsert: (s) =>
        set((state) => {
          const i = state.strategies.findIndex((x) => x.id === s.id);
          if (i >= 0) {
            const next = [...state.strategies];
            next[i] = s;
            return { strategies: next };
          }
          return { strategies: [s, ...state.strategies] };
        }),
      remove: async (id) => {
        // Local drafts (`draft-…` ids) exist only in this client — there is no
        // server row to delete. Everything else is a persisted strategy (a UUID),
        // so hit the backend first and only drop it locally once it's really gone.
        if (!id.startsWith('draft-')) {
          try {
            await deleteStrategy(id);
          } catch (e) {
            if (!isNotFound(e)) throw e; // surface real failures; leave the row
          }
        }
        set((state) => ({
          strategies: state.strategies.filter((x) => x.id !== id),
          server: state.server.filter((x) => x.id !== id),
        }));
      },
      loadServer: async () => {
        try {
          const items = await listStrategies();
          set({
            server: items.map((it) => ({
              id: it.strategy_id,
              name: it.name,
              status: 'saved' as const,
              updated: Date.parse(it.updated_at) || Date.parse(it.created_at) || Date.now(),
              cfg: specToConfig(it.spec, it.name),
            })),
          });
        } catch {
          // not authenticated / offline → keep whatever is already loaded.
        }
      },
    }),
    { name: 'sb-strategies', partialize: (s) => ({ strategies: s.strategies }) },
  ),
);
