// Local saved-strategies list. v1 has no backend "list strategies" endpoint, so
// the strategies a user creates/backtests are remembered client-side.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { SavedStrategy } from './types';

interface StrategyStore {
  strategies: SavedStrategy[];
  upsert: (s: SavedStrategy) => void;
  remove: (id: string) => void;
}

export const useStrategyStore = create<StrategyStore>()(
  persist(
    (set) => ({
      strategies: [],
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
    }),
    { name: 'sb-strategies' },
  ),
);
