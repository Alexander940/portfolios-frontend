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
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--c-text-dim)',
          marginRight: 4,
        }}
      >
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
            className={`chip ${active ? 'active' : ''}`}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
