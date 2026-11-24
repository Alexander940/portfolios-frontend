import { useCallback, useEffect, useState } from 'react';

import { Icon } from '../icons';
import { listSharedWithMe } from '../service';
import type { SavedStrategy, SharedStrategyListItem } from '../types';
import { Sparkline } from './formBits';
import { ShareStrategyModal } from './ShareStrategyModal';

const fmtPct = (v: number, d = 1) => `${v > 0 ? '+' : ''}${v.toFixed(d)}%`;

interface Props {
  strategies: SavedStrategy[];
  /** slug → latest promoted version of each template (for the "vN available"
   *  upgrade notice on strategies created from an older version). */
  templateLatest?: Record<string, number>;
  onNew: () => void;
  onOpen: (s: SavedStrategy) => void;
  onEdit: (s: SavedStrategy) => void;
  onBacktest: (s: SavedStrategy) => void;
  onDelete: (s: SavedStrategy) => void;
  /** Open a strategy someone shared with the caller (loads `GET /strategies/{id}`). */
  onOpenShared: (s: SharedStrategyListItem) => void;
  /** «Duplicate» (#349): copy any persisted strategy — own or shared — into a
   *  new one owned by the caller. */
  onDuplicate: (id: string) => void;
  /** The caller handed `id` over (#349): drop it from the own list. */
  onTransferred: (id: string) => void;
}

const ROLE_LABEL: Record<SharedStrategyListItem['permission'], string> = {
  viewer: 'Viewer',
  co_owner: 'Co-owner',
};

interface ShareTarget {
  id: string;
  name: string;
  role: 'owner' | 'co_owner';
}

