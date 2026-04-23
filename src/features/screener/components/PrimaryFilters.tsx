import { MultiSelect } from '@/components/ui';
import { useScreenerStore } from '../stores';
import { useScreenerOptions } from '../hooks';
import { RATING_CONFIGS, formatRatingValue } from '../constants';
import type { RatingValue } from '../types';

/**
 * PrimaryFilters Component
 *
 * Displays the three always-visible primary filters:
 * - Market (exchange)
 * - Sector
 * - Rating (-3 to +3, excluding 0)
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
 * Rating Filter with colored badges (numeric -3..+3).
 */
interface RatingFilterProps {
  value: RatingValue[];
  onChange: (ratings: RatingValue[]) => void;
}

function RatingFilter({ value, onChange }: RatingFilterProps) {
  const toggleRating = (rating: RatingValue) => {
    if (value.includes(rating)) {
      onChange(value.filter((r) => r !== rating));
    } else {
      onChange([...value, rating]);
    }
  };

  return (
    <div>
      <label
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
        Rating
      </label>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {RATING_CONFIGS.map((config) => {
          const isSelected = value.includes(config.value);
          const label = formatRatingValue(config.value);
          return (
            <button
              key={config.value}
              type="button"
              onClick={() => toggleRating(config.value)}
              style={{
                minWidth: 38,
                height: 38,
                padding: '0 6px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: 13,
                border: '1.5px solid',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.12s',
                background: isSelected ? config.color : 'var(--c-bg)',
                color: isSelected ? '#fff' : 'var(--c-text-dim)',
                borderColor: isSelected ? config.color : 'var(--c-border)',
              }}
              aria-pressed={isSelected}
              aria-label={`Rating ${label}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
