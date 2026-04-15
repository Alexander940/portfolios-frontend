import { useScreenerStore } from '../stores';
import { TABLE_COLUMN_PRESETS } from '../constants';
import type { ColumnPresetId } from '../constants';

/**
 * Tab selector for choosing which column group is visible in the ResultsTable.
 *
 * Selection persists to localStorage via the screener store.
 */
export function ColumnPresetTabs() {
  const columnPreset = useScreenerStore((state) => state.columnPreset);
  const setColumnPreset = useScreenerStore((state) => state.setColumnPreset);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-gray-500 mr-1">
        View:
      </span>
      {TABLE_COLUMN_PRESETS.map((preset) => {
        const active = preset.id === columnPreset;
        return (
          <button
            key={preset.id}
            type="button"
            title={preset.description}
            onClick={() => setColumnPreset(preset.id as ColumnPresetId)}
            className={`
              px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
              border
              ${
                active
                  ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#1e3a5f] hover:text-[#1e3a5f]'
              }
            `}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
