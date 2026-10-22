// Per-rebalance detail (issue #278, fase 4): left rail with every rebalance,
// header (decision → execution, period), 8 metrics, the books Antes / Después
// side by side (a selector under 720 px), the rebalance's fills (FillsTable,
// with the D5 «ocultar ajustes» toggle) and the period's off-calendar exits.
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { formatUsd } from '../mapping';
import { fmtFracPct, fmtFracPctPlain, fmtPp, signCls } from '../rebalances';
import { downloadTradesCsv, getRebalance } from '../service';
import type {
  PositionAfter,
  PositionBefore,
  RebalanceDetailOut,
  RebalanceIndexRow,
  TradeRow,
} from '../types';
import { FillsTable } from './FillsTable';

export interface RebalanceDetailProps {
  jobId: string;
  /** Backend `seq` (0-based) of the selected rebalance. */
  seq: number;
  /** Total rebalances in the run (index `total`). */
  total: number;
  /** The index row for `seq` (dates + metrics already loaded); null if absent. */
  row: RebalanceIndexRow | null;
  /** Every index row (chronological) — feeds the rail without re-fetching. */
  items: RebalanceIndexRow[];
  /** Jump to another rebalance (rail click / «Ir a fecha»). */
  onSelect: (seq: number) => void;
  onBack: () => void;
  /** Undefined at the first / last rebalance (chronological order). */
  onPrev?: () => void;
  onNext?: () => void;
}

/** D4: position tables show 10 rows, then «Ver las N posiciones». */
const BOOK_ROWS = 10;
const RAIL_PAGE = 12;

type RailFilter = 'all' | 'exits' | 'skipped';
const RAIL_FILTERS: { k: RailFilter; label: string }[] = [
  { k: 'all', label: 'Todos' },
  { k: 'exits', label: 'Con salidas' },
  { k: 'skipped', label: 'Saltados' },
];

type DetailState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; data: RebalanceDetailOut };

function useRebalanceDetail(jobId: string, seq: number): DetailState {
  const [state, setState] = useState<DetailState>({ kind: 'loading' });
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    getRebalance(jobId, seq)
      .then((data) => {
        if (!cancelled) setState({ kind: 'done', data });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error', message: 'No se pudo cargar el detalle de este rebalanceo.' });
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, seq]);
  return state;
}

const num = (m: Record<string, unknown>, k: string): number | null => {
  const v = m[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const usd = (v: number | null) => (v == null ? '—' : formatUsd(Math.round(v)));
const fmt2 = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShares = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });
const symLabel = (ticker: string | null | undefined, id: string | null | undefined) =>
  ticker ?? (id ? id.slice(0, 8) : '—');

// ---------------------------------------------------------------- rail

