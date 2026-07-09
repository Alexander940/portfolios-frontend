import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Zap, ZapOff } from 'lucide-react';
import { Button, RatingBadge } from '@/components/ui';
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from '@/lib/format';
import { useTrackerStore } from '../store';
import type { ApiNumber, PositionItem } from '../types';

type SortKey =
  | 'ticker'
  | 'name'
  | 'sector'
  | 'quantity'
  | 'average_cost'
  | 'current_price'
  | 'current_value'
  | 'weight_pct'
  | 'unrealized_pnl'
  | 'unrealized_pnl_pct'
  | 'current_rating'
  | 'entry_date';

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'ticker', label: 'Ticker', numeric: false },
  { key: 'name', label: 'Nombre', numeric: false },
  { key: 'sector', label: 'Sector', numeric: false },
  { key: 'quantity', label: 'Cantidad', numeric: true },
  { key: 'average_cost', label: 'Costo prom.', numeric: true },
  { key: 'current_price', label: 'Precio', numeric: true },
  { key: 'current_value', label: 'Valor', numeric: true },
  { key: 'weight_pct', label: 'Peso', numeric: true },
  { key: 'unrealized_pnl', label: 'P&L', numeric: true },
  { key: 'unrealized_pnl_pct', label: 'P&L %', numeric: true },
  { key: 'current_rating', label: 'Rating', numeric: true },
  { key: 'entry_date', label: 'Entrada', numeric: false },
];

function pnlClass(n: ApiNumber): string {
  const num = Number(n);
  if (!Number.isFinite(num) || num === 0) return 'zero';
  return num > 0 ? 'pos' : 'neg';
}

/** Rating entrada → actual, con flecha y dot de alerta cuando cambió. */
function RatingTransition({ p }: { p: PositionItem }) {
  const upgraded =
    p.rating_changed &&
    p.entry_rating !== null &&
    p.current_rating !== null &&
    p.current_rating > p.entry_rating;
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      data-testid={`rating-${p.ticker}`}
    >
      <RatingBadge rating={p.entry_rating} />
      {p.rating_changed ? (
        upgraded ? (
          <ArrowUp size={12} style={{ color: 'var(--c-pos)' }} aria-label="upgrade" />
        ) : (
          <ArrowDown size={12} style={{ color: 'var(--c-neg)' }} aria-label="downgrade" />
        )
      ) : (
        <span style={{ color: 'var(--c-text-dim)', fontSize: 11 }}>→</span>
      )}
      <RatingBadge rating={p.current_rating} />
      {p.rating_changed && <span className="trk-alert-dot" aria-label="rating cambió" />}
    </span>
  );
}

function LiveTag({ p, intraday }: { p: PositionItem; intraday: boolean }) {
  if (!intraday) return null;
  return p.price_source === 'fmp_intraday' ? (
    <span className="trk-tag live">intradía</span>
  ) : (
    <span className="trk-tag noquote">sin quote</span>
  );
}

