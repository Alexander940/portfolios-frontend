import { useState, useRef, useEffect } from 'react';
import { Plus, ChevronRight, Check } from 'lucide-react';
import { useScreenerStore } from '../stores';
import { FILTER_CATEGORIES, ADDITIONAL_FILTERS } from '../constants';
import type { FilterCategory } from '../types';

/**
 * AdditionalFiltersMenu Component
 *
 * "Add Filter" button that opens a categorized dropdown menu
 * for selecting additional filters to configure.
 */
export function AdditionalFiltersMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<FilterCategory | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const additionalFilters = useScreenerStore((state) => state.additionalFilters);
  const openFilterModal = useScreenerStore((state) => state.openFilterModal);

  const activeCount = Object.keys(additionalFilters).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setExpandedCategory(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectFilter = (filterKey: string) => {
    openFilterModal(filterKey);
    setIsOpen(false);
    setExpandedCategory(null);
  };

  const isFilterActive = (filterKey: string): boolean =>
    filterKey in additionalFilters;

  const getFiltersForCategory = (category: FilterCategory) =>
    ADDITIONAL_FILTERS.filter((f) => f.category === category);

  return (
    <div>
      {/* Invisible spacer label so the button bottom aligns with the
          bottom of the labeled multi-selects in PrimaryFilters. */}
      <div
        aria-hidden="true"
        style={{
          fontSize: 12,
          fontWeight: 500,
          marginBottom: 6,
          visibility: 'hidden',
          userSelect: 'none',
        }}
      >
        &nbsp;
      </div>

      <div ref={containerRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className={isOpen ? 'chip active' : 'chip'}
          style={{
            padding: '7px 12px',
            fontSize: 13,
            borderRadius: 'var(--radius-sm)',
            fontWeight: 500,
          }}
        >
          <Plus size={14} />
          Add Filter
          {activeCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                marginLeft: 2,
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 100,
                background: isOpen
                  ? 'rgba(255,255,255,0.85)'
                  : 'var(--c-accent)',
                color: isOpen ? 'var(--c-accent-text)' : '#fff',
              }}
            >
              {activeCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              width: 280,
              background: 'var(--c-bg)',
              border: '1px solid var(--c-border-strong)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 80,
              overflow: 'hidden',
              maxHeight: '70vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ padding: 4 }}>
              {FILTER_CATEGORIES.map((category) => {
                const categoryFilters = getFiltersForCategory(
                  category.key as FilterCategory,
                );
                const isExpanded = expandedCategory === category.key;
                const activeInCategory = categoryFilters.filter((f) =>
                  isFilterActive(f.key),
                ).length;

                return (
                  <div key={category.key}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCategory(
                          isExpanded ? null : (category.key as FilterCategory),
                        )
                      }
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        textAlign: 'left',
                        background: 'none',
                        border: 0,
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 13,
                        color: 'var(--c-text)',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--c-bg-soft)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'transparent')
                      }
                    >
                      <span style={{ fontWeight: 500 }}>{category.label}</span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {activeInCategory > 0 && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: 18,
                              height: 18,
                              padding: '0 5px',
                              fontSize: 10,
                              fontWeight: 700,
                              borderRadius: 100,
                              background: 'var(--c-accent)',
                              color: '#fff',
                            }}
                          >
                            {activeInCategory}
                          </span>
                        )}
                        <ChevronRight
                          size={14}
                          color="var(--c-text-dim)"
                          style={{
                            transition: 'transform 0.15s',
                            transform: isExpanded ? 'rotate(90deg)' : 'none',
                          }}
                        />
                      </span>
                    </button>

                    {isExpanded && (
                      <div
                        style={{
                          background: 'var(--c-bg-soft)',
                          borderRadius: 'var(--radius-sm)',
                          margin: '2px 0',
                          padding: '4px 0',
                        }}
                      >
                        {categoryFilters.map((filter) => {
                          const isActive = isFilterActive(filter.key);
                          return (
                            <button
                              key={filter.key}
                              type="button"
                              onClick={() => handleSelectFilter(filter.key)}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 12px 6px 28px',
                                textAlign: 'left',
                                background: 'none',
                                border: 0,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                fontSize: 12.5,
                                color: isActive
                                  ? 'var(--c-accent-text)'
                                  : 'var(--c-text-soft)',
                                fontWeight: isActive ? 500 : 400,
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                  'var(--c-bg-softer)')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background =
                                  'transparent')
                              }
                            >
                              <span>{filter.label}</span>
                              {isActive && (
                                <Check
                                  size={14}
                                  color="var(--c-accent-text)"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