function Rail({
  items,
  seq,
  onSelect,
}: {
  items: RebalanceIndexRow[];
  seq: number;
  onSelect: (seq: number) => void;
}) {
  const [filter, setFilter] = useState<RailFilter>('all');
  const [page, setPage] = useState<number | null>(null); // null = page holding `seq`
  const [prevSeq, setPrevSeq] = useState(seq);
  if (prevSeq !== seq) {
    setPrevSeq(seq);
    setPage(null);
  }
  const filtered = useMemo(
    () =>
      items.filter((r) =>
        filter === 'all' ? true : filter === 'exits' ? (r.n_exits ?? 0) > 0 : r.skipped,
      ),
    [items, filter],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / RAIL_PAGE));
  const selIdx = filtered.findIndex((r) => r.seq === seq);
  const current = Math.min(page ?? (selIdx >= 0 ? Math.floor(selIdx / RAIL_PAGE) : 0), pages - 1);
  const rows = filtered.slice(current * RAIL_PAGE, (current + 1) * RAIL_PAGE);

  return (
    <aside className="sb-rb-rail" data-testid="sb-rb-rail" aria-label="Rebalanceos">
      <div className="sb-rb-rail-filters" role="group" aria-label="Filtrar rebalanceos">
        {RAIL_FILTERS.map((f) => (
          <button
            key={f.k}
            type="button"
            className="chip"
            aria-pressed={filter === f.k}
            onClick={() => {
              setFilter(f.k);
              setPage(0);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <label className="sb-rb-rail-goto">
        Ir a fecha
        <input
          type="date"
          min={items[0]?.decision_date}
          max={items[items.length - 1]?.decision_date}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const hit = items.find((r) => r.decision_date >= v);
            if (hit) onSelect(hit.seq);
          }}
        />
      </label>
      <ul className="sb-rb-rail-list">
        {rows.map((r) => (
          <li key={r.seq}>
            <button
              type="button"
              className={`sb-rb-rail-item ${r.seq === seq ? 'active' : ''} ${r.skipped ? 'skipped' : ''}`}
              data-testid="sb-rb-rail-item"
              aria-current={r.seq === seq ? 'true' : undefined}
              onClick={() => onSelect(r.seq)}
            >
              <span className="d">{r.decision_date}</span>
              <span className="m">
                {r.skipped ? 'saltado' : `${r.n_entries ?? 0} ent. / ${r.n_exits ?? 0} sal.`}
              </span>
              <span className={`r ${signCls(r.period_return)}`}>{fmtFracPct(r.period_return)}</span>
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className="sb-rb-rail-empty">Ninguno con este filtro.</li>}
      </ul>
      {pages > 1 && (
        <div className="sb-rb-rail-pages">
          <button type="button" className="sb-page-btn" disabled={current === 0} onClick={() => setPage(current - 1)}>
            ←
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            type="button"
            className="sb-page-btn"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            →
          </button>
        </div>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------- metrics

function Metrics({ d, tickerOf }: { d: RebalanceDetailOut; tickerOf: (id: string | null | undefined) => string }) {
  const m = d.metrics;
  const ret = num(m, 'period_return');
  const bench = num(m, 'bench_return');
  const excess = num(m, 'excess');
  const mdd = num(m, 'max_drawdown');
  const cashB = num(m, 'cash_before');
  const cashA = num(m, 'cash_after');
  const valB = num(m, 'value_before');
  const valA = num(m, 'value_after');
  const realized = num(m, 'realized_pnl');
  const contrib = (k: string) => {
    const c = m[k] as { symbol_id?: string; contribution?: number } | null | undefined;
    return c && typeof c.contribution === 'number' ? `${tickerOf(c.symbol_id)} ${fmtPp(c.contribution)}` : '—';
  };
  const exits = d.positions_before.filter((p) => p.destino === 'sale').map((p) => symLabel(p.ticker, p.symbol_id));
  const exitList = exits.length > 4 ? `${exits.slice(0, 4).join(', ')}…` : exits.join(', ');
  const cells: { k: string; v: ReactNode; cls?: string; sub?: ReactNode }[] = [
    { k: 'Retorno del período', v: fmtFracPct(ret), cls: signCls(ret), sub: 'cierre a cierre' },
    { k: 'SPY mismo período · exceso', v: fmtFracPct(bench), sub: <span className={signCls(excess)}>exceso {fmtPp(excess)}</span> },
    { k: 'Máxima caída en el período', v: fmtFracPct(mdd), cls: mdd ? 'neg' : '', sub: 'desde el máximo del período' },
    { k: 'Rotación · costos', v: fmtFracPctPlain(num(m, 'turnover_pct')), sub: `costos ${usd(num(m, 'costs'))}` },
    {
      k: 'Movimientos',
      v: (
        <span className="sb-rb-moves">
          <span className="pos">{num(m, 'n_entries') ?? 0} entradas</span> ·{' '}
          <span className="neg">{num(m, 'n_exits') ?? 0} salidas</span> · <span>{num(m, 'n_adjust') ?? 0} ajustes</span>
        </span>
      ),
      sub: `${num(m, 'n_positions_before') ?? d.positions_before.length} → ${
        num(m, 'n_positions_after') ?? d.positions_after.length
      } posiciones · ${num(m, 'n_stops') ?? d.stops.length} stops`,
    },
    {
      k: 'Caja antes → después',
      v: `${usd(cashB)} → ${usd(cashA)}`,
      sub:
        cashB != null && cashA != null && valB && valA
          ? `${fmtFracPctPlain(cashB / valB)} → ${fmtFracPctPlain(cashA / valA)} del libro`
          : undefined,
    },
    {
      k: 'P&L realizado en las salidas',
      v: usd(realized),
      cls: signCls(realized),
      sub: exitList || 'sin salidas',
    },
    { k: 'Mejor · peor contribución', v: contrib('best_contrib'), cls: 'pos', sub: `peor: ${contrib('worst_contrib')}` },
  ];
  return (
    <div className="sb-rb-metrics" data-testid="sb-rb-metrics">
      {cells.map((c) => (
        <div key={c.k} className="sb-rb-card" data-testid="sb-rb-metric">
          <div className="mk">{c.k}</div>
          <div className={`mv ${c.cls ?? ''}`}>{c.v}</div>
          {c.sub && <div className="msub">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- books

function bookSub(n: number, invested: number, cash: number | null, value: number | null): string {
  return `${n} posicion${n === 1 ? '' : 'es'} · ${usd(invested)} invertido · ${usd(cash)} caja · valor ${usd(value)}`;
}

function Book<T>({
  title,
  testId,
  sub,
  rows,
  head,
  render,
}: {
  title: string;
  testId: string;
  sub: string;
  rows: T[];
  head: ReactNode;
  render: (r: T, i: number) => ReactNode;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, BOOK_ROWS);
  return (
    <section className={`card sb-rb-book ${testId}`} data-testid={testId}>
      <div className="card-head">
        <div>
          <div className="card-title">{title}</div>
          <div className="card-sub">{sub}</div>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="sb-trades-empty">Sin posiciones.</div>
      ) : (
        <div className="sb-rb-book-scroll">
          <table className="tbl sb-rb-book-table">
            <thead>{head}</thead>
            <tbody>{shown.map(render)}</tbody>
          </table>
        </div>
      )}
      {rows.length > BOOK_ROWS && (
        <div className="sb-pagination">
          <button type="button" className="sb-page-btn" onClick={() => setAll((v) => !v)}>
            {all ? 'Ver menos' : `Ver las ${rows.length} posiciones`}
          </button>
        </div>
      )}
    </section>
  );
}

const chip = (v: string) => <span className={`sb-rb-chip sb-rb-chip-${v}`}>{v}</span>;

function BeforeBook({ d }: { d: RebalanceDetailOut }) {
  const rows = d.positions_before;
  const invested = rows.reduce((s, p) => s + p.value, 0);
  return (
    <Book<PositionBefore>
      title="Antes · al cierre de la decisión"
      testId="sb-rb-before"
      sub={bookSub(rows.length, invested, num(d.metrics, 'cash_before'), num(d.metrics, 'value_before'))}
      rows={rows}
      head={
        <tr>
          <th>Símbolo</th>
          <th className="num">Acciones</th>
          <th className="num">Cierre</th>
          <th className="num">Valor</th>
          <th className="num">Peso</th>
          <th className="num">Días</th>
          <th className="num">P&amp;L no real.</th>
          <th>Destino</th>
        </tr>
      }
      render={(p) => (
        <tr key={p.symbol_id} className={p.destino === 'sale' ? 'sb-rb-row-sale' : ''}>
          <td style={{ fontWeight: 600 }}>{symLabel(p.ticker, p.symbol_id)}</td>
          <td className="num">{fmtShares(p.shares)}</td>
          <td className="num">{p.price == null ? '—' : `$${fmt2(p.price)}`}</td>
          <td className="num">{usd(p.value)}</td>
          <td className="num">{fmtFracPctPlain(p.weight)}</td>
          <td className="num dim">{p.days_held}</td>
          <td className={`num ${signCls(p.unrealized_pnl_pct)}`}>{fmtFracPct(p.unrealized_pnl_pct)}</td>
          <td>{chip(p.destino)}</td>
        </tr>
      )}
    />
  );
}

function AfterBook({ d }: { d: RebalanceDetailOut }) {
  const rows = d.positions_after;
  const invested = rows.reduce((s, p) => s + p.value, 0);
  return (
    <Book<PositionAfter>
      title="Después · tras la apertura de ejecución"
      testId="sb-rb-after"
      sub={bookSub(rows.length, invested, num(d.metrics, 'cash_after'), num(d.metrics, 'value_after'))}
      rows={rows}
      head={
        <tr>
          <th>Símbolo</th>
          <th className="num">Acciones</th>
          <th className="num">Fill</th>
          <th className="num">Valor</th>
          <th className="num">Peso · obj.</th>
          <th>Cambio</th>
          <th className="num">Ret. período</th>
          <th className="num">Contrib.</th>
        </tr>
      }
      render={(p) => (
        <tr key={p.symbol_id} className={p.cambio === 'nueva' ? 'sb-rb-row-nueva' : ''}>
          <td style={{ fontWeight: 600 }}>{symLabel(p.ticker, p.symbol_id)}</td>
          <td className="num">{fmtShares(p.shares)}</td>
          <td className="num">{p.price == null ? '—' : `$${fmt2(p.price)}`}</td>
          <td className="num">{usd(p.value)}</td>
          <td className="num">
            {fmtFracPctPlain(p.weight)} <span className="dim">· {fmtFracPctPlain(p.target_weight)}</span>
          </td>
          <td>{chip(p.cambio)}</td>
          <td className={`num ${signCls(p.period_return)}`}>{fmtFracPct(p.period_return)}</td>
          <td className={`num ${signCls(p.contribution)}`}>{fmtPp(p.contribution)}</td>
        </tr>
      )}
    />
  );
}

// ---------------------------------------------------------------- stops

function Stops({ stops }: { stops: TradeRow[] }) {
  return (
    <div className="sb-rb-stops" data-testid="sb-rb-stops">
      <div className="card-title">Salidas fuera de calendario</div>
      {stops.length === 0 ? (
        <div className="card-sub">Ninguna en el período.</div>
      ) : (
        <ul>
          {stops.map((t, i) => (
            <li key={`${t.symbol_id}-${t.date}-${i}`}>
              <b>{symLabel(t.ticker, t.symbol_id)}</b> {t.reason && <span className="sb-chip neg">{t.reason}</span>}{' '}
              <span className="dim">
                {t.date} · apertura ${fmt2(t.price)} · {fmtShares(t.shares)} acciones · {usd(t.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- detail

export function RebalanceDetail({
  jobId,
  seq,
  total,
  row,
  items,
  onSelect,
  onBack,
  onPrev,
  onNext,
}: RebalanceDetailProps) {
  const state = useRebalanceDetail(jobId, seq);
  const [side, setSide] = useState<'before' | 'after'>('before');
  const [csvError, setCsvError] = useState<string | null>(null);
  const d = state.kind === 'done' ? state.data : null;

  const tickers = useMemo(() => {
    const out = new Map<string, string>();
    if (!d) return out;
    for (const p of [...d.positions_before, ...d.positions_after]) if (p.ticker) out.set(p.symbol_id, p.ticker);
    for (const t of [...d.trades, ...d.stops]) if (t.symbol_id && t.ticker) out.set(t.symbol_id, t.ticker);
    return out;
  }, [d]);
  const tickerOf = (id: string | null | undefined) => (id ? (tickers.get(id) ?? id.slice(0, 8)) : '—');

  const held = useMemo(
    () => new Map<string, number>((d?.positions_before ?? []).map((p) => [p.symbol_id, p.shares])),
    [d],
  );
  // Book for the «small» test: the value at the decision close, as the
  // backend's classify_fill does (n_adjust uses the same book).
  const curve = useMemo(() => {
    if (!d) return [];
    const book = num(d.metrics, 'value_before') ?? num(d.metrics, 'value_after');
    return book == null ? [] : [{ date: d.fill_date, totalValue: book }];
  }, [d]);

  const decision = d?.decision_date ?? row?.decision_date;
  const fillDate = d?.fill_date ?? row?.fill_date;
  const periodEnd = d?.period_end ?? row?.period_end;
  const skipped = d?.skipped ?? row?.skipped ?? false;
  const next = items.find((r) => r.seq === seq + 1);

  return (
    <div className="sb-rb-detail" data-testid="sb-rb-detail">
      <div className="sb-rb-detail-layout">
        <Rail items={items} seq={seq} onSelect={onSelect} />

        <div className="sb-rb-main">
          <div className="sb-rb-detail-nav">
            <button type="button" className="sb-back" onClick={onBack}>
              ← Volver al índice
            </button>
            <div style={{ flex: 1 }} />
            <button type="button" className="sb-page-btn" disabled={!onPrev} onClick={onPrev}>
              ← Anterior
            </button>
            <button type="button" className="sb-page-btn" disabled={!onNext} onClick={onNext}>
              Siguiente →
            </button>
          </div>

          <div className="sb-rb-detail-head">
            <div className="card-title" data-testid="sb-rb-detail-title">
              Rebalanceo {seq + 1} de {total}
            </div>
            {decision && (
              <div className="card-sub" data-testid="sb-rb-detail-dates">
                Decidido al cierre del {decision} ·{' '}
                {skipped ? 'saltado por banda de drift (sin fills)' : `ejecutado en la apertura del ${fillDate}`}
              </div>
            )}
            {decision && periodEnd && (
              <div className="card-sub">
                Período: {decision} → {periodEnd} al cierre ·{' '}
                {next ? `siguiente rebalanceo ${next.decision_date}` : 'último rebalanceo de la ventana'}
              </div>
            )}
          </div>

          {state.kind === 'loading' && (
            <div className="sb-trades-empty" data-testid="sb-rb-detail-loading">
              Cargando el detalle…
            </div>
          )}
          {state.kind === 'error' && (
            <div className="sb-error" data-testid="sb-rb-detail-error">
              <h3>No se pudo cargar</h3>
              <p>{state.message}</p>
            </div>
          )}

          {d && (
            <>
              <Metrics d={d} tickerOf={tickerOf} />

              <div className="sb-rb-side-toggle" data-testid="sb-rb-side-toggle" role="group" aria-label="Libro">
                <button type="button" className="chip" aria-pressed={side === 'before'} onClick={() => setSide('before')}>
                  Antes · {d.positions_before.length}
                </button>
                <button type="button" className="chip" aria-pressed={side === 'after'} onClick={() => setSide('after')}>
                  Después · {d.positions_after.length}
                </button>
              </div>
              <div className="sb-rb-books" data-side={side}>
                <BeforeBook d={d} />
                <AfterBook d={d} />
              </div>

              <div className="card sb-rb-fills">
                <div className="card-head">
                  <div>
                    <div className="card-title">Fills de este rebalanceo</div>
                    <div className="card-sub">Ejecutados en la apertura del {d.fill_date}, netos de costos.</div>
                  </div>
                </div>
                <FillsTable fills={d.trades} curve={curve} initialHeld={held} />
                <div className="sb-rb-fills-foot">
                  <button
                    type="button"
                    className="sb-link"
                    onClick={() => {
                      setCsvError(null);
                      downloadTradesCsv(jobId).catch(() => setCsvError('No se pudo descargar el CSV.'));
                    }}
                  >
                    Exportar trade log completo (CSV)
                  </button>
                  {csvError && <span className="neg"> {csvError}</span>}
                </div>
              </div>

              <Stops stops={d.stops} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
