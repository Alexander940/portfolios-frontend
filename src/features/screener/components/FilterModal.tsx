import { useState, useEffect } from 'react';
import { Modal, Button, MultiSelect, type MultiSelectOption } from '@/components/ui';
import { useScreenerStore } from '../stores';
import { useScreenerOptions } from '../hooks';
import { getFilterDefinition } from '../constants';
import type { RangeFilter, FilterValue } from '../types';

/**
 * FilterModal Component
 *
 * Modal for configuring additional filters.
 * Content adapts based on filter type:
 * - Range: min/max inputs
 * - Boolean: toggle switch
 * - Multiselect: checkbox list
 */
export function FilterModal() {
  const activeFilterKey = useScreenerStore((state) => state.activeFilterKey);
  const additionalFilters = useScreenerStore((state) => state.additionalFilters);
  const setAdditionalFilter = useScreenerStore((state) => state.setAdditionalFilter);
  const removeAdditionalFilter = useScreenerStore((state) => state.removeAdditionalFilter);
  const closeFilterModal = useScreenerStore((state) => state.closeFilterModal);

  const { options } = useScreenerOptions();

  const [localValue, setLocalValue] = useState<FilterValue>(null);

  // Get filter definition
  const filterDef = activeFilterKey ? getFilterDefinition(activeFilterKey) : null;

  // Initialize local value when modal opens
  useEffect(() => {
    if (activeFilterKey && filterDef) {
      const existingValue = additionalFilters[activeFilterKey];
      if (existingValue !== undefined) {
        setLocalValue(existingValue);
      } else {
        // Set default values based on filter type
        switch (filterDef.type) {
          case 'range':
            setLocalValue({ min: undefined, max: undefined });
            break;
          case 'boolean':
            setLocalValue(false);
            break;
          case 'multiselect':
            setLocalValue([]);
            break;
        }
      }
    }
  }, [activeFilterKey, filterDef, additionalFilters]);

  // Handle apply
  const handleApply = () => {
    if (!activeFilterKey || !filterDef) return;

    // Validate and save the filter
    if (filterDef.type === 'range') {
      const rangeValue = localValue as RangeFilter;
      if (rangeValue.min !== undefined || rangeValue.max !== undefined) {
        setAdditionalFilter(activeFilterKey, rangeValue);
      } else {
        removeAdditionalFilter(activeFilterKey);
      }
    } else if (filterDef.type === 'boolean') {
      if (localValue === true) {
        setAdditionalFilter(activeFilterKey, true);
      } else {
        removeAdditionalFilter(activeFilterKey);
      }
    } else if (filterDef.type === 'multiselect') {
      const arrayValue = localValue as string[];
      if (arrayValue && arrayValue.length > 0) {
        setAdditionalFilter(activeFilterKey, arrayValue);
      } else {
        removeAdditionalFilter(activeFilterKey);
      }
    }

    closeFilterModal();
  };

  // Handle remove
  const handleRemove = () => {
    if (activeFilterKey) {
      removeAdditionalFilter(activeFilterKey);
    }
    closeFilterModal();
  };

  // Check if filter has a value set
  const hasExistingValue = activeFilterKey ? activeFilterKey in additionalFilters : false;

  if (!activeFilterKey || !filterDef) {
    return null;
  }

  return (
    <Modal
      isOpen={!!activeFilterKey}
      onClose={closeFilterModal}
      title={filterDef.label}
      description={filterDef.description}
      size="sm"
    >
      <div className="space-y-6">
        {/* Filter Input */}
        {filterDef.type === 'range' && (
          <RangeFilterInput
            value={localValue as RangeFilter}
            onChange={setLocalValue}
            unit={filterDef.unit}
          />
        )}

        {filterDef.type === 'boolean' && (
          <BooleanFilterInput
            value={localValue as boolean}
            onChange={setLocalValue}
            label={filterDef.label}
          />
        )}

        {filterDef.type === 'multiselect' && (
          <MultiselectFilterInput
            value={localValue as string[]}
            onChange={setLocalValue}
            filterKey={activeFilterKey}
            options={options}
          />
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          {hasExistingValue ? (
            <button
              type="button"
              onClick={handleRemove}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Remove filter
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={closeFilterModal}>
              Cancel
            </Button>
            <Button onClick={handleApply}>Apply</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Range Filter Input (min/max)
 */
interface RangeFilterInputProps {
  value: RangeFilter;
  onChange: (value: RangeFilter) => void;
  unit?: string;
}

function RangeFilterInput({ value, onChange, unit }: RangeFilterInputProps) {
  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value ? parseFloat(e.target.value) : undefined;
    onChange({ ...value, min: val });
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value ? parseFloat(e.target.value) : undefined;
    onChange({ ...value, max: val });
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <label htmlFor="filter-min" className="block text-sm font-medium text-gray-700 mb-1">
          Minimum
        </label>
        <div className="relative">
          <input
            id="filter-min"
            type="number"
            value={value.min ?? ''}
            onChange={handleMinChange}
            placeholder="No min"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
          />
          {unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              {unit}
            </span>
          )}
        </div>
      </div>

      <span className="text-gray-400 pt-6">—</span>

      <div className="flex-1">
        <label htmlFor="filter-max" className="block text-sm font-medium text-gray-700 mb-1">
          Maximum
        </label>
        <div className="relative">
          <input
            id="filter-max"
            type="number"
            value={value.max ?? ''}
            onChange={handleMaxChange}
            placeholder="No max"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
          />
          {unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Boolean Filter Input (toggle)
 */
interface BooleanFilterInputProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

function BooleanFilterInput({ value, onChange, label }: BooleanFilterInputProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`
            w-11 h-6 rounded-full transition-colors duration-200
            ${value ? 'bg-[#1e3a5f]' : 'bg-gray-300'}
          `}
        />
        <div
          className={`
            absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow
            transition-transform duration-200
            ${value ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </div>
      <span className="text-sm font-medium text-gray-700">
        Filter for stocks at {label.toLowerCase()}
      </span>
    </label>
  );
}

/**
 * Multiselect Filter Input
 */
interface MultiselectFilterInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  filterKey: string;
  options: {
    countries: string[];
    exchanges: string[];
    sectors: string[];
  } | null;
}

function MultiselectFilterInput({
  value,
  onChange,
  filterKey,
  options,
}: MultiselectFilterInputProps) {
  // Get available options based on filter key
  const getOptions = (): MultiSelectOption[] => {
    if (!options) return [];

    switch (filterKey) {
      case 'country':
        return options.countries.map((c) => ({ value: c, label: c }));
      case 'exchange':
        return options.exchanges.map((e) => ({ value: e, label: e }));
      case 'sector':
        return options.sectors.map((s) => ({ value: s, label: s }));
      default:
        return [];
    }
  };

  const availableOptions = getOptions();

  return (
    <MultiSelect
      label="Select values"
      options={availableOptions}
      value={value}
      onChange={onChange}
      placeholder="Select..."
      searchable={availableOptions.length > 10}
      maxDisplayItems={5}
    />
  );
}
