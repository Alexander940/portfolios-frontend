// «Rebalanceos» tab (issue #278, fase 3): one row per rebalance — the decision
// at the close and its execution at the next open — with the period's return
// vs SPY, summary cards, a bar strip and CSV exports. A row's date opens the
// per-rebalance detail (RebalanceDetail, completed in fase 4). A result saved
// before the rebalances table answers 409 → «Volver a correr» (D2).
import { useEffect, useMemo, useState } from 'react';

import { isApiError } from '@/lib/apiErrors';

import { Icon } from '../icons';
import { formatUsd } from '../mapping';
import {
  barScale,
  beatingCounts,
  cadenceLabelEs,
  fmtFracPct,
  fmtFracPctPlain,
  REBALANCE_SORT_OPTIONS,
  REBALANCES_PAGE_SIZE,
  signCls,
  sortRebalances,
  type RebalanceSortKey,
} from '../rebalances';
import { downloadRebalancesCsv, downloadTradesCsv, getRebalances } from '../service';
import type { RebalanceIndexRow, RebalancesIndexResponse } from '../types';
import { RebalanceDetail } from './RebalanceDetail';

interface Props {
  jobId: string | null;
  /** Spec cadence (`weekly`, `monthly`…) for the header; omitted → only N. */
  cadence?: string | null;
  /** Re-run the active strategy with `force: true` (D2). */
  onRerun?: () => void;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'stale'; message: string }
  | { kind: 'done'; data: RebalancesIndexResponse };

const STALE_FALLBACK = 'Vuelve a correr el backtest para ver el detalle por rebalanceo.';

