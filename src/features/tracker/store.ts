import { create } from 'zustand';
import { getErrorMessage, isApiError } from '@/lib/apiErrors';
import { toast } from '@/components/ui';
import {
  deleteTracker,
  getDrift,
  getPositions,
  getStrategyHoldings,
  getTracker,
  rebaseTracker,
  updateTracker,
} from './service';
import type {
  DriftResponse,
  HoldingsPreviewResponse,
  PositionItem,
  TrackerResponse,
  TrackerStatus,
} from './types';

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
  /** Intraday mark mode (?mark=live) — solo re-valúa posiciones, nunca persiste. */
  intraday: boolean;
  /** True while a modal action (rebase/delete) is in flight. */
  actionBusy: boolean;
  positions: PositionItem[];
  positionsLoading: boolean;
  positionsError: string | null;
  positionsWarnings: string[];
  /** Timestamp de las quotes en modo intradía. */
  quotedAt: string | null;
  drift: DriftResponse | null;
  driftLoading: boolean;
  driftError: string | null;
  /** Preview completo de holdings — target sectorial (#10) + warnings (#5). */
  holdingsPreview: HoldingsPreviewResponse | null;
}

interface TrackerDetailActions {
  load: (strategyId: string) => Promise<void>;
  setStatus: (status: Exclude<TrackerStatus, 'error'>) => Promise<void>;
  setNotifications: (enabled: boolean) => Promise<void>;
  rebase: (version: number) => Promise<boolean>;
  remove: (keepPortfolio: boolean) => Promise<boolean>;
  loadPositions: (live: boolean) => Promise<void>;
  /** Cambia entre marca intradía y cierre re-consultando posiciones. */
  setIntraday: (live: boolean) => Promise<void>;
  loadDrift: () => Promise<void>;
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
  positions: [],
  positionsLoading: false,
  positionsError: null,
  positionsWarnings: [],
  quotedAt: null,
  drift: null,
  driftLoading: false,
  driftError: null,
  holdingsPreview: null,
};

export const useTrackerStore = create<TrackerDetailState & TrackerDetailActions>()(
  (set, get) => ({
    ...initialState,

    load: async (strategyId) => {
      set({ ...initialState, strategyId, isLoading: true });
      try {
        const tracker = await getTracker(strategyId);
        set({ tracker, isLoading: false });
        void get().loadPositions(false);
        void get().loadDrift();
        // Best-effort: warnings + data_as_of; the banner simply stays hidden
        // if holdings are unavailable.
        getStrategyHoldings(strategyId)
          .then((h) =>
            set({
              holdingsPreview: h,
              warnings: h.warnings ?? [],
              dataAsOf: h.data_as_of ?? null,
            }),
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

    loadPositions: async (live) => {
      const portfolioId = get().tracker?.portfolio_id;
      if (!portfolioId) return;
      set({ positionsLoading: true, positionsError: null });
      try {
        const res = await getPositions(portfolioId, live);
        set({
          positions: res.items,
          positionsWarnings: res.warnings ?? [],
          quotedAt: res.quoted_at ?? null,
          positionsLoading: false,
        });
      } catch (err) {
        set({ positionsLoading: false, positionsError: getErrorMessage(err) });
      }
    },

    setIntraday: async (live) => {
      set({ intraday: live });
      await get().loadPositions(live);
    },

    loadDrift: async () => {
      const strategyId = get().strategyId;
      if (!strategyId) return;
      set({ driftLoading: true, driftError: null });
      try {
        const drift = await getDrift(strategyId);
        // El drift también trae warnings (cláusula inerte, datos stale):
        // se fusionan con los de holdings para los banners del detalle.
        const merged = new Set([...get().warnings, ...(drift.warnings ?? [])]);
        set({
          drift,
          driftLoading: false,
          warnings: [...merged],
          dataAsOf: get().dataAsOf ?? drift.data_as_of ?? null,
        });
      } catch (err) {
        set({ driftLoading: false, driftError: getErrorMessage(err) });
      }
    },

    reset: () => set({ ...initialState }),
  }),
);
