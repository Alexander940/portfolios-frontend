// Fills table (#280 Motivo, #281 order, #282 Tipo + «ocultar ajustes»). Since
// #278 fase 4 it lives in the per-rebalance detail, fed with that rebalance's
// fills; it used to be the overview's flat trade log.
import { useMemo, useState } from 'react';

import { classifyFills, sortFills } from '../mapping';
import type { TradeRow } from '../types';

const fmtNum = (v: number, d = 2) =>
  v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

interface Props {
  fills: TradeRow[];
  /** Book value for the «small» test (D5: < 0.5 % of the book). */
  curve: { date: string; totalValue: number }[];
  /** Book before the first fill (`symbol_id` → shares) so a fill on a name
   *  already held is an ajuste / salida, not an entrada. */
  initialHeld?: ReadonlyMap<string, number>;
  /** Rows shown before «Ver los N fills» (D4: 10). */
  initialRows?: number;
}

export function FillsTable({ fills, curve, initialHeld, initialRows = 10 }: Props) {
  // #282: hide the sub-0.5 %-of-book adjustments (entries/exits always show).
  const [hideSmall, setHideSmall] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const annotated = useMemo(() => {
    const sorted = sortFills(fills);
    const kinds = classifyFills(sorted, curve, initialHeld);
    return sorted.map((t, i) => ({ t, ...kinds[i] }));
  }, [fills, curve, initialHeld]);
  const visible = useMemo(
    () => (hideSmall ? annotated.filter((r) => !(r.kind === 'ajuste' && r.small)) : annotated),
    [annotated, hideSmall],
  );
  const rows = showAll ? visible : visible.slice(0, initialRows);

  if (fills.length === 0) {
    return <div className="sb-trades-empty">Este rebalanceo no tuvo fills.</div>;
  }

  return (
    <>
      <label className="sb-fills-filter" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 8px' }}>
        <input type="checkbox" checked={hideSmall} onChange={(e) => setHideSmall(e.target.checked)} />
        Ocultar ajustes &lt; 0,5 % del libro
      </label>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl" data-testid="sb-fills-table">
          <thead>
            <tr>
              <th>Símbolo</th>
              <th>Fecha</th>
              <th>Lado</th>
              <th>Tipo</th>
              <th className="num">Acciones</th>
              <th className="num">Precio</th>
              <th className="num">Valor</th>
              <th className="num">Costo</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, kind }, i) => (
              <tr key={`${t.symbol_id}-${t.date}-${t.side}-${i}`}>
                <td style={{ fontWeight: 600 }}>{t.ticker ?? '—'}</td>
                <td className="dim">{t.date}</td>
                <td className={t.side === 'buy' ? 'pos' : 'neg'}>{t.side}</td>
                <td className="dim" data-testid="sb-fill-kind">
                  {kind}
                </td>
                <td className="num">{fmtNum(t.shares)}</td>
                <td className="num">${fmtNum(t.price)}</td>
                <td className="num">${fmtNum(t.value)}</td>
                <td className="num dim">${fmtNum(t.cost)}</td>
                <td data-testid="sb-fill-reason">
                  {t.reason ? <span className="sb-chip neg">{t.reason}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sb-pagination">
        {visible.length > initialRows && (
          <button className="sb-page-btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Ver menos' : `Ver los ${visible.length} fills`}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <span className="sb-page-info">
          {visible.length === 0 ? 0 : 1}–{rows.length} de {visible.length} fills
        </span>
      </div>
    </>
  );
}
