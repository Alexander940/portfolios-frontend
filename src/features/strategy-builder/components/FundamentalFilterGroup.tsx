import { useState } from 'react';

import { useScreenerOptions } from '@/features/screener';

import {
  FILTER_CATEGORIES,
  formatFilterValue,
  isEmptyFilter,
  SCREENER_FILTERS,
  SECTORS_LIST,
  sectionAllows,
  type FilterSection,
} from '../mapping';
import type { FundamentalFilter, ScreenerFieldKey } from '../types';
import { FilterChip, SelectionFilterModal } from './SelectionFilterModal';

interface Props {
  /** The active filters for this group. */
  filters: FundamentalFilter[];
  /** Called with the next filters whenever the user adds/edits/removes one. */
  onChange: (filters: FundamentalFilter[]) => void;
  /** Which builder section this group renders — filters the catalog (e.g. `sector`
   *  is selection-only) and is passed through to the write-back. */
  section: FilterSection;
  /** Hint shown next to the add-selector when the group is empty. */
  emptyHint?: string;
}

/** A self-contained group of range / boolean / multiselect / daterange filters:
 *  active chips, an "add a filter" selector (the SCREENER_FILTERS catalog grouped by
 *  category, scoped to this section), and the edit/remove modal. Reused for both the
 *  universe "Additional rules" and the post-universe "Selection rules" — each
 *  instance owns its own open-modal state, so the same catalog drives two
 *  independent filter sets. */
export function FundamentalFilterGroup({ filters, onChange, section, emptyHint }: Props) {
  // Which field the modal is editing (null = closed). Local to this group.
  const [editingKey, setEditingKey] = useState<ScreenerFieldKey | null>(null);
  // Cached option lists for multiselect fields (countries/exchanges/sectors).
  const { options } = useScreenerOptions();

  const remove = (key: ScreenerFieldKey) => onChange(filters.filter((f) => f.key !== key));
  // Add-or-update from the modal: an effectively-empty value → not stored (removed);
  // an existing key keeps its position; a new key is appended.
  const upsert = (next: FundamentalFilter) => {
    const def = SCREENER_FILTERS.find((f) => f.key === next.key);
    if (def && isEmptyFilter(next, def)) {
      onChange(filters.filter((f) => f.key !== next.key));
    } else if (filters.some((f) => f.key === next.key)) {
      onChange(filters.map((f) => (f.key === next.key ? next : f)));
    } else {
      onChange([...filters, next]);
    }
  };

  const activeKeys = new Set(filters.map((f) => f.key));
  const available = SCREENER_FILTERS.filter(
    (f) => !activeKeys.has(f.key) && sectionAllows(f, section),
  );
  const editingDef = editingKey
    ? SCREENER_FILTERS.find((f) => f.key === editingKey) ?? null
    : null;
  const editingFilter = editingKey ? filters.find((f) => f.key === editingKey) ?? null : null;
  // Options for the editing field, if it is a multiselect (sectors falls back to the
  // hardcoded list if the API hasn't returned yet).
  const modalOptions = editingDef?.optionsKey
    ? options?.[editingDef.optionsKey] ??
      (editingDef.optionsKey === 'sectors' ? SECTORS_LIST : [])
    : undefined;

  return (
    <>
      {filters.length > 0 && (
        <div className="sb-chips" style={{ marginTop: 14 }}>
          {filters.map((active) => {
            const meta = SCREENER_FILTERS.find((f) => f.key === active.key);
            if (!meta) return null;
            return (
              <FilterChip
                key={active.key}
                label={meta.label}
                value={formatFilterValue(active, meta)}
                onClick={() => setEditingKey(active.key)}
                onRemove={() => remove(active.key)}
              />
            );
          })}
        </div>
      )}
      {available.length > 0 ? (
        <div className="sb-fund-add">
          <div className="sb-select-wrap">
            <select
              className="sb-select"
              value=""
              onChange={(e) => {
                if (e.target.value) setEditingKey(e.target.value as ScreenerFieldKey);
              }}
            >
              <option value="">+ Add a filter…</option>
              {FILTER_CATEGORIES.map((cat) => {
                const opts = available.filter((f) => f.category === cat);
                return opts.length === 0 ? null : (
                  <optgroup key={cat} label={cat}>
                    {opts.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
          {filters.length === 0 && emptyHint && (
            <span className="sb-fund-add-hint">{emptyHint}</span>
          )}
        </div>
      ) : (
        <div className="sb-fund-add-hint" style={{ marginTop: 12 }}>
          All available fields added.
        </div>
      )}

      {editingKey && editingDef && (
        <SelectionFilterModal
          key={editingKey}
          def={editingDef}
          initial={editingFilter}
          options={modalOptions}
          exists={!!editingFilter}
          onApply={(next) => {
            upsert(next);
            setEditingKey(null);
          }}
          onRemove={() => {
            remove(editingKey);
            setEditingKey(null);
          }}
          onClose={() => setEditingKey(null)}
        />
      )}
    </>
  );
}
