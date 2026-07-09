import { CalendarClock } from 'lucide-react';
import { fmtDate, fmtMoney, fmtPct } from '@/lib/format';
import { useTrackerStore } from '../store';
import type { ApiNumber } from '../types';
import { TrackerStatusBadge } from './TrackerStatusBadge';

function deltaClass(n: ApiNumber | undefined): string {
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num) || num === 0) return '';
  return num > 0 ? 'pos' : 'neg';
}

function PnlDelta({ value, pct }: { value?: ApiNumber; pct?: ApiNumber }) {
  if (value === undefined && pct === undefined) return null;
  return (
    <div className={`stat-delta ${deltaClass(value ?? pct)}`}>
      {fmtMoney(value)} ({fmtPct(pct, 2, true)})
    </div>
  );
}

export function TrackerHeader() {
  const tracker = useTrackerStore((s) => s.tracker);
  const dataAsOf = useTrackerStore((s) => s.dataAsOf);
  if (!tracker) return null;

  return (
    <header data-testid="tracker-header">
      <div className="page-header">
        <div>
          <div className="trk-head-row">
            <h1 className="page-title">Strategy Tracker</h1>
            <TrackerStatusBadge status={tracker.status} />
            {dataAsOf && (
              <span className="trk-asof" data-testid="tracker-asof">
                <CalendarClock size={12} aria-hidden />
                Datos al cierre de {fmtDate(dataAsOf)}
              </span>
            )}
          </div>
          <p className="page-sub">
            Portafolio en vivo de la estrategia
            {tracker.version !== undefined ? ` · versión ${tracker.version}` : ''}
            {tracker.holdings_count !== undefined
              ? ` · ${tracker.holdings_count} posiciones`
              : ''}
          </p>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card" data-testid="stat-total-value">
          <div className="stat-label">Valor total</div>
          <div className={`stat-value ${tracker.total_value === undefined ? 'placeholder' : ''}`}>
            {fmtMoney(tracker.total_value)}
          </div>
          <PnlDelta value={tracker.pnl_day} pct={tracker.pnl_day_pct} />
        </div>
        <div className="stat-card" data-testid="stat-cash">
          <div className="stat-label">Cash</div>
          <div className={`stat-value ${tracker.cash === undefined ? 'placeholder' : ''}`}>
            {fmtMoney(tracker.cash)}
          </div>
        </div>
        <div className="stat-card" data-testid="stat-pnl-total">
          <div className="stat-label">P&L total</div>
          <div
            className={`stat-value ${tracker.pnl_total === undefined ? 'placeholder' : ''}`}
            style={
              deltaClass(tracker.pnl_total)
                ? {
                    color: `var(--c-${deltaClass(tracker.pnl_total)})`,
                  }
                : undefined
            }
          >
            {fmtMoney(tracker.pnl_total)}
          </div>
          <PnlDelta value={undefined} pct={tracker.pnl_total_pct} />
        </div>
        <div className="stat-card" data-testid="stat-initial-cash">
          <div className="stat-label">Capital inicial</div>
          <div className="stat-value">{fmtMoney(tracker.initial_cash)}</div>
          <div className="stat-delta">desde {fmtDate(tracker.started_at)}</div>
        </div>
      </div>

      <div className="trk-dates">
        <div className="trk-date-card" data-testid="date-last-rebalance">
          <div className="trk-date-label">Último rebalanceo</div>
          <div className="trk-date-value">{fmtDate(tracker.last_rebalance_date)}</div>
        </div>
        <div className="trk-date-card highlight" data-testid="date-next-rebalance">
          <div className="trk-date-label">Próximo rebalanceo</div>
          <div className="trk-date-value">{fmtDate(tracker.next_rebalance_date)}</div>
        </div>
        <div className="trk-date-card" data-testid="date-last-evaluated">
          <div className="trk-date-label">Última evaluación</div>
          <div className="trk-date-value">{fmtDate(tracker.last_evaluated_date)}</div>
        </div>
      </div>
    </header>
  );
}
