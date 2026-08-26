import { useState } from 'react';

import { X } from 'lucide-react';

import { useScreenerOptions } from '@/features/screener';

import {
  FILTER_CATEGORIES,
  formatFilterValue,
  isEmptyFilter,
  newGroupId,
  SCREENER_FILTERS,
  SECTORS_LIST,
  sectionAllows,
  type FilterSection,
  type ScreenerFilterDef,
} from '../mapping';
import { isFilterGroup } from '../types';
import type { FilterGroup, FundamentalFilter, RuleEntry, ScreenerFieldKey } from '../types';
import { FilterChip, SelectionFilterModal } from './SelectionFilterModal';

interface Props {
  /** The active rules for this group — loose filters and OR groups (#173). */
  rules: RuleEntry[];
  /** Called with the next rules whenever the user adds/edits/removes/groups one. */
  onChange: (rules: RuleEntry[]) => void;
  /** Which builder section this group renders — filters the catalog (e.g. `sector`
   *  is selection-only) and is passed through to the write-back. */
  section: FilterSection;
  /** Hint shown next to the add-selector when the group is empty. */
  emptyHint?: string;
}

/** Which single alternative the modal is editing/adding. `loose` is a
 *  top-level rule (pre-#173 behavior, unchanged); `option` is one alternative
 *  of an OR group — `index === -1` means "append a new alternative". */
type EditTarget =
  | { kind: 'loose'; key: ScreenerFieldKey }
  | { kind: 'option'; groupId: string; index: number; key: ScreenerFieldKey };

/** A self-contained group of range / boolean / multiselect / daterange filters:
 *  active chips, an "add a filter" selector (the SCREENER_FILTERS catalog grouped by
 *  category, scoped to this section), the edit/remove modal, and — since issue #173
 *  — grouping loose rows into an OR alternative set (and back). Reused for both the
 *  universe "Additional rules" and the post-universe "Selection rules" — each
 *  instance owns its own open-modal/selection state, so the same catalog drives two
 *  independent rule lists. */
