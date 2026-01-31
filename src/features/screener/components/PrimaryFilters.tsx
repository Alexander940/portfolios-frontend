import { MultiSelect } from '@/components/ui';
import { useScreenerStore } from '../stores';
import { useScreenerOptions } from '../hooks';
import { RATING_CONFIGS } from '../constants';
import type { RatingLetter } from '../types';

/**
 * PrimaryFilters Component
 *
 * Displays the three always-visible primary filters:
 * - Market (exchange)
 * - Sector
 * - Rating (A, B, C, D)
 */
export function PrimaryFilters() {
  const { options, isLoading } = useScreenerOptions();

  // Store state and actions
  const exchanges = useScreenerStore((state) => state.exchanges);
  const sectors = useScreenerStore((state) => state.sectors);
  const ratings = useScreenerStore((state) => state.ratings);
  const setExchanges = useScreenerStore((state) => state.setExchanges);
  const setSectors = useScreenerStore((state) => state.setSectors);
  const setRatings = useScreenerStore((state) => state.setRatings);

  // Convert API options to MultiSelect format
  const exchangeOptions =
    options?.exchanges.map((e) => ({ value: e, label: e })) ?? [];

  const sectorOptions =
    options?.sectors.map((s) => ({ value: s, label: s })) ?? [];

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Market Filter */}
      <div className="flex-1 min-w-[180px]">
        <MultiSelect
          label="Market"
          options={exchangeOptions}
          value={exchanges}
          onChange={setExchanges}
          placeholder={isLoading ? 'Loading...' : 'All markets'}
          disabled={isLoading}
          searchable={exchangeOptions.length > 10}
        />
      </div>

      {/* Sector Filter */}
      <div className="flex-1 min-w-[180px]">
        <MultiSelect
          label="Sector"
          options={sectorOptions}
          value={sectors}
          onChange={setSectors}
          placeholder={isLoading ? 'Loading...' : 'All sectors'}
          disabled={isLoading}
          searchable={sectorOptions.length > 10}
        />
      </div>

      {/* Rating Filter */}
      <div className="w-full sm:w-[160px]">
        <RatingFilter
          value={ratings}
          onChange={setRatings}
        />
      </div>
    </div>
  );
}

/**
 * Rating Filter with colored badges
 */
interface RatingFilterProps {
  value: RatingLetter[];
  onChange: (ratings: RatingLetter[]) => void;
}

function RatingFilter({ value, onChange }: RatingFilterProps) {
  const toggleRating = (rating: RatingLetter) => {
    if (value.includes(rating)) {
      onChange(value.filter((r) => r !== rating));
    } else {
      onChange([...value, rating]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Rating
      </label>
      <div className="flex gap-2">
        {RATING_CONFIGS.map((config) => {
          const isSelected = value.includes(config.letter);
          return (
            <button
              key={config.letter}
              type="button"
              onClick={() => toggleRating(config.letter)}
              className={`
                w-10 h-10 rounded-lg font-bold text-sm
                border-2 transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1e3a5f]
                ${
                  isSelected
                    ? 'text-white shadow-md'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                }
              `}
              style={
                isSelected
                  ? {
                      backgroundColor: config.color,
                      borderColor: config.color,
                    }
                  : undefined
              }
              aria-pressed={isSelected}
              aria-label={`Rating ${config.letter}`}
            >
              {config.letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}
