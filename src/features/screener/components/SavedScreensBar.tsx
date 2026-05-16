import { useEffect, useState } from 'react';
import { Bookmark, Globe, Plus, Sparkles, X } from 'lucide-react';
import { useScreenerStore, usePresetStore } from '../stores';
import type { ScreenerPreset } from '../types';
import { SaveScreenModal } from './SaveScreenModal';

/**
 * Horizontal, scrollable row of saved screens displayed above the filter
 * card. Each chip is clickable to re-apply the stored filter + view state.
 * The first chip is a "Save current" call-to-action that opens the
 * SaveScreenModal.
 *
 * Visibility rules (enforced by the backend):
 *   - Caller's own presets
 *   - Anything flagged `is_public` (community)
 *   - Anything flagged `is_system` (curated)
 *
 * Mutations (delete) only succeed for the caller's own presets, so the X
 * affordance is hidden on community / system chips.
 */
export function SavedScreensBar() {
  const presets = usePresetStore((s) => s.presets);
  const isLoading = usePresetStore((s) => s.isLoading);
  const error = usePresetStore((s) => s.error);
  const activePresetId = usePresetStore((s) => s.activePresetId);
  const fetchPresets = usePresetStore((s) => s.fetchPresets);
  const deletePreset = usePresetStore((s) => s.deletePreset);
  const setActivePreset = usePresetStore((s) => s.setActivePreset);
  const applyPreset = useScreenerStore((s) => s.applyPreset);

  const [isSaveOpen, setIsSaveOpen] = useState(false);

  // Initial load.
  useEffect(() => {
    void fetchPresets();
  }, [fetchPresets]);

  function handleApply(preset: ScreenerPreset) {
    applyPreset(preset.criteria);
    setActivePreset(preset.preset_id);
  }

  async function handleDelete(preset: ScreenerPreset, event: React.MouseEvent) {
    event.stopPropagation();
    const confirmed = window.confirm(
      `Delete saved screen "${preset.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await deletePreset(preset.preset_id);
    } catch {
      window.alert('Could not delete this screen. Try again in a moment.');
    }
  }

  return (
    <>
      <div
        className="card"
        style={{
          padding: '12px 14px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            overflowY: 'hidden',
            paddingBottom: 4,
            // Keep the horizontal scrollbar slim and unobtrusive on Webkit.
            scrollbarWidth: 'thin',
          }}
        >
          <SaveChipButton onClick={() => setIsSaveOpen(true)} />

          {isLoading && presets.length === 0 && (
            <SkeletonChips count={4} />
          )}

          {presets.map((preset) => (
            <PresetChip
              key={preset.preset_id}
              preset={preset}
              isActive={activePresetId === preset.preset_id}
              onApply={handleApply}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {error && (
          <div
            role="alert"
            style={{
              fontSize: 11,
              color: 'var(--c-danger, #ef4444)',
              marginTop: 6,
            }}
          >
            {error}
          </div>
        )}
      </div>

      <SaveScreenModal isOpen={isSaveOpen} onClose={() => setIsSaveOpen(false)} />
    </>
  );
}

// =============================================================================
// Individual chip components — kept private to this file.
// =============================================================================

interface PresetChipProps {
  preset: ScreenerPreset;
  isActive: boolean;
  onApply: (preset: ScreenerPreset) => void;
  onDelete: (preset: ScreenerPreset, event: React.MouseEvent) => void;
}

function PresetChip({ preset, isActive, onApply, onDelete }: PresetChipProps) {
  const [hovered, setHovered] = useState(false);
  const isOwned = preset.user_id !== null && !preset.is_system;

  return (
    <button
      type="button"
      onClick={() => onApply(preset)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={preset.description ?? preset.name}
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 8,
        border: `1px solid ${isActive ? 'var(--c-accent, #3b82f6)' : 'var(--c-border, #2a2a2a)'}`,
        background: isActive
          ? 'var(--c-accent-bg, rgba(59, 130, 246, 0.12))'
          : 'var(--c-surface, transparent)',
        color: 'var(--c-text, inherit)',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        maxWidth: 220,
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      {preset.is_system ? (
        <Sparkles size={12} aria-label="system" />
      ) : preset.is_public ? (
        <Globe size={12} aria-label="public" />
      ) : (
        <Bookmark size={12} aria-label="private" />
      )}

      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 160,
        }}
      >
        {preset.name}
      </span>

      {isOwned && hovered && (
        <span
          role="button"
          aria-label={`Delete ${preset.name}`}
          tabIndex={0}
          onClick={(e) => onDelete(preset, e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onDelete(preset, e as unknown as React.MouseEvent);
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            borderRadius: 4,
            color: 'var(--c-text-dim, #999)',
            cursor: 'pointer',
          }}
        >
          <X size={12} />
        </span>
      )}
    </button>
  );
}

function SaveChipButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Save the current filters as a new screen"
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 8,
        border: '1px dashed var(--c-border, #2a2a2a)',
        background: 'transparent',
        color: 'var(--c-text-dim, #999)',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'color 120ms ease, border-color 120ms ease',
      }}
    >
      <Plus size={12} />
      <span>Save current</span>
    </button>
  );
}

function SkeletonChips({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            flexShrink: 0,
            width: 120,
            height: 30,
            borderRadius: 8,
            background:
              'linear-gradient(90deg, var(--c-surface, #1a1a1a) 0%, var(--c-border, #2a2a2a) 50%, var(--c-surface, #1a1a1a) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s ease-in-out infinite',
            opacity: 0.6,
          }}
        />
      ))}
    </>
  );
}
