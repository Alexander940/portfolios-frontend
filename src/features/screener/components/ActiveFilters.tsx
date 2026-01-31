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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-gray-500">Active filters:</span>

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
          className="text-sm text-gray-500 hover:text-gray-700 underline ml-2"
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
    <div className="inline-flex items-center gap-1 pl-3 pr-1 py-1 bg-[#1e3a5f]/10 text-[#1e3a5f] rounded-full text-sm">
      <button
        type="button"
        onClick={onClick}
        className="hover:underline focus:outline-none focus:underline"
      >
        <span className="font-medium">{label}:</span>{' '}
        <span>{value}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-1 rounded-full hover:bg-[#1e3a5f]/20 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
        aria-label={`Remove ${label} filter`}
      >
        <X size={14} />
      </button>
    </div>
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