function ago(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** «Shared with me»: fetched on mount and again on `reload()` (after a
 *  transfer the strategy moves here as co_owner, #349). Any failure (older
 *  backend, offline, a mock that doesn't know the route) or a malformed body
 *  leaves it as it was — the own list must never depend on it. */
function useSharedWithMe(): { items: SharedStrategyListItem[]; reload: () => void } {
  const [items, setItems] = useState<SharedStrategyListItem[]>([]);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    listSharedWithMe(50, 0, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setItems(Array.isArray(res?.items) ? res.items : []);
      })
      .catch(() => {
        /* keep the section as it was */
      });
    return () => controller.abort();
  }, [nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { items, reload };
}

export function ListView({
  strategies,
  templateLatest,
  onNew,
  onOpen,
  onEdit,
  onBacktest,
  onDelete,
  onOpenShared,
  onDuplicate,
  onTransferred,
}: Props) {
  const { items: shared, reload: reloadShared } = useSharedWithMe();
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);

  const sharedSection =
    shared.length > 0 ? (
      <section className="sb-shared" aria-labelledby="sb-shared-title">
        <h2 id="sb-shared-title" className="sb-shared-title">
          Shared with me
        </h2>
        <div className="sb-list">
          {shared.map((s) => (
            <div key={s.strategy_id} className="sb-card shared" onClick={() => onOpenShared(s)}>
              <div className="sb-card-main">
                <div className="sb-card-title-row">
                  <span className="sb-card-name">{s.name}</span>
                  <span className="sb-role-tag">{ROLE_LABEL[s.permission] ?? s.permission}</span>
                </div>
                <div className="sb-shared-by">shared by {s.owner_email}</div>
                {Date.parse(s.updated_at) > 0 && (
                  <div className="sb-card-updated">Updated {ago(Date.parse(s.updated_at))}</div>
                )}
              </div>
              <div className="sb-card-actions" onClick={(e) => e.stopPropagation()}>
                {/* Any role may copy it into a strategy of their own. */}
                <button
                  className="sb-icon-btn"
                  title="Duplicate"
                  aria-label={`Duplicate ${s.name}`}
                  onClick={() => onDuplicate(s.strategy_id)}
                >
                  <Icon name="copy" size={15} />
                </button>
                {/* A viewer can't manage access — no Share button at all. */}
                {s.permission === 'co_owner' && (
                  <button
                    className="sb-icon-btn"
                    title="Share"
                    aria-label={`Share ${s.name}`}
                    onClick={() => setShareTarget({ id: s.strategy_id, name: s.name, role: 'co_owner' })}
                  >
                    <Icon name="share" size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    ) : null;

  const shareModal = shareTarget ? (
    <ShareStrategyModal
      isOpen
      onClose={() => setShareTarget(null)}
      strategyId={shareTarget.id}
      strategyName={shareTarget.name}
      role={shareTarget.role}
      onTransferred={() => {
        onTransferred(shareTarget.id);
        reloadShared();
      }}
    />
  ) : null;

  if (strategies.length === 0) {
    return (
      <>
        <div className="sb-empty">
          <div className="sb-empty-mark">
            <Icon name="blocks" size={24} />
          </div>
          <h3>No strategies yet</h3>
          <p>
            Build your first rules-based strategy, backtest it against historical data, and see how it would have performed versus the S&amp;P 500.
          </p>
          <button className="sb-btn primary" style={{ width: 'auto' }} onClick={onNew}>
            <Icon name="plus" size={14} /> New strategy
          </button>
        </div>
        {sharedSection}
        {shareModal}
      </>
    );
  }

  return (
    <>
      <div className="sb-list">
        {strategies.map((s) => {
          const r = s.summary;
          return (
            <div key={s.id} className="sb-card" onClick={() => (r ? onOpen(s) : onEdit(s))}>
              <div className="sb-card-main">
                <div className="sb-card-title-row">
                  <span className="sb-card-name">{s.name}</span>
                  <span className={`sb-status ${s.status === 'saved' ? 'draft' : s.status}`}>
                    <span className="sb-status-dot" />
                    {s.status === 'backtested'
                      ? 'Backtested'
                      : s.status === 'saved'
                        ? 'Saved'
                        : 'Draft'}
                  </span>
                  {r?.lowConf && (
                    <span className="sb-lowconf-tag">
                      <Icon name="warn" size={10} /> Low conf.
                    </span>
                  )}
                  {s.templateSlug && s.templateVersion != null && (
                    <span
                      className="sb-tpl-tag"
                      title={`Created from the "${s.templateSlug}" template, version ${s.templateVersion}`}
                    >
                      from {s.templateSlug} v{s.templateVersion}
                      {templateLatest &&
                        templateLatest[s.templateSlug] != null &&
                        templateLatest[s.templateSlug] > s.templateVersion && (
                          <span className="upgrade"> · v{templateLatest[s.templateSlug]} available</span>
                        )}
                    </span>
                  )}
                </div>
                <div className="sb-card-desc">
                  Top {s.cfg.topN} · rank by {s.cfg.sortBy} · {s.cfg.rebalance}
                </div>
                <div className="sb-card-updated">Updated {ago(s.updated)}</div>
              </div>

              <div className="sb-card-spark">
                {s.spark && s.spark.length > 1 ? (
                  <Sparkline
                    data={s.spark}
                    stroke={s.spark[s.spark.length - 1] >= s.spark[0] ? 'var(--c-pos)' : 'var(--c-neg)'}
                  />
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--c-text-dim)', fontStyle: 'italic' }}>not run</span>
                )}
              </div>

              <div className="sb-metric">
                <div className="k">Total ret.</div>
                <div className={`v ${r ? (r.totalReturn >= 0 ? 'pos' : 'neg') : 'dim'}`}>{r ? fmtPct(r.totalReturn) : '—'}</div>
              </div>
              <div className="sb-metric">
                <div className="k">Sharpe</div>
                <div className={`v ${r ? '' : 'dim'}`}>{r ? r.sharpe.toFixed(2) : '—'}</div>
              </div>
              <div className="sb-metric">
                <div className="k">Max DD</div>
                <div className={`v ${r ? 'neg' : 'dim'}`}>{r ? fmtPct(r.maxDD) : '—'}</div>
              </div>
              <div className="sb-metric">
                <div className="k">Trades</div>
                <div className={`v ${r ? '' : 'dim'}`}>{r ? r.trades : '—'}</div>
              </div>

              <div className="sb-card-actions" onClick={(e) => e.stopPropagation()}>
                {/* Own list = owner. Local drafts aren't persisted yet: nothing to share or copy. */}
                {!s.id.startsWith('draft-') && (
                  <button
                    className="sb-icon-btn"
                    title="Duplicate"
                    aria-label={`Duplicate ${s.name}`}
                    onClick={() => onDuplicate(s.id)}
                  >
                    <Icon name="copy" size={15} />
                  </button>
                )}
                {!s.id.startsWith('draft-') && (
                  <button
                    className="sb-icon-btn"
                    title="Share"
                    aria-label={`Share ${s.name}`}
                    onClick={() => setShareTarget({ id: s.id, name: s.name, role: 'owner' })}
                  >
                    <Icon name="share" size={15} />
                  </button>
                )}
                <button className="sb-icon-btn" title="Delete" onClick={() => onDelete(s)}>
                  <Icon name="trash" size={15} />
                </button>
                <button className="sb-icon-btn" title="Edit" onClick={() => onEdit(s)}>
                  <Icon name="edit" size={15} />
                </button>
                <button className="sb-icon-btn primary" title="Backtest" onClick={() => onBacktest(s)}>
                  <Icon name="play" size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {sharedSection}
      {shareModal}
    </>
  );
}