export function FundamentalFilterGroup({ rules, onChange, section, emptyHint }: Props) {
  // Which alternative the modal is editing (null = closed). Local to this group.
  const [editing, setEditing] = useState<EditTarget | null>(null);
  // Loose (ungrouped) rule keys checked to be combined into a new OR group.
  const [selected, setSelected] = useState<ReadonlySet<ScreenerFieldKey>>(new Set());
  // Cached option lists for multiselect fields (countries/exchanges/sectors).
  const { options } = useScreenerOptions();

  const looseRules = rules.filter((r): r is FundamentalFilter => !isFilterGroup(r));
  const looseKeys = new Set(looseRules.map((f) => f.key));
  // Only LOOSE keys collide (they write into the same flat screen object) — a
  // key already used inside a group's own alternative is a different,
  // independent mini-screen, so it stays offered here (see
  // `findDuplicateRuleKeys` in mapping.ts for the full reasoning).
  const available = SCREENER_FILTERS.filter(
    (f) => !looseKeys.has(f.key) && sectionAllows(f, section),
  );
  // Every catalog field for this section — offered when adding an alternative
  // to an existing OR group, unrestricted by what's already used (a group MAY
  // reuse a field across its own alternatives, e.g. "PE < 10 OR PE > 50").
  const allForSection = SCREENER_FILTERS.filter((f) => sectionAllows(f, section));

  const setEntryAt = (index: number, next: RuleEntry | null) => {
    const copy = rules.slice();
    if (next === null) copy.splice(index, 1);
    else copy[index] = next;
    onChange(copy);
  };
  const groupIndex = (groupId: string) =>
    rules.findIndex((r) => isFilterGroup(r) && r.id === groupId);

  const removeLoose = (key: ScreenerFieldKey) => {
    onChange(rules.filter((r) => isFilterGroup(r) || r.key !== key));
    setSelected((s) => {
      if (!s.has(key)) return s;
      const next = new Set(s);
      next.delete(key);
      return next;
    });
  };

  // Add-or-update a LOOSE filter from the modal (pre-#173 behavior): an
  // effectively-empty value → not stored (removed); an existing key keeps its
  // position; a new key is appended.
  const upsertLoose = (next: FundamentalFilter) => {
    const def = SCREENER_FILTERS.find((f) => f.key === next.key);
    if (def && isEmptyFilter(next, def)) {
      removeLoose(next.key);
      return;
    }
    if (looseKeys.has(next.key)) {
      onChange(rules.map((r) => (!isFilterGroup(r) && r.key === next.key ? next : r)));
    } else {
      onChange([...rules, next]);
    }
  };

  const toggleSelect = (key: ScreenerFieldKey) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /** Combine every checked loose rule into one new OR group (>= 2 required —
   *  the "Group" action only renders once 2+ are checked, so this is never
   *  called with fewer). Position doesn't matter (AND is commutative), so the
   *  group is appended rather than spliced back into the original slot. */
  const groupSelected = () => {
    if (selected.size < 2) return;
    const toGroup = looseRules.filter((f) => selected.has(f.key));
    const rest = rules.filter((r) => isFilterGroup(r) || !selected.has(r.key));
    const group: FilterGroup = { id: newGroupId(), options: toGroup.map((f) => [f]) };
    onChange([...rest, group]);
    setSelected(new Set());
  };

  /** Dissolve a group back into its loose alternatives (inverse of Group).
   *  A multi-field alternative flattens into that many loose rows. */
  const ungroup = (group: FilterGroup) => {
    const idx = groupIndex(group.id);
    if (idx < 0) return;
    const rest = rules.filter((_, i) => i !== idx);
    onChange([...rest, ...group.options.flat()]);
  };

  /** Remove one alternative from a group. Shrinking to < 2 options would
   *  violate the backend's own "any_of group needs >= 2 options" rule, so
   *  instead of allowing an invalid group to exist even transiently, removing
   *  the second-to-last alternative auto-dissolves the group — the ONE
   *  remaining alternative survives as loose row(s), same as an explicit
   *  Ungroup. This makes a group with < 2 options unrepresentable in form
   *  state by construction (mirrors the backend's own restriction #1). */
  const removeOption = (groupId: string, index: number) => {
    const idx = groupIndex(groupId);
    if (idx < 0) return;
    const group = rules[idx] as FilterGroup;
    if (group.options.length <= 2) {
      const remaining = group.options.filter((_, i) => i !== index).flat();
      const rest = rules.filter((_, i) => i !== idx);
      onChange([...rest, ...remaining]);
      return;
    }
    setEntryAt(idx, { ...group, options: group.options.filter((_, i) => i !== index) });
  };

  /** Add-or-update one alternative of a group from the modal. `index === -1`
   *  appends a new alternative; an empty applied value is treated as a removal
   *  of that alternative (same "empty apply == remove" idiom as `upsertLoose`),
   *  which reuses `removeOption`'s auto-ungroup guard. */
  const applyOption = (groupId: string, index: number, next: FundamentalFilter) => {
    const idx = groupIndex(groupId);
    if (idx < 0) return;
    const group = rules[idx] as FilterGroup;
    const def = SCREENER_FILTERS.find((f) => f.key === next.key);
    const empty = !def || isEmptyFilter(next, def);
    if (index < 0) {
      if (empty) return; // nothing to add
      setEntryAt(idx, { ...group, options: [...group.options, [next]] });
      return;
    }
    if (empty) {
      removeOption(groupId, index);
      return;
    }
    const options = group.options.slice();
    options[index] = [next];
    setEntryAt(idx, { ...group, options });
  };

  // ---- modal wiring: resolve what's being edited across BOTH loose + option ----
  const editingDef: ScreenerFilterDef | null = editing
    ? (SCREENER_FILTERS.find((f) => f.key === editing.key) ?? null)
    : null;
  const editingFilter: FundamentalFilter | null = (() => {
    if (!editing) return null;
    if (editing.kind === 'loose') return looseRules.find((f) => f.key === editing.key) ?? null;
    const group = rules.find((r): r is FilterGroup => isFilterGroup(r) && r.id === editing.groupId);
    const opt = group?.options[editing.index];
    return opt?.[0] ?? null;
  })();
  const editingExists = editing
    ? editing.kind === 'loose'
      ? looseKeys.has(editing.key)
      : editing.index >= 0
    : false;
  const modalOptions = editingDef?.optionsKey
    ? (options?.[editingDef.optionsKey] ?? (editingDef.optionsKey === 'sectors' ? SECTORS_LIST : []))
    : undefined;

  return (
    <>
      {rules.length > 0 && (
        <div className="sb-chips" style={{ marginTop: 14 }}>
          {rules.map((rule) =>
            isFilterGroup(rule) ? (
              <OrGroupBox
                key={rule.id}
                group={rule}
                available={allForSection}
                onEditOption={(index, key) => setEditing({ kind: 'option', groupId: rule.id, index, key })}
                onAddOption={(key) => setEditing({ kind: 'option', groupId: rule.id, index: -1, key })}
                onRemoveOption={(index) => removeOption(rule.id, index)}
                onUngroup={() => ungroup(rule)}
              />
            ) : (
              <SelectableFilterChip
                key={rule.key}
                def={SCREENER_FILTERS.find((f) => f.key === rule.key)}
                filter={rule}
                selectable={looseRules.length >= 2}
                checked={selected.has(rule.key)}
                onToggle={() => toggleSelect(rule.key)}
                onClick={() => setEditing({ kind: 'loose', key: rule.key })}
                onRemove={() => removeLoose(rule.key)}
              />
            ),
          )}
        </div>
      )}

      {selected.size >= 2 && (
        <div className="sb-group-cta">
          <button type="button" className="sb-group-btn" onClick={groupSelected}>
            Group {selected.size} as OR
          </button>
          <button type="button" className="sb-group-cancel" onClick={() => setSelected(new Set())}>
            Cancel
          </button>
        </div>
      )}

      {available.length > 0 ? (
        <div className="sb-fund-add">
          <div className="sb-select-wrap">
            <select
              className="sb-select"
              value=""
              onChange={(e) => {
                if (e.target.value) setEditing({ kind: 'loose', key: e.target.value as ScreenerFieldKey });
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
          {rules.length === 0 && emptyHint && <span className="sb-fund-add-hint">{emptyHint}</span>}
          {looseRules.length >= 2 && (
            <span className="sb-fund-add-hint">Check 2+ filters above to combine them with OR.</span>
          )}
        </div>
      ) : (
        <div className="sb-fund-add-hint" style={{ marginTop: 12 }}>
          All available fields added.
        </div>
      )}

      {editing && editingDef && (
        <SelectionFilterModal
          key={`${editing.kind}-${editing.kind === 'option' ? `${editing.groupId}-${editing.index}-` : ''}${editing.key}`}
          def={editingDef}
          initial={editingFilter}
          options={modalOptions}
          exists={editingExists}
          onApply={(next) => {
            if (editing.kind === 'loose') upsertLoose(next);
            else applyOption(editing.groupId, editing.index, next);
            setEditing(null);
          }}
          onRemove={() => {
            if (editing.kind === 'loose') removeLoose(editing.key);
            else removeOption(editing.groupId, editing.index);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

/** A loose-rule chip with an optional leading checkbox (shown only once there
 *  are >= 2 loose rules to pick from) for selecting it into a new OR group. */
function SelectableFilterChip({
  def,
  filter,
  selectable,
  checked,
  onToggle,
  onClick,
  onRemove,
}: {
  def: ScreenerFilterDef | undefined;
  filter: FundamentalFilter;
  selectable: boolean;
  checked: boolean;
  onToggle: () => void;
  onClick: () => void;
  onRemove: () => void;
}) {
  if (!def) return null;
  return (
    <span className="sb-chip-select-wrap">
      {selectable && (
        <input
          type="checkbox"
          className="sb-chip-select"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select ${def.label} to combine with OR`}
        />
      )}
      <FilterChip
        label={def.label}
        value={formatFilterValue(filter, def)}
        onClick={onClick}
        onRemove={onRemove}
      />
    </span>
  );
}

/** Renders one OR group: its alternatives (each a small AND'd filter set, in
 *  practice always one field — see `FilterOption`) separated by an "OR" pill,
 *  a picker to add another alternative, and an Ungroup control. */
function OrGroupBox({
  group,
  available,
  onEditOption,
  onAddOption,
  onRemoveOption,
  onUngroup,
}: {
  group: FilterGroup;
  available: ScreenerFilterDef[];
  onEditOption: (index: number, key: ScreenerFieldKey) => void;
  onAddOption: (key: ScreenerFieldKey) => void;
  onRemoveOption: (index: number) => void;
  onUngroup: () => void;
}) {
  return (
    <div className="sb-or-group" data-testid="sb-or-group">
      {group.options.map((opt, i) => (
        <span className="sb-or-alt-wrap" key={i}>
          {i > 0 && <span className="sb-or-sep">OR</span>}
          <span className="sb-or-alt">
            {opt.map((f, fi) => {
              const def = SCREENER_FILTERS.find((d) => d.key === f.key);
              if (!def) return null;
              return (
                <button
                  key={`${f.key}-${fi}`}
                  type="button"
                  className="sb-or-alt-field"
                  onClick={() => onEditOption(i, f.key)}
                  title="Edit alternative"
                >
                  {fi > 0 && <span className="sb-or-and">&amp;</span>}
                  <b>{def.label}:</b> {formatFilterValue(f, def)}
                </button>
              );
            })}
            <button
              type="button"
              className="sb-or-alt-remove"
              aria-label="Remove alternative"
              onClick={() => onRemoveOption(i)}
            >
              <X size={11} />
            </button>
          </span>
        </span>
      ))}
      <span className="sb-select-wrap sb-or-add">
        <select
          className="sb-select sb-or-add-select"
          value=""
          aria-label="Add alternative to OR group"
          onChange={(e) => {
            if (e.target.value) onAddOption(e.target.value as ScreenerFieldKey);
          }}
        >
          <option value="">+ OR…</option>
          {available.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </span>
      <button type="button" className="sb-or-ungroup" onClick={onUngroup}>
        Ungroup
      </button>
    </div>
  );
}
