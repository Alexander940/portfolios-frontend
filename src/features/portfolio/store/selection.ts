import { create } from 'zustand';

/**
 * Selection state for the portfolios list — shared between the table (checkboxes)
 * and the page header (bulk-action chips), so neither has to be threaded through
 * the other. Holds only the selected ids; the portfolios list stays in the page.
 */
interface SelectionState {
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  /** Add or remove many ids at once (used by select-all). */
  setMany: (ids: string[], selected: boolean) => void;
  clear: () => void;
  /** Drop any selected ids that are no longer in the list (e.g. after delete). */
  retain: (validIds: string[]) => void;
}

export const usePortfolioSelection = create<SelectionState>((set) => ({
  selectedIds: new Set<string>(),
  toggle: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  setMany: (ids, selected) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      for (const id of ids) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return { selectedIds: next };
    }),
  clear: () => set({ selectedIds: new Set<string>() }),
  retain: (validIds) =>
    set((s) => {
      const valid = new Set(validIds);
      const next = new Set<string>();
      let changed = false;
      for (const id of s.selectedIds) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? { selectedIds: next } : {};
    }),
}));
