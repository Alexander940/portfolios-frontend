import { apiClient } from '@/lib/axios';
import type {
  ScreenerPreset,
  ScreenerPresetCreate,
  ScreenerPresetList,
  ScreenerPresetUpdate,
} from '../types';

/**
 * Screener-presets API client.
 *
 * Backend routes:
 *   POST   /screener/presets/
 *   GET    /screener/presets/?limit&offset
 *   GET    /screener/presets/{id}
 *   PATCH  /screener/presets/{id}
 *   DELETE /screener/presets/{id}
 *
 * All routes require auth (handled by the axios interceptor).
 */
export const presetService = {
  async list(params?: { limit?: number; offset?: number }): Promise<ScreenerPresetList> {
    const response = await apiClient.get<ScreenerPresetList>('/screener/presets/', {
      params,
    });
    return response.data;
  },

  async get(presetId: string): Promise<ScreenerPreset> {
    const response = await apiClient.get<ScreenerPreset>(
      `/screener/presets/${presetId}`,
    );
    return response.data;
  },

  async create(payload: ScreenerPresetCreate): Promise<ScreenerPreset> {
    const response = await apiClient.post<ScreenerPreset>(
      '/screener/presets/',
      payload,
    );
    return response.data;
  },

  async update(
    presetId: string,
    patch: ScreenerPresetUpdate,
  ): Promise<ScreenerPreset> {
    const response = await apiClient.patch<ScreenerPreset>(
      `/screener/presets/${presetId}`,
      patch,
    );
    return response.data;
  },

  async remove(presetId: string): Promise<void> {
    await apiClient.delete(`/screener/presets/${presetId}`);
  },
};