function useRebalances(jobId: string | null): LoadState {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    getRebalances(jobId)
      .then((data) => {
        if (!cancelled) setState({ kind: 'done', data });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (isApiError(e) && e.status === 409) {
          setState({ kind: 'stale', message: e.detail || e.message || STALE_FALLBACK });
        } else {
          setState({ kind: 'error', message: 'No se pudo cargar el índice de rebalanceos.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);
  return state;
}

const dash = (v: number | null | undefined) => (v == null ? '—' : String(v));

function SummaryCards({ data }: { data: RebalancesIndexResponse }) {
  const s = data.summary;
  const beat = beatingCounts(data.items);
  const cards: { id: string; k: string; v: string; cls?: string; sub?: string }[] = [
    {
      id: 'executed',
      k: 'Ejecutados · saltados',
      v: `${s.n_executed} · ${s.n_skipped}`,
      sub: 'saltados por banda de drift',
    },
    {
      id: 'beating',
      k: 'Períodos que baten al SPY',
      v: fmtFracPctPlain(s.pct_periods_beating_bench),
      sub: beat.n > 0 ? `${beat.k} de ${beat.n}` : undefined,
    },
    {
      id: 'turnover',
      k: 'Rotación mediana por rebalanceo',
      v: fmtFracPctPlain(s.median_turnover_pct),
      sub: 'sólo ejecutados',
    },
    { id: 'costs', k: 'Costos acumulados', v: formatUsd(Math.round(s.total_costs)), sub: 'comisión + slippage' },
    {
      id: 'best',
      k: 'Mejor período',
      v: s.best ? fmtFracPct(s.best.period_return) : '—',
      cls: s.best ? 'pos' : '',
      sub: s.best ? periodDates(data.items, s.best.seq, s.best.decision_date) : undefined,
    },
    {
      id: 'worst',
      k: 'Peor período',
      v: s.worst ? fmtFracPct(s.worst.period_return) : '—',
      cls: s.worst ? 'neg' : '',
      sub: s.worst ? periodDates(data.items, s.worst.seq, s.worst.decision_date) : undefined,
    },
  ];
  return (
    <div className="sb-rb-cards" data-testid="sb-rb-summary">
      {cards.map((c) => (
        <div key={c.id} className="sb-rb-card" data-testid={`sb-rb-card-${c.id}`}>
          <div className="mk">{c.k}</div>
          <div className={`mv ${c.cls ?? ''}`}>{c.v}</div>
          {c.sub && <div className="msub">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function periodDates(items: RebalanceIndexRow[], seq: number, decision: string): string {
  const row = items.find((r) => r.seq === seq);
  return row ? `${row.decision_date} → ${row.period_end}` : decision;
}

function BarStrip({ rows, onSelect }: { rows: RebalanceIndexRow[]; onSelect: (seq: number) => void }) {
  const max = barScale(rows);
  const h = (v: number | null) => (max > 0 && v != null ? (Math.abs(v) / max) * 50 : 0);
  return (
    <div className="sb-rb-strip" data-testid="sb-rb-strip" aria-label="Retorno por período">
      <div className="sb-rb-strip-base" />
      {rows.map((r) => {
        const ret = r.period_return;
        const up = (ret ?? 0) >= 0;
        const ex = r.excess;
        return (
          <button
            key={r.seq}
            type="button"
            className={`sb-rb-bar ${r.skipped ? 'skipped' : ''}`}
            data-testid="sb-rb-bar"
            aria-label={`Rebalanceo ${r.decision_date}: retorno ${fmtFracPct(ret)}`}
            title={`${r.decision_date} · retorno ${fmtFracPct(ret)} · exceso ${fmtFracPct(ex)}`}
            onClick={() => onSelect(r.seq)}
          >
            <span
              className={`sb-rb-bar-fill ${up ? 'pos' : 'neg'}`}
              style={up ? { bottom: '50%', height: `${h(ret)}%` } : { top: '50%', height: `${h(ret)}%` }}
            />
            {ex != null && (
              <span
                className="sb-rb-bar-dot"
                style={{ top: `calc(${50 - (ex >= 0 ? h(ex) : -h(ex))}% - 3px)` }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function IndexTable({
  rows,
  onSelect,
}: {
  rows: RebalanceIndexRow[];
  onSelect: (seq: number) => void;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl sb-rb-table" data-testid="sb-rb-table">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Decisión</th>
            <th>Ejecución</th>
            <th className="num">Posiciones</th>
            <th className="num">Entradas</th>
            <th className="num">Salidas</th>
            <th className="num">Ajustes</th>
            <th className="num">Stops</th>
            <th className="num">Rotación</th>
            <th className="num">Costos</th>
            <th className="num">Ret. período</th>
            <th className="num">SPY</th>
            <th className="num">Exceso</th>
            <th className="num">Caja desp.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.seq}
              className={r.skipped ? 'sb-rb-skipped' : ''}
              data-testid="sb-rb-row"
              data-seq={r.seq}
            >
              <td className="num dim">{r.seq + 1}</td>
              <td>
                <button
                  type="button"
                  className="sb-link sb-rb-date"
                  data-testid="sb-rb-date"
                  onClick={() => onSelect(r.seq)}
                >
                  {r.decision_date}
                </button>
                {r.skipped && <span className="sb-rb-skip-tag"> · saltado</span>}
              </td>
              <td className="dim" data-testid="sb-rb-fill-date">
                {r.skipped ? '—' : r.fill_date}
              </td>
              <td className="num">
                {dash(r.n_positions_before)} → {dash(r.n_positions_after)}
              </td>
              <td className="num">{dash(r.n_entries)}</td>
              <td className="num">{dash(r.n_exits)}</td>
              <td className="num">{dash(r.n_adjust)}</td>
              <td className="num">{dash(r.n_stops)}</td>
              <td className="num">{fmtFracPctPlain(r.turnover_pct)}</td>
              <td className="num dim">{r.costs == null ? '—' : formatUsd(Math.round(r.costs))}</td>
              <td className={`num ${signCls(r.period_return)}`}>{fmtFracPct(r.period_return)}</td>
              <td className="num dim">{fmtFracPct(r.bench_return)}</td>
              <td className={`num ${signCls(r.excess)}`}>{fmtFracPct(r.excess)}</td>
              <td className="num dim">{r.cash_after == null ? '—' : formatUsd(Math.round(r.cash_after))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RebalancesView({ jobId, cadence, onRerun }: Props) {
  const state = useRebalances(jobId);
  const [sortKey, setSortKey] = useState<RebalanceSortKey>('decision_date');
  const [page, setPage] = useState(0);
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [exporting, setExporting] = useState<'rebalances' | 'trades' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const items = useMemo(() => (state.kind === 'done' ? state.data.items : []), [state]);
  const sorted = useMemo(() => sortRebalances(items, sortKey), [items, sortKey]);
  const chronological = useMemo(() => sortRebalances(items, 'decision_date'), [items]);

  if (!jobId) {
    return <div className="sb-trades-empty">No hay datos de rebalanceos para este resultado.</div>;
  }
  if (state.kind === 'loading') {
    return (
      <div className="sb-trades-empty" data-testid="sb-rb-loading">
        Cargando el índice de rebalanceos…
      </div>
    );
  }
  if (state.kind === 'stale') {
    return (
      <div className="sb-error sb-rb-stale" data-testid="sb-rb-stale">
        <div className="sb-error-mark">
          <Icon name="refresh" size={20} />
        </div>
        <h3>Este resultado es anterior al detalle por rebalanceo</h3>
        <p>{state.message}</p>
        {onRerun && (
          <button type="button" className="sb-btn accent" style={{ width: 'auto' }} onClick={onRerun}>
            <Icon name="refresh" size={14} /> Volver a correr
          </button>
        )}
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="sb-error" data-testid="sb-rb-error">
        <div className="sb-error-mark">
          <Icon name="warn" size={20} />
        </div>
        <h3>No se pudo cargar</h3>
        <p>{state.message}</p>
      </div>
    );
  }

  const data = state.data;
  const total = data.total || data.items.length;

  if (selectedSeq != null) {
    const idx = chronological.findIndex((r) => r.seq === selectedSeq);
    const row = idx >= 0 ? chronological[idx] : null;
    return (
      <RebalanceDetail
        jobId={jobId}
        seq={selectedSeq}
        total={total}
        row={row}
        onBack={() => setSelectedSeq(null)}
        onPrev={idx > 0 ? () => setSelectedSeq(chronological[idx - 1].seq) : undefined}
        onNext={
          idx >= 0 && idx < chronological.length - 1
            ? () => setSelectedSeq(chronological[idx + 1].seq)
            : undefined
        }
      />
    );
  }

  const pages = Math.max(1, Math.ceil(sorted.length / REBALANCES_PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const pageRows = sorted.slice(safePage * REBALANCES_PAGE_SIZE, (safePage + 1) * REBALANCES_PAGE_SIZE);
  const cadenceEs = cadenceLabelEs(cadence);

  const exportCsv = async (which: 'rebalances' | 'trades') => {
    setExporting(which);
    setExportError(null);
    try {
      await (which === 'rebalances' ? downloadRebalancesCsv(jobId) : downloadTradesCsv(jobId));
    } catch {
      setExportError('No se pudo descargar el CSV.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="sb-rb" data-testid="sb-rb-index">
      <div className="sb-rb-head">
        <div>
          <div className="card-title">
            {total} rebalanceo{total === 1 ? '' : 's'}
            {cadenceEs ? ` · ${cadenceEs}` : ''}
          </div>
          <div className="card-sub">
            Cada fila es una decisión al cierre y su ejecución en la apertura siguiente. El período de cada una
            va hasta la siguiente decisión.
          </div>
        </div>
        <div className="sb-rb-actions">
          <label className="sb-rb-sort">
            Ordenar por
            <select
              data-testid="sb-rb-sort"
              value={sortKey}
              onChange={(e) => {
                setSortKey(e.target.value as RebalanceSortKey);
                setPage(0);
              }}
            >
              {REBALANCE_SORT_OPTIONS.map((o) => (
                <option key={o.k} value={o.k}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="sb-btn"
            style={{ width: 'auto' }}
            disabled={exporting !== null}
            onClick={() => void exportCsv('rebalances')}
          >
            Exportar CSV (rebalanceos)
          </button>
          <button
            type="button"
            className="sb-btn"
            style={{ width: 'auto' }}
            disabled={exporting !== null}
            onClick={() => void exportCsv('trades')}
          >
            Exportar CSV (fills)
          </button>
        </div>
      </div>
      {exportError && <div className="sb-rb-export-error">{exportError}</div>}

      <SummaryCards data={data} />

      {data.items.length === 0 ? (
        <div className="sb-trades-empty">Este backtest no tiene rebalanceos.</div>
      ) : (
        <>
          <BarStrip rows={chronological} onSelect={setSelectedSeq} />
          <div className="card">
            <IndexTable rows={pageRows} onSelect={setSelectedSeq} />
            <div className="sb-pagination">
              <button className="sb-page-btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                ← Anterior
              </button>
              <button
                className="sb-page-btn"
                disabled={safePage >= pages - 1}
                onClick={() => setPage(safePage + 1)}
              >
                Siguiente →
              </button>
              <div style={{ flex: 1 }} />
              <span className="sb-page-info" data-testid="sb-rb-page-info">
                {safePage * REBALANCES_PAGE_SIZE + 1}–{Math.min((safePage + 1) * REBALANCES_PAGE_SIZE, sorted.length)} de{' '}
                {sorted.length}
              </span>
            </div>
          </div>
        </>
      )}

      <div className="card-sub sb-rb-foot">
        Filas en gris: rebalanceo saltado por banda de drift (sin fills). Stops cuenta las salidas fuera de
        calendario dentro del período.
      </div>
    </div>
  );
}
