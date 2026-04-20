import { X } from 'lucide-react';
import { useScreenerStore } from '../stores';
import { getFilterDefinition } from '../constants';
import type { RangeFilter, FilterValue } from '../types';

/**
 * ActiveFilters Component
 *
 * Displays active additional filters as removable chips/tags.
 * Shows between the filter bar and results table.
 */
export function ActiveFilters() {
  const additionalFilters = useScreenerStore((state) => state.additionalFilters);
  const removeAdditionalFilter = useScreenerStore((state) => state.removeAdditionalFilter);
  const clearAllFilters = useScreenerStore((state) => state.clearAllFilters);
  const openFilterModal = useScreenerStore((state) => state.openFilterModal);

  const filterKeys = Object.keys(additionalFilters);

  if (filterKeys.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--c-text-dim)' }}>
        Active filters:
      </span>

      {filterKeys.map((key) => {
        const filterDef = getFilterDefinition(key);
        const value = additionalFilters[key];

        if (!filterDef) return null;

        return (
          <FilterChip
            key={key}
            label={filterDef.label}
            value={formatFilterValue(value, filterDef.type, filterDef.unit)}
            onClick={() => openFilterModal(key)}
            onRemove={() => removeAdditionalFilter(key)}
          />
        );
      })}

      {filterKeys.length > 1 && (
        <button
          type="button"
          onClick={clearAllFilters}
          style={{
            fontSize: 12,
            color: 'var(--c-text-dim)',
            textDecoration: 'underline',
            marginLeft: 8,
            background: 'none',
            border: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Clear all
        </button>
      )}
    </div>
  );
}

/**
 * Filter Chip Component
 */
interface FilterChipProps {
  label: string;
  value: string;
  onClick: () => void;
  onRemove: () => void;
}

function FilterChip({ label, value, onClick, onRemove }: FilterChipProps) {
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
        style={{
          background: 'none',
          border: 0,
          color: 'inherit',
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: 0,
        }}
      >
        <span style={{ fontWeight: 500 }}>{label}:</span> <span>{value}</span>
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
          justifyContent: 'center',
        }}
        aria-label={`Remove ${label} filter`}
      >
        <X size={12} />
      </button>
    </span>
  );
}

/**
 * Format filter value for display
 */
function formatFilterValue(
  value: FilterValue,
  type: 'range' | 'boolean' | 'multiselect',
  unit?: string
): string {
  if (value === null || value === undefined) return '';

  switch (type) {
    case 'range': {
      const range = value as RangeFilter;
      const unitSuffix = unit ? ` ${unit}` : '';

      if (range.min !== undefined && range.max !== undefined) {
        return `${range.min}${unitSuffix} – ${range.max}${unitSuffix}`;
      }
      if (range.min !== undefined) {
        return `≥ ${range.min}${unitSuffix}`;
      }
      if (range.max !== undefined) {
        return `≤ ${range.max}${unitSuffix}`;
      }
      return '';
    }

    case 'boolean':
      return value ? 'Yes' : 'No';

    case 'multiselect': {
      const arr = value as string[];
      if (arr.length === 0) return '';
      if (arr.length <= 2) return arr.join(', ');
      return `${arr.slice(0, 2).join(', ')} +${arr.length - 2}`;
    }

    default:
      return String(value);
  }
}
