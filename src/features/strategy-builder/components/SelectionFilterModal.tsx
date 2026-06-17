// Modal-based editing for a Selection-rules filter — mirrors the screener's
// FilterModal/ActiveFilters UX: a clickable chip shows the filter's bounds and
// reopens the modal; the modal has min/max inputs + Apply/Remove/Cancel.
import { useState } from 'react';

import { X } from 'lucide-react';

import { Button, Modal } from '@/components/ui';

import type { ScreenerFilterDef } from '../mapping';

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
  initialMin: Bound;
  initialMax: Bound;
  /** Whether the filter is already in the active list (shows "Remove"). */
  exists: boolean;
  onApply: (min: Bound, max: Bound) => void;
  onRemove: () => void;
  onClose: () => void;
}

/** Range-filter modal (the only filter type used in Selection rules). */
export function SelectionFilterModal({
  def,
  initialMin,
  initialMax,
  exists,
  onApply,
  onRemove,
  onClose,
}: SelectionFilterModalProps) {
  const [min, setMin] = useState<Bound>(initialMin);
  const [max, setMax] = useState<Bound>(initialMax);
  const parse = (v: string): Bound => (v === '' ? '' : parseFloat(v));

  return (
    <Modal isOpen onClose={onClose} title={def.label} description={def.hint} size="sm">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum</label>
            <div className="relative">
              <input
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Maximum</label>
            <div className="relative">
              <input
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
            <Button onClick={() => onApply(min, max)}>Apply</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
