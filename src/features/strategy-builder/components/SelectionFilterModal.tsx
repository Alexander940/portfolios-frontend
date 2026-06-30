// Modal-based editing for a Selection-rules filter — mirrors the screener's
// FilterModal/ActiveFilters UX: a clickable chip shows the filter's bounds and
// reopens the modal; the modal has min/max inputs + Apply/Remove/Cancel.
import { useState } from 'react';

import { X } from 'lucide-react';

import { Button, Modal } from '@/components/ui';

import type { ScreenerFilterDef } from '../mapping';
import type { FilterValueType, FundamentalFilter } from '../types';

type Bound = number | '';

interface FilterChipProps {
  label: string;
  value: string;
  onClick: () => void;
  onRemove: () => void;
}

/** A clickable filter chip (opens the modal); the × removes the filter. */
export function FilterChip({ label, value, onClick, onRemove }: FilterChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: '3px 4px 3px 10px',
        background: 'var(--c-accent-soft)',
        color: 'var(--c-accent-text)',
        border: '1px solid var(--c-accent)',
        borderRadius: 100,
        fontSize: 12,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
      >
        <span style={{ fontWeight: 600 }}>{label}:</span> <span>{value}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        style={{
          padding: 4,
          borderRadius: '50%',
          background: 'none',
          border: 0,
          color: 'inherit',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
        }}
        aria-label={`Remove ${label} filter`}
      >
        <X size={12} />
      </button>
    </span>
  );
}

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent';

interface SelectionFilterModalProps {
  def: ScreenerFilterDef;
  /** The current value of the filter being edited (null = adding a new one). */
  initial: FundamentalFilter | null;
  /** Option values for a multiselect field (from GET /screener/options). */
  options?: string[];
  /** Whether the filter is already in the active list (shows "Remove"). */
  exists: boolean;
  onApply: (next: FundamentalFilter) => void;
  onRemove: () => void;
  onClose: () => void;
}

/** Filter-editing modal — renders the input(s) for the field's catalog `type`:
 *  range (min/max), boolean (on/off or Yes/No), multiselect (checkbox list), or
 *  daterange (two date inputs). Returns a typed FundamentalFilter via onApply. */
export function SelectionFilterModal({
  def,
  initial,
  options,
  exists,
  onApply,
  onRemove,
  onClose,
}: SelectionFilterModalProps) {
  const type: FilterValueType = def.type ?? 'range';
  const [min, setMin] = useState<Bound>(initial?.min ?? '');
  const [max, setMax] = useState<Bound>(initial?.max ?? '');
  const [boolValue, setBoolValue] = useState<boolean>(initial?.value ?? true);
  const [values, setValues] = useState<string[]>(initial?.values ?? []);
  const [dateMin, setDateMin] = useState<string>(initial?.dateMin ?? '');
  const [dateMax, setDateMax] = useState<string>(initial?.dateMax ?? '');
  const parse = (v: string): Bound => (v === '' ? '' : parseFloat(v));

  const toggleOption = (v: string) =>
    setValues((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

  const apply = () => {
    if (type === 'boolean') onApply({ key: def.key, type, value: boolValue });
    else if (type === 'multiselect') onApply({ key: def.key, type, values });
    else if (type === 'daterange') onApply({ key: def.key, type, dateMin, dateMax });
    else onApply({ key: def.key, type, min, max });
  };

  return (
    <Modal isOpen onClose={onClose} title={def.label} description={def.hint} size="sm">
      <div className="space-y-6">
        {type === 'range' && (
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label htmlFor={`sel-min-${def.key}`} className="block text-sm font-medium text-gray-700 mb-1">
                Minimum
              </label>
              <div className="relative">
                <input
                  id={`sel-min-${def.key}`}
                  type="number"
                  value={min}
                  onChange={(e) => setMin(parse(e.target.value))}
                  placeholder="No min"
                  className={inputCls}
                />
                {def.unit && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    {def.unit}
                  </span>
                )}
              </div>
            </div>

            <span className="text-gray-400 pt-6">—</span>

            <div className="flex-1">
              <label htmlFor={`sel-max-${def.key}`} className="block text-sm font-medium text-gray-700 mb-1">
                Maximum
              </label>
              <div className="relative">
                <input
                  id={`sel-max-${def.key}`}
                  type="number"
                  value={max}
                  onChange={(e) => setMax(parse(e.target.value))}
                  placeholder="No max"
                  className={inputCls}
                />
                {def.unit && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    {def.unit}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {type === 'daterange' && (
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label htmlFor={`sel-dmin-${def.key}`} className="block text-sm font-medium text-gray-700 mb-1">
                From
              </label>
              <input
                id={`sel-dmin-${def.key}`}
                type="date"
                value={dateMin}
                onChange={(e) => setDateMin(e.target.value)}
                className={inputCls}
              />
            </div>
            <span className="text-gray-400 pt-6">—</span>
            <div className="flex-1">
              <label htmlFor={`sel-dmax-${def.key}`} className="block text-sm font-medium text-gray-700 mb-1">
                To
              </label>
              <input
                id={`sel-dmax-${def.key}`}
                type="date"
                value={dateMax}
                onChange={(e) => setDateMax(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        )}

        {type === 'boolean' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Must be</label>
            {def.boolTrueOnly ? (
              <p className="text-sm text-gray-600">
                <b>True</b> — only names currently flagged pass. (False is a no-op for this field, so
                it is on/off.)
              </p>
            ) : (
              <select
                className={inputCls}
                value={boolValue ? 'true' : 'false'}
                onChange={(e) => setBoolValue(e.target.value === 'true')}
              >
                <option value="true">Yes (true)</option>
                <option value="false">No (false)</option>
              </select>
            )}
          </div>
        )}

        {type === 'multiselect' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select one or more</label>
            <div className="max-h-60 overflow-auto border border-gray-200 rounded-lg p-2 space-y-1">
              {(options ?? []).length === 0 ? (
                <p className="text-sm text-gray-400">No options available.</p>
              ) : (
                (options ?? []).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={values.includes(opt)}
                      onChange={() => toggleOption(opt)}
                    />
                    {opt}
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          {exists ? (
            <button
              type="button"
              onClick={onRemove}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Remove filter
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={apply}>Apply</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
