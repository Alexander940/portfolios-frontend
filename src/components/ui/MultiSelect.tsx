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
      return (
        <span style={{ color: 'var(--c-text-dim)', fontSize: 13 }}>
          {placeholder}
        </span>
      );
    }

    if (value.length > maxDisplayItems) {
      return (
        <span style={{ color: 'var(--c-text)', fontSize: 13 }}>
          {value.length} selected
        </span>
      );
    }

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {value.map((v) => {
          const option = options.find((o) => o.value === v);
          return (
            <span
              key={v}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '1px 6px',
                background: 'var(--c-accent-soft)',
                color: 'var(--c-accent-text)',
                fontSize: 12,
                borderRadius: 4,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {option?.label || v}
              <button
                type="button"
                onClick={(e) => removeValue(v, e)}
                style={{
                  background: 'none',
                  border: 0,
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                }}
                aria-label={`Remove ${option?.label || v}`}
              >
                <X size={12} />
              </button>
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', fontFamily: 'var(--font-sans)' }}
    >
      {/* Label */}
      <label
        id={`${listboxId}-label`}
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--c-text-dim)',
          marginBottom: 6,
          fontFamily: 'var(--font-sans)',
        }}
      >
        {label}
      </label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        style={{
          width: '100%',
          minHeight: 42,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: disabled ? 'var(--c-bg-soft)' : 'var(--c-bg)',
          border: `1px solid ${
            error
              ? 'var(--c-neg)'
              : isOpen
              ? 'var(--c-accent)'
              : 'var(--c-border)'
          }`,
          borderRadius: 'var(--radius-sm)',
          color: 'var(--c-text)',
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          transition: 'border-color 0.12s, background 0.12s',
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${listboxId}-label`}
      >
        <div style={{ flex: 1, minWidth: 0 }}>{getDisplayContent()}</div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
          }}
        >
          {value.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              style={{
                padding: 4,
                color: 'var(--c-text-dim)',
                background: 'none',
                border: 0,
                cursor: 'pointer',
                display: 'inline-flex',
              }}
              aria-label="Clear all"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            color="var(--c-text-dim)"
            style={{
              transition: 'transform 0.15s',
              transform: isOpen ? 'rotate(180deg)' : 'none',
            }}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            zIndex: 50,
            width: '100%',
            top: 'calc(100% + 4px)',
            background: 'var(--c-bg)',
            border: '1px solid var(--c-border-strong)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}
          role="presentation"
        >
          {searchable && (
            <div
              style={{
                padding: 8,
                borderBottom: '1px solid var(--c-border)',
                position: 'relative',
              }}
            >
              <Search
                size={14}
                color="var(--c-text-dim)"
                style={{
                  position: 'absolute',
                  left: 18,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  fontSize: 13,
                  background: 'var(--c-bg-soft)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--radius-sm)',
                  outline: 0,
                  color: 'var(--c-text)',
                  fontFamily: 'var(--font-sans)',
                }}
              />
            </div>
          )}

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby={`${listboxId}-label`}
            style={{
              maxHeight: 240,
              overflow: 'auto',
              padding: 4,
              margin: 0,
              listStyle: 'none',
            }}
          >
            {filteredOptions.length === 0 ? (
              <li
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  color: 'var(--c-text-dim)',
                  textAlign: 'center',
                }}
              >
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      background: isHighlighted
                        ? 'var(--c-bg-soft)'
                        : 'transparent',
                      color: isSelected
                        ? 'var(--c-accent-text)'
                        : 'var(--c-text-soft)',
                      fontSize: 13,
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 3,
                        border: '1px solid',
                        background: isSelected
                          ? 'var(--c-accent)'
                          : 'transparent',
                        borderColor: isSelected
                          ? 'var(--c-accent)'
                          : 'var(--c-border-strong)',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && <Check size={10} color="#fff" />}
                    </div>
                    <span>{option.label}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {error && (
        <p
          style={{
            marginTop: 4,
            fontSize: 12,
            color: 'var(--c-neg)',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
