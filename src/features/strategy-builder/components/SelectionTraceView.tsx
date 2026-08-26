// "Selection" tab (issue #174): how the last rebalance's book was reached —
// Universe → Selection rules → Ranking → Weighting → Execution. Stage rail as
// the header (count + drop from the previous stage; a stage with no rules
// greys out instead of disappearing — approved design decision), table below
// filterable by stage, paginated client-side (the universe stage alone can
// carry ~1,185 rows).
import { useMemo, useState } from 'react';

import { SORT_FIELDS } from '../mapping';
import {
  detectRankingTies,
  exitStageLabel,
  reasonLabel,
  rowsAtStage,
  STAGE_LABELS,
  stageDropLabel,
} from '../selectionTrace';
import type { SelectionRow, SelectionStageKey } from '../types';
import { useSelectionTrace } from '../hooks/useSelectionTrace';
import { Icon } from '../icons';

/** 1,185 candidates at the universe stage need paging, not one giant DOM
 *  table — 24 pages at this size, tested against a synthetic 1,185-row fixture
 *  in tests/checks/funnel-view.ts. Same client-pagination shape as FillsTable,
 *  just a larger page (that table tops out at a few dozen fills; this one at
 *  a four-digit universe). */
export const SELECTION_PAGE_SIZE = 50;

/** Table opens on Ranking — the approved default (design.md decision 4): the
 *  information that explains a decision starts at Ranking, not the raw
 *  universe. */
const DEFAULT_STAGE: SelectionStageKey = 'ranking';

function fmtScore(v: number | null): string {
  if (v == null) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function sortKeyLabel(sortBy: string): string {
  return SORT_FIELDS.find((f) => f.k === sortBy)?.label ?? sortBy;
}

/** Rank ascending, unranked (never reached ranking) last. */
function byRank(a: SelectionRow, b: SelectionRow): number {
  if (a.rank == null && b.rank == null) return 0;
  if (a.rank == null) return 1;
  if (b.rank == null) return -1;
  return a.rank - b.rank;
}

export function SelectionTraceView({ jobId }: { jobId: string | null }) {
  const { data, loading, error } = useSelectionTrace(jobId, true);
  const [stage, setStage] = useState<SelectionStageKey>(DEFAULT_STAGE);
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(
    () => (data ? [...rowsAtStage(data.rows, stage)].sort(byRank) : []),
    [data, stage],
  );
  const ties = useMemo(
    () => (data ? detectRankingTies(data.rows) : { tied: false, topScore: null, tiedCount: 0 }),
    [data],
  );

  const pages = Math.max(1, Math.ceil(sortedRows.length / SELECTION_PAGE_SIZE));
  const pageRows = sortedRows.slice(page * SELECTION_PAGE_SIZE, page * SELECTION_PAGE_SIZE + SELECTION_PAGE_SIZE);

  function selectStage(key: SelectionStageKey) {
    setStage(key);
    setPage(0);
  }

  if (!jobId) {
    return <div className="sb-trades-empty">No selection data for this result.</div>;
  }

  if (loading) {
    return (
      <div className="sb-trades-empty" data-testid="sb-selection-loading">
        Loading the selection funnel…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="sb-error" data-testid="sb-selection-error">
        <div className="sb-error-mark">
          <Icon name="warn" size={20} />
        </div>
        <h3>Could not load the funnel</h3>
        <p>{error ?? 'Unexpected error loading the selection trace.'}</p>
      </div>
    );
  }

  const sortLabel = sortKeyLabel(data.sort_by);

  return (
    <div className="sb-selection" data-testid="sb-selection-trace">
      {data.truncated && (
        <div className="sb-lowconf-banner" data-testid="sb-selection-truncated">
          <span className="ic">
            <Icon name="warn" size={18} />
          </span>
          <span>
            <b>Truncated result.</b> This trace has <b>{data.total.toLocaleString()}</b> candidates
            in total — showing the first <b>{data.rows.length.toLocaleString()}</b> (the endpoint
            caps at 5,000 rows).
          </span>
        </div>
      )}

      {ties.tied && (
        <div className="sb-lowconf-banner" data-testid="sb-selection-ties">
          <span className="ic">
            <Icon name="warn" size={18} />
          </span>
          <span>
            <b>Massive tie at the top of the ranking.</b> <b>{ties.tiedCount}</b> candidates share
            the best <b>{sortLabel}</b> value (<b>{fmtScore(ties.topScore)}</b>) — with a
            low-cardinality ranking key, order within the tie is arbitrary. Rank shown below
            reflects the engine's tie-break, not a meaningful distinction.
          </span>
        </div>
      )}

      <div className="sb-stage-rail" data-testid="sb-stage-rail" role="tablist" aria-label="Selection funnel stages">
        {data.stages.map((s, i) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={s.key === stage}
            className={`sb-stage-cell ${s.key === stage ? 'active' : ''} ${!s.applies ? 'disabled' : ''}`}
            onClick={() => selectStage(s.key)}
            data-testid={`sb-stage-${s.key}`}
          >
            <div className="mk">
              {i + 1}. {STAGE_LABELS[s.key]}
            </div>
            <div className="mv">{s.count.toLocaleString()}</div>
            <div className="msub">{stageDropLabel(s)}</div>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-head sb-trades-head">
          <div>
            <div className="card-title">{STAGE_LABELS[stage]}</div>
            <div className="card-sub">
              {stage === 'universe' ? (
                <>
                  Every candidate that passed the universe filter.{' '}
                  <button type="button" className="sb-link" onClick={() => selectStage(DEFAULT_STAGE)}>
                    ← back to {STAGE_LABELS[DEFAULT_STAGE]}
                  </button>
                </>
              ) : (
                <>
                  {sortedRows.length.toLocaleString()} candidate{sortedRows.length === 1 ? '' : 's'} reached this
                  stage.{' '}
                  <button type="button" className="sb-link" onClick={() => selectStage('universe')}>
                    → see all {data.rows.length.toLocaleString()} in the universe
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {sortedRows.length === 0 ? (
          <div className="sb-trades-empty">No candidates at this stage.</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Name</th>
                    <th>Sector</th>
                    <th className="num">{sortLabel}</th>
                    <th className="num">Rank</th>
                    <th className="num">Weight</th>
                    <th>Status</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.symbol_id}>
                      <td style={{ fontWeight: 600 }}>{r.ticker}</td>
                      <td className="name-cell dim">{r.name}</td>
                      <td className="dim">{r.sector ?? '—'}</td>
                      <td className="num">{fmtScore(r.score)}</td>
                      <td className="num">{r.rank ?? '—'}</td>
                      <td className="num">{r.weight_pct != null ? `${r.weight_pct.toFixed(2)}%` : '—'}</td>
                      <td className={r.exit_stage == null ? 'pos' : 'dim'}>{exitStageLabel(r.exit_stage)}</td>
                      <td className="dim">{reasonLabel(r.reason)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sb-pagination">
              <button className="sb-page-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                ← Prev
              </button>
              <button
                className="sb-page-btn"
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              >
                Next →
              </button>
              <div style={{ flex: 1 }} />
              <span className="sb-page-info">
                {page * SELECTION_PAGE_SIZE + 1}–{Math.min((page + 1) * SELECTION_PAGE_SIZE, sortedRows.length)} of{' '}
                {sortedRows.length.toLocaleString()}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="card-sub">
        As of {data.as_of} · {data.candidates_count.toLocaleString()} candidates considered before the universe filter.
      </div>
    </div>
  );
}
