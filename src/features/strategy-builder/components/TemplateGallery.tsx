// Template gallery (issue #59): pick a catalog template and create a strategy
// from it SERVER-SIDE (#58) — the canonical spec never passes through the lossy
// form mapping, so no filter can be dropped (the #34 regression).
import { useEffect, useState } from 'react';

import { Icon } from '../icons';
import { createStrategyFromTemplate } from '../service';
import type { TemplateListItem } from '../types';

interface Props {
  templates: TemplateListItem[] | null; // null = loading
  loadError: string | null;
  onCreated: (strategyId: string) => void;
}

function chipText(t: TemplateListItem): string[] {
  const s = t.summary;
  const chips = [`${s.filters_count} filters`];
  if (s.top_n != null) chips.push(`Top ${s.top_n}`);
  if (s.cadence) chips.push(s.cadence);
  if (s.weighting) chips.push(s.weighting);
  if (s.objective_metric) chips.push(`obj: ${s.objective_metric}`);
  return chips;
}

function errStatus(e: unknown): number | undefined {
  if (e && typeof e === 'object') {
    const err = e as { status?: number; response?: { status?: number } };
    return err.status ?? err.response?.status;
  }
  return undefined;
}

export function TemplateGallery({ templates, loadError, onCreated }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [selected]);

  if (loadError) {
    return (
      <div className="sb-empty">
        <div className="sb-empty-mark">
          <Icon name="warn" size={24} />
        </div>
        <h3>Templates unavailable</h3>
        <p>{loadError}</p>
      </div>
    );
  }
  if (templates === null) {
    return <div className="sb-empty"><p>Loading templates…</p></div>;
  }
  if (templates.length === 0) {
    return (
      <div className="sb-empty">
        <div className="sb-empty-mark">
          <Icon name="blocks" size={24} />
        </div>
        <h3>No templates yet</h3>
        <p>The template catalog has not been seeded on the server.</p>
      </div>
    );
  }

  const use = async (t: TemplateListItem) => {
    const finalName = name.trim() || t.title;
    setBusy(true);
    setError(null);
    try {
      const created = await createStrategyFromTemplate(t.slug, finalName, {
        description: t.description ?? undefined,
      });
      onCreated(created.strategy_id);
    } catch (e) {
      const status = errStatus(e);
      setError(
        status === 409
          ? `You already have a strategy named "${finalName}" — pick another name.`
          : 'Could not create the strategy. Try again in a moment.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tg-grid">
      {templates.map((t) => {
        const paused = t.status === 'paused';
        const isOpen = selected === t.slug;
        return (
          <div key={t.slug} className={`tg-card${paused ? ' paused' : ''}`}>
            <div className="tg-title-row">
              <span className="tg-title">{t.title}</span>
              <span className="tg-version">v{t.latest_version}</span>
              {paused && (
                <span
                  className="tg-paused-tag"
                  title="Paused in the catalog: its universe currently yields too few candidates (catalog §2.D)."
                >
                  <Icon name="warn" size={10} /> PAUSED
                </span>
              )}
            </div>
            {t.description && <div className="tg-desc">{t.description}</div>}
            <div className="tg-chips">
              {chipText(t).map((c) => (
                <span key={c} className="tg-chip">{c}</span>
              ))}
            </div>
            {isOpen && !paused ? (
              <>
                <div className="tg-use-row">
                  <input
                    className="tg-name-input"
                    placeholder="Strategy name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                  <button
                    className="sb-btn primary"
                    style={{ width: 'auto' }}
                    disabled={busy}
                    onClick={() => void use(t)}
                  >
                    Create
                  </button>
                  <button
                    className="sb-btn"
                    style={{ width: 'auto' }}
                    disabled={busy}
                    onClick={() => setSelected(null)}
                  >
                    Cancel
                  </button>
                </div>
                {error && <div className="tg-error">{error}</div>}
              </>
            ) : (
              <button
                className="sb-btn primary"
                style={{ width: 'auto' }}
                disabled={paused}
                title={
                  paused
                    ? 'Paused: not offered by default. Ask the assistant if you really need it.'
                    : undefined
                }
                onClick={() => {
                  setSelected(t.slug);
                  setName(t.title);
                }}
              >
                <Icon name="plus" size={13} /> Use template
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
