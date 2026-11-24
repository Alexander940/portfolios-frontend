// Saved-strategies list. `strategies` are local (drafts + this client's backtested
// runs, persisted in localStorage). `server` is hydrated from the backend
// (GET /strategies) — strategies persisted server-side, incl. ones the AI
// assistant created — and is NOT persisted (re-fetched each session).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { specToConfig } from './mapping';
import { deleteStrategy, listStrategies } from './service';
import type { SavedStrategy, StrategyPermission } from './types';

/** The caller's role on the strategy open in the builder (#349) and, for a
 *  shared one, its owner's email (the read-only notice). */
export interface OpenAccess {
  permission: StrategyPermission;
  ownerEmail: string | null;
}

/** New strategies, local drafts and own strategies — and a detail without the
 *  field (older backend) — are the caller's: the builder behaves as before. */
export const OWNER_ACCESS: OpenAccess = { permission: 'owner', ownerEmail: null };

interface StrategyStore {
  strategies: SavedStrategy[];
  server: SavedStrategy[];
  /** Not persisted: reset to owner on every new/own open. */
  openAccess: OpenAccess;
  setOpenAccess: (a: OpenAccess) => void;
  upsert: (s: SavedStrategy) => void;
  remove: (id: string) => Promise<void>;
  /** Drop a strategy from the own list WITHOUT deleting it server-side — it
   *  was transferred and is now someone else's (#349). */
  forget: (id: string) => void;
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
      openAccess: OWNER_ACCESS,
      setOpenAccess: (a) => set({ openAccess: a }),
      forget: (id) =>
        set((state) => ({
          strategies: state.strategies.filter((x) => x.id !== id),
          server: state.server.filter((x) => x.id !== id),
        })),
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
              // Raw spec + provenance (issue #59): the spec lets an edit
              // round-trip without dropping live-only filters; the provenance
              // renders "desde <template> vN" en la lista.
              spec: it.spec,
              templateSlug: it.template_slug,
              templateVersion: it.template_version,
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
