// Saved-strategies list. `strategies` are local (drafts + this client's backtested
// runs, persisted in localStorage). `server` is hydrated from the backend
// (GET /strategies) — strategies persisted server-side, incl. ones the AI
// assistant created — and is NOT persisted (re-fetched each session).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { specToConfig } from './mapping';
import { listStrategies } from './service';
import type { SavedStrategy } from './types';

interface StrategyStore {
  strategies: SavedStrategy[];
  server: SavedStrategy[];
  upsert: (s: SavedStrategy) => void;
  remove: (id: string) => void;
  loadServer: () => Promise<void>;
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
      remove: (id) =>
        set((state) => ({ strategies: state.strategies.filter((x) => x.id !== id) })),
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
