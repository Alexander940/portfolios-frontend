import type { ColumnPresetId } from '../constants';
import type {
  FilterValue,
  MarketCapCategory,
  RatingValue,
} from './screener.types';

/**
 * A snapshot of the screener UI store, persisted in the preset's `criteria`
 * JSONB column. The backend treats `criteria` as opaque, so this contract is
 * frontend-only — same shape we apply to `useScreenerStore` on load.
 *
 * Pagination state (`page`, `pageSize`) is intentionally excluded — every
 * apply resets to page 1.
 */
export interface PresetCriteria {
  exchanges: string[];
  sectors: string[];
  countries: string[];
  ratings: RatingValue[];
  marketCapCategories: MarketCapCategory[];
  additionalFilters: Record<string, FilterValue>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  columnPreset: ColumnPresetId;
}

/**
 * One saved preset as returned by the API.
 */
export interface ScreenerPreset {
  preset_id: string;
  /** NULL when the preset is system-owned (curated). */
  user_id: string | null;
  name: string;
  description: string | null;
  is_public: boolean;
  is_system: boolean;
  /** Untyped on the wire (dict[str, Any]); we cast to PresetCriteria here. */
  criteria: PresetCriteria;
  created_at: string;
  updated_at: string;
}

export interface ScreenerPresetCreate {
  name: string;
  description?: string | null;
  is_public?: boolean;
  criteria: PresetCriteria;
}

export interface ScreenerPresetUpdate {
  name?: string;
  description?: string | null;
  is_public?: boolean;
  criteria?: PresetCriteria;
}

export interface ScreenerPresetList {
  items: ScreenerPreset[];
  total: number;
  limit: number;
  offset: number;
}
