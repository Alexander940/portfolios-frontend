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
  const [expandedCategory, setExpandedCategory] = useState<FilterCategory | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const additionalFilters = useScreenerStore((state) => state.additionalFilters);
  const openFilterModal = useScreenerStore((state) => state.openFilterModal);

  const activeCount = Object.keys(additionalFilters).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setExpandedCategory(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle filter selection
  const handleSelectFilter = (filterKey: string) => {
    openFilterModal(filterKey);
    setIsOpen(false);
    setExpandedCategory(null);
  };

  // Check if filter is active
  const isFilterActive = (filterKey: string): boolean => {
    return filterKey in additionalFilters;
  };

  // Get filters for a category
  const getFiltersForCategory = (category: FilterCategory) => {
    return ADDITIONAL_FILTERS.filter((f) => f.category === category);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-2 px-4 py-2
          border rounded-lg text-sm font-medium
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:ring-offset-2
          ${
            isOpen
              ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }
        `}
      >
        <Plus size={18} />
        Add Filter
        {activeCount > 0 && (
          <span
            className={`
              inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full
              ${isOpen ? 'bg-white text-[#1e3a5f]' : 'bg-[#1e3a5f] text-white'}
            `}
          >
            {activeCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {FILTER_CATEGORIES.map((category) => {
              const categoryFilters = getFiltersForCategory(category.key as FilterCategory);
              const isExpanded = expandedCategory === category.key;
              const activeInCategory = categoryFilters.filter((f) =>
                isFilterActive(f.key)
              ).length;

              return (
                <div key={category.key}>
                  {/* Category Header */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCategory(isExpanded ? null : (category.key as FilterCategory))
                    }
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {category.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {activeInCategory > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-[#1e3a5f] text-white">
                          {activeInCategory}
                        </span>
                      )}
                      <ChevronRight
                        size={16}
                        className={`text-gray-400 transition-transform duration-200 ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Category Filters */}
                  {isExpanded && (
                    <div className="bg-gray-50 border-t border-b border-gray-100">
                      {categoryFilters.map((filter) => {
                        const isActive = isFilterActive(filter.key);
                        return (
                          <button
                            key={filter.key}
                            type="button"
                            onClick={() => handleSelectFilter(filter.key)}
                            className="w-full flex items-center justify-between px-6 py-2 text-left hover:bg-gray-100 transition-colors"
                          >
                            <span
                              className={`text-sm ${
                                isActive ? 'text-[#1e3a5f] font-medium' : 'text-gray-600'
                              }`}
                            >
                              {filter.label}
                            </span>
                            {isActive && (
                              <Check size={16} className="text-[#1e3a5f]" />
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
  );
}
