import { create } from 'zustand';
import { getErrorMessage, isApiError } from '@/lib/apiErrors';
import { toast } from '@/components/ui';
import {
  deleteTracker,
  getStrategyHoldings,
  getTracker,
  rebaseTracker,
  updateTracker,
} from './service';
import type { TrackerResponse, TrackerStatus } from './types';

interface TrackerDetailState {
  strategyId: string | null;
  tracker: TrackerResponse | null;
  /** GET tracker returned 404 → the strategy has no tracker (activation flow). */
  notFound: boolean;
  isLoading: boolean;
  error: string | null;
  /** From holdings/drift responses — inert-clause banner + freshness badge. */
  warnings: string[];
  dataAsOf: string | null;
  /** Intraday mark mode; fully wired in issue #7. */
  intraday: boolean;
  /** True while a modal action (rebase/delete) is in flight. */
  actionBusy: boolean;
}

interface TrackerDetailActions {
  load: (strategyId: string) => Promise<void>;
  setStatus: (status: Exclude<TrackerStatus, 'error'>) => Promise<void>;
  setNotifications: (enabled: boolean) => Promise<void>;
  rebase: (version: number) => Promise<boolean>;
  remove: (keepPortfolio: boolean) => Promise<boolean>;
  reset: () => void;
}

const initialState: TrackerDetailState = {
  strategyId: null,
  tracker: null,
  notFound: false,
  isLoading: false,
  error: null,
  warnings: [],
  dataAsOf: null,
  intraday: false,
  actionBusy: false,
};

export const useTrackerStore = create<TrackerDetailState & TrackerDetailActions>()(
  (set, get) => ({
    ...initialState,

    load: async (strategyId) => {
      set({ ...initialState, strategyId, isLoading: true });
      try {
        const tracker = await getTracker(strategyId);
        set({ tracker, isLoading: false });
        // Best-effort: warnings + data_as_of; the banner simply stays hidden
        // if holdings are unavailable.
        getStrategyHoldings(strategyId)
          .then((h) =>
            set({ warnings: h.warnings ?? [], dataAsOf: h.data_as_of ?? null }),
          )
          .catch(() => {});
      } catch (err) {
        if (isApiError(err) && err.status === 404) {
          set({ notFound: true, isLoading: false });
        } else {
          set({ error: getErrorMessage(err), isLoading: false });
        }
      }
    },

    setStatus: async (status) => {
      const prev = get().tracker;
      if (!prev || get().actionBusy) return;
      set({ tracker: { ...prev, status } });
      try {
        const updated = await updateTracker(prev.strategy_id, { status });
        set({ tracker: updated });
      } catch (err) {
        set({ tracker: prev });
        toast('error', getErrorMessage(err));
      }
    },

    setNotifications: async (enabled) => {
      const prev = get().tracker;
      if (!prev) return;
      set({ tracker: { ...prev, notifications_enabled: enabled } });
      try {
        const updated = await updateTracker(prev.strategy_id, {
          notifications_enabled: enabled,
        });
        set({ tracker: updated });
      } catch (err) {
        set({ tracker: prev });
        toast('error', getErrorMessage(err));
      }
    },

    rebase: async (version) => {
      const prev = get().tracker;
      if (!prev) return false;
      set({ actionBusy: true });
      try {
        const updated = await rebaseTracker(prev.strategy_id, { version });
        set({ tracker: updated, actionBusy: false });
        toast(
          'success',
          `Tracker actualizado a la versión ${version} — se forzará un rebalanceo inmediato.`,
        );
        return true;
      } catch (err) {
        set({ actionBusy: false });
        toast('error', getErrorMessage(err));
        return false;
      }
    },

    remove: async (keepPortfolio) => {
      const prev = get().tracker;
      if (!prev) return false;
      set({ actionBusy: true });
      try {
        await deleteTracker(prev.strategy_id, keepPortfolio);
        set({ ...initialState });
        return true;
      } catch (err) {
        set({ actionBusy: false });
        toast('error', getErrorMessage(err));
        return false;
      }
    },

    reset: () => set({ ...initialState }),
  }),
);
