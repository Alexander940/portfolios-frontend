import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { Check, ChevronDown, X, Search } from 'lucide-react';

/**
 * Option for the MultiSelect component
 */
export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  /** Available options */
  options: MultiSelectOption[];
  /** Currently selected values */
  value: string[];
  /** Callback when selection changes */
  onChange: (values: string[]) => void;
  /** Placeholder text when nothing is selected */
  placeholder?: string;
  /** Label for accessibility */
  label: string;
  /** Show search input for filtering options */
  searchable?: boolean;
  /** Maximum items to show before collapsing to count */
  maxDisplayItems?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Error message */
  error?: string;
}

/**
 * MultiSelect Component
 *
 * A multi-select dropdown with:
 * - Checkbox selection
 * - Optional search/filter
 * - Selected items display as chips or count
 * - Keyboard navigation
 * - Full ARIA support
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  searchable = true,
  maxDisplayItems = 2,
  disabled = false,
  error,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const listboxId = `multiselect-listbox-${label.toLowerCase().replace(/\s+/g, '-')}`;

  // Filter options based on search query
  const filteredOptions = searchQuery
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Reset highlighted index when filtered options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Toggle option selection
  const toggleOption = useCallback(
    (optionValue: string) => {
      const newValue = value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue];
      onChange(newValue);
    },
    [value, onChange]
  );

  // Remove a single selected value
  const removeValue = useCallback(
    (optionValue: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(value.filter((v) => v !== optionValue));
    },
    [value, onChange]
  );

  // Clear all selections
  const clearAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
    },
    [onChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (filteredOptions[highlightedIndex]) {
          toggleOption(filteredOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchQuery('');
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
    }
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Get display text for selected values
  const getDisplayContent = () => {
    if (value.length === 0) {
      return <span className="text-gray-400">{placeholder}</span>;
    }

    if (value.length > maxDisplayItems) {
      return (
        <span className="text-gray-700">
          {value.length} selected
        </span>
      );
    }

    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v) => {
          const option = options.find((o) => o.value === v);
          return (
            <span
              key={v}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1e3a5f]/10 text-[#1e3a5f] text-sm rounded"
            >
              {option?.label || v}
              <button
                type="button"
                onClick={(e) => removeValue(v, e)}
                className="hover:text-[#1e3a5f]/70 focus:outline-none"
                aria-label={`Remove ${option?.label || v}`}
              >
                <X size={14} />
              </button>
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Label */}
      <label
        id={`${listboxId}-label`}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          w-full min-h-[42px] px-3 py-2
          flex items-center justify-between gap-2
          border rounded-lg bg-white text-left
          transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${error ? 'border-red-500' : 'border-gray-300'}
          ${isOpen ? 'ring-2 ring-[#1e3a5f] border-transparent' : ''}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${listboxId}-label`}
      >
        <div className="flex-1 min-w-0">{getDisplayContent()}</div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {value.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
              aria-label="Clear all"
            >
              <X size={16} />
            </button>
          )}
          <ChevronDown
            size={20}
            className={`text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg"
          role="presentation"
        >
          {/* Search input */}
          {searchable && (
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby={`${listboxId}-label`}
            className="max-h-60 overflow-auto py-1"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500 text-center">
                No options found
              </li>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = value.includes(option.value);
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleOption(option.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`
                      flex items-center gap-3 px-3 py-2 cursor-pointer
                      transition-colors duration-100
                      ${isHighlighted ? 'bg-gray-100' : ''}
                      ${isSelected ? 'text-[#1e3a5f]' : 'text-gray-700'}
                    `}
                  >
                    <div
                      className={`
                        w-4 h-4 flex items-center justify-center rounded border
                        transition-colors duration-100
                        ${
                          isSelected
                            ? 'bg-[#1e3a5f] border-[#1e3a5f]'
                            : 'border-gray-300'
                        }
                      `}
                    >
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                    <span className="text-sm">{option.label}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