export function PositionsSection() {
  const tracker = useTrackerStore((s) => s.tracker);
  const positions = useTrackerStore((s) => s.positions);
  const loading = useTrackerStore((s) => s.positionsLoading);
  const error = useTrackerStore((s) => s.positionsError);
  const intraday = useTrackerStore((s) => s.intraday);
  const quotedAt = useTrackerStore((s) => s.quotedAt);
  const setIntraday = useTrackerStore((s) => s.setIntraday);
  const loadPositions = useTrackerStore((s) => s.loadPositions);

  const [sortKey, setSortKey] = useState<SortKey>('weight_pct');
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey);
    const rows = [...positions];
    rows.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      let cmp: number;
      if (col?.numeric) {
        cmp = (Number(va) || 0) - (Number(vb) || 0);
      } else {
        cmp = String(va ?? '').localeCompare(String(vb ?? ''));
      }
      return sortDesc ? -cmp : cmp;
    });
    return rows;
  }, [positions, sortKey, sortDesc]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  if (!tracker) return null;

  const quotedAtLabel = quotedAt
    ? new Date(quotedAt).toLocaleString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="card" style={{ marginBottom: 16 }} data-testid="positions-section">
      <div className="card-head">
        <div>
          <div className="card-title">Posiciones</div>
          <div className="card-sub">
            {positions.length} posiciones
            {intraday && quotedAtLabel ? ` · quotes de ${quotedAtLabel}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {loading && <Loader2 className="animate-spin" size={16} aria-hidden />}
          {intraday ? (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<ZapOff size={14} />}
              onClick={() => void setIntraday(false)}
            >
              Volver al cierre
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Zap size={14} />}
              onClick={() => void setIntraday(true)}
            >
              Precios intradía
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <div className="trk-error-box" data-testid="positions-error">
          <div>{error}</div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadPositions(intraday)}
          >
            Reintentar
          </Button>
        </div>
      ) : positions.length === 0 && !loading ? (
        <div className="trk-error-box" data-testid="positions-empty">
          Sin posiciones en el libro.
        </div>
      ) : (
        <>
          <div className="trk-pos-table-wrap">
            <table className="tbl" data-testid="positions-table">
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className={`sortable ${c.numeric ? 'num' : ''} ${
                        sortKey === c.key ? 'sorted' : ''
                      }`}
                      onClick={() => handleSort(c.key)}
                    >
                      {c.label}
                      <span className="sort-icon">
                        {sortKey === c.key ? (sortDesc ? '↓' : '↑') : ''}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.ticker} data-testid={`position-row-${p.ticker}`}>
                    <td>{p.ticker}</td>
                    <td className="name-cell">{p.name}</td>
                    <td className="dim">{p.sector ?? '—'}</td>
                    <td className="num">{fmtNumber(p.quantity, 0)}</td>
                    <td className="num">{fmtMoney(p.average_cost)}</td>
                    <td className="num">
                      {fmtMoney(p.current_price)} <LiveTag p={p} intraday={intraday} />
                    </td>
                    <td className="num">{fmtMoney(p.current_value)}</td>
                    <td className="num">{fmtPct(p.weight_pct, 1)}</td>
                    <td className={`num ${pnlClass(p.unrealized_pnl)}`}>
                      {fmtMoney(p.unrealized_pnl)}
                    </td>
                    <td className={`num ${pnlClass(p.unrealized_pnl_pct)}`}>
                      {fmtPct(p.unrealized_pnl_pct, 2, true)}
                    </td>
                    <td className="num">
                      <RatingTransition p={p} />
                    </td>
                    <td className="dim">{fmtDate(p.entry_date)}</td>
                  </tr>
                ))}
                <tr data-testid="positions-cash-row">
                  <td>CASH</td>
                  <td className="name-cell dim">Efectivo</td>
                  <td className="dim">—</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td className="num">{fmtMoney(tracker.cash)}</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td className="dim">—</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="trk-pos-cards" data-testid="positions-cards">
            {sorted.map((p) => (
              <div className="trk-pos-card" key={p.ticker}>
                <div className="trk-pos-card-top">
                  <div>
                    <strong>{p.ticker}</strong>{' '}
                    <LiveTag p={p} intraday={intraday} />
                    <div className="dim" style={{ fontSize: 12 }}>
                      {p.name}
                    </div>
                  </div>
                  <RatingTransition p={p} />
                </div>
                <div className="trk-pos-card-grid">
                  <span className="trk-date-label">Valor</span>
                  <span className="trk-date-label">Peso</span>
                  <span className="trk-date-label">P&L</span>
                  <span>{fmtMoney(p.current_value)}</span>
                  <span>{fmtPct(p.weight_pct, 1)}</span>
                  <span className={pnlClass(p.unrealized_pnl)}>
                    {fmtMoney(p.unrealized_pnl)} ({fmtPct(p.unrealized_pnl_pct, 2, true)})
                  </span>
                </div>
              </div>
            ))}
            <div className="trk-pos-card">
              <div className="trk-pos-card-top">
                <strong>CASH</strong>
                <span>{fmtMoney(tracker.cash)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
