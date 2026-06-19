import { Icon } from '../icons';
import type { SavedStrategy } from '../types';
import { Sparkline } from './formBits';

const fmtPct = (v: number, d = 1) => `${v > 0 ? '+' : ''}${v.toFixed(d)}%`;

interface Props {
  strategies: SavedStrategy[];
  onNew: () => void;
  onOpen: (s: SavedStrategy) => void;
  onEdit: (s: SavedStrategy) => void;
  onBacktest: (s: SavedStrategy) => void;
  onDelete: (s: SavedStrategy) => void;
}

function ago(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function ListView({ strategies, onNew, onOpen, onEdit, onBacktest, onDelete }: Props) {
  if (strategies.length === 0) {
    return (
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
    );
  }

  return (
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
  );
}
