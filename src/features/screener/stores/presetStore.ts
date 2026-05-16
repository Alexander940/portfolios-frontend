import axios from 'axios';
import { create } from 'zustand';
import { presetService } from '../services';
import type {
  PresetCriteria,
  ScreenerPreset,
  ScreenerPresetUpdate,
} from '../types';

interface PresetState {
  presets: ScreenerPreset[];
  isLoading: boolean;
  /** ID of the last preset applied. Cosmetic — used to highlight the chip. */
  activePresetId: string | null;
  error: string | null;
}

interface PresetActions {
  fetchPresets: () => Promise<void>;
  /**
   * Persist the supplied snapshot as a new preset, then refresh the list and
   * mark the new preset as active. Throws on conflict (409) so the modal can
   * surface a name-collision message.
   */
  savePreset: (input: {
    name: string;
    description?: string;
    isPublic?: boolean;
    criteria: PresetCriteria;
  }) => Promise<ScreenerPreset>;
  updatePreset: (
    presetId: string,
    patch: ScreenerPresetUpdate,
  ) => Promise<ScreenerPreset>;
  deletePreset: (presetId: string) => Promise<void>;
  setActivePreset: (presetId: string | null) => void;
}

function extractErrorDetail(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export const usePresetStore = create<PresetState & PresetActions>((set) => ({
  presets: [],
  isLoading: false,
  activePresetId: null,
  error: null,

  fetchPresets: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await presetService.list({ limit: 200 });
      set({ presets: response.items, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: extractErrorDetail(error, 'Could not load saved screens'),
      });
    }
  },

  savePreset: async ({ name, description, isPublic, criteria }) => {
    const created = await presetService.create({
      name,
      description: description ?? null,
      is_public: isPublic ?? false,
      criteria,
    });
    // Refresh after a successful save so server-side ordering (updated_at desc)
    // takes effect and the new row appears in its sorted position.
    const response = await presetService.list({ limit: 200 });
    set({
      presets: response.items,
      activePresetId: created.preset_id,
    });
    return created;
  },

  updatePreset: async (presetId, patch) => {
    const updated = await presetService.update(presetId, patch);
    set((state) => ({
      presets: state.presets.map((p) =>
        p.preset_id === presetId ? updated : p,
      ),
    }));
    return updated;
  },

  deletePreset: async (presetId) => {
    await presetService.remove(presetId);
    set((state) => ({
      presets: state.presets.filter((p) => p.preset_id !== presetId),
      activePresetId:
        state.activePresetId === presetId ? null : state.activePresetId,
    }));
  },

  setActivePreset: (presetId) => set({ activePresetId: presetId }),
}));
