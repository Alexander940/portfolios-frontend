import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CirclePlus,
  CircleMinus,
  Loader2,
  RefreshCw,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { getErrorMessage } from '@/lib/apiErrors';
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from '@/lib/format';
import { getEvents } from '../service';
import { useTrackerStore } from '../store';
import type { TrackerEvent, TrackerEventType } from '../types';

const PAGE_SIZE = 10;

const FILTERS: { key: TrackerEventType | null; label: string }[] = [
  { key: null, label: 'Todos' },
  { key: 'rebalance', label: 'Rebalanceos' },
  { key: 'enter', label: 'Entradas' },
  { key: 'exit', label: 'Salidas' },
  { key: 'skip', label: 'Días omitidos' },
  { key: 'error', label: 'Errores' },
];

const REBALANCE_REASON: Record<string, string> = {
  cadence: 'por calendario',
  version_rebase: 'cambio de versión',
  initial_materialization: 'materialización inicial',
};

const SKIP_REASON: Record<string, string> = {
  empty_universe: 'El universo resolvió vacío',
  low_coverage: 'Cobertura de datos insuficiente',
  non_positive_value: 'Valor del portafolio no positivo',
};

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return v !== null && v !== undefined && v !== '' && Number.isFinite(n) ? n : null;
}

function EventIcon({ type }: { type: TrackerEventType }) {
  switch (type) {
    case 'rebalance':
      return <RefreshCw size={16} style={{ color: 'var(--c-accent)' }} aria-hidden />;
    case 'enter':
      return <CirclePlus size={16} style={{ color: 'var(--c-pos)' }} aria-hidden />;
    case 'exit':
      return <CircleMinus size={16} style={{ color: 'var(--c-neg)' }} aria-hidden />;
    case 'skip':
      return <SkipForward size={16} style={{ color: 'var(--c-text-dim)' }} aria-hidden />;
    default:
      return <XCircle size={16} style={{ color: 'var(--c-neg)' }} aria-hidden />;
  }
}

function eventTitle(e: TrackerEvent): string {
  switch (e.event_type) {
    case 'rebalance':
      return 'Rebalanceo';
    case 'enter':
      return `Entrada · ${e.ticker ?? '—'}`;
    case 'exit':
      return `Salida · ${e.ticker ?? '—'}`;
    case 'skip':
      return 'Día omitido';
    case 'error':
      return 'Error';
    default:
      return e.event_type;
  }
}

/** Subtítulo compacto por tipo — defensivo ante payloads incompletos. */
function eventSubtitle(e: TrackerEvent): string {
  const p = e.payload ?? {};
  switch (e.event_type) {
    case 'rebalance': {
      const parts: string[] = [];
      const turnover = num(p.turnover_pct);
      if (turnover !== null) parts.push(`turnover ${fmtPct(turnover, 1)}`);
      const total = num(p.total_value);
      if (total !== null) parts.push(fmtMoney(total));
      const entered = Array.isArray(p.entered) ? p.entered.length : num(p.entered);
      const exited = Array.isArray(p.exited) ? p.exited.length : num(p.exited);
      if (entered !== null || exited !== null) {
        parts.push(`${entered ?? 0} entradas / ${exited ?? 0} salidas`);
      }
      return parts.join(' · ');
    }
    case 'enter': {
      const parts: string[] = [];
      const shares = num(p.shares);
      if (shares !== null) parts.push(`${fmtNumber(shares, 0)} acciones`);
      const price = num(p.price);
      if (price !== null) parts.push(`@ ${fmtMoney(price)}`);
      const weight = num(p.weight_pct);
      if (weight !== null) parts.push(`peso ${fmtPct(weight, 1)}`);
      return parts.join(' ');
    }
    case 'exit': {
      const parts: string[] = [];
      const sold = num(p.shares_sold);
      if (sold !== null) parts.push(`${fmtNumber(sold, 0)} vendidas`);
      const price = num(p.price);
      if (price !== null) parts.push(`@ ${fmtMoney(price)}`);
      const reason = str(p.reason);
      if (reason) parts.push(`· ${reason}`);
      return parts.join(' ');
    }
    case 'skip': {
      const reason = str(p.reason);
      return (reason && SKIP_REASON[reason]) ?? reason ?? '';
    }
    case 'error':
      return str(p.error) ?? '';
    default:
      return '';
  }
}

function TickerChips({ label, value }: { label: string; value: unknown }) {
  if (!Array.isArray(value) || value.length === 0) return null;
  return (
    <div className="trk-event-chips">
      <span className="trk-date-label">{label}</span>
      {value.map((t) => (
        <span className="chip" key={String(t)}>
          {String(t)}
        </span>
      ))}
    </div>
  );
}

function EventDetail({ e }: { e: TrackerEvent }) {
  const p = e.payload ?? {};
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, value: string | null) => {
    if (value !== null && value !== '') rows.push({ label, value });
  };

  switch (e.event_type) {
    case 'rebalance': {
      const reason = str(p.reason);
      push('Motivo', reason ? (REBALANCE_REASON[reason] ?? reason) : null);
      const cov = num(p.coverage_pct);
      push('Cobertura', cov !== null ? fmtPct(cov * 100, 1) : null);
      const eligible = num(p.eligible_count);
      push('Elegibles', eligible !== null ? String(eligible) : null);
      push('Datos al cierre de', str(p.data_as_of) ? fmtDate(str(p.data_as_of)) : null);
      break;
    }
    case 'enter': {
      const rank = num(p.rank);
      push('Rank', rank !== null ? `#${rank}` : null);
      const score = num(p.score);
      push(str(p.sort_by) ?? 'Score', score !== null ? fmtNumber(score, 2) : null);
      break;
    }
    case 'exit': {
      push('Motivo', str(p.reason));
      const pnl = num(p.realized_pnl_pct);
      push('P&L realizado', pnl !== null ? fmtPct(pnl, 2, true) : null);
      break;
    }
    case 'skip': {
      const cov = num(p.coverage_pct);
      push('Cobertura', cov !== null ? fmtPct(cov * 100, 1) : null);
      break;
    }
    case 'error': {
      push('Error', str(p.error));
      break;
    }
  }

  const warnings = Array.isArray(p.warnings) ? p.warnings.map(String) : [];

  return (
    <div className="trk-event-detail" data-testid={`event-detail-${e.event_id}`}>
      <TickerChips label="Entraron" value={p.entered} />
      <TickerChips label="Salieron" value={p.exited} />
      {rows.map((r) => (
        <div className="trk-event-detail-row" key={r.label}>
          <span className="trk-date-label">{r.label}</span>
          <span>{r.value}</span>
        </div>
      ))}
      {warnings.map((w) => (
        <div className="trk-drift-warning" key={w}>
          {w}
        </div>
      ))}
      {rows.length === 0 && warnings.length === 0 && !Array.isArray(p.entered) && (
        <span className="dim" style={{ fontSize: 12 }}>
          Sin detalle adicional.
        </span>
      )}
    </div>
  );
}

interface EventsFetch {
  events: TrackerEvent[];
  total: number;
  isLoading: boolean;
  error: string | null;
}

export function EventsJournal() {
  const tracker = useTrackerStore((s) => s.tracker);
  const strategyId = tracker?.strategy_id;

  const [filter, setFilter] = useState<TrackerEventType | null>(null);
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [{ events, total, isLoading, error }, setFetch] = useState<EventsFetch>({
    events: [],
    total: 0,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!strategyId) return;
    const controller = new AbortController();
    getEvents(strategyId, { type: filter, limit: PAGE_SIZE, offset }, controller.signal)
      .then((res) =>
        setFetch({ events: res.events, total: res.total, isLoading: false, error: null }),
      )
      .catch((err) => {
        if (controller.signal.aborted) return;
        setFetch({ events: [], total: 0, isLoading: false, error: getErrorMessage(err) });
      });
    return () => controller.abort();
  }, [strategyId, filter, offset]);

  if (!tracker) return null;

  const handleFilter = (key: TrackerEventType | null) => {
    setFilter(key);
    setOffset(0);
    setExpanded(new Set());
    setFetch((f) => ({ ...f, isLoading: true }));
  };

  const handlePage = (next: number) => {
    setOffset(next);
    setExpanded(new Set());
    setFetch((f) => ({ ...f, isLoading: true }));
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className="card" style={{ marginBottom: 16 }} data-testid="events-journal">
      <div className="card-head">
        <div>
          <div className="card-title">Historial de eventos</div>
          <div className="card-sub">Todo lo que hizo el tracker, en orden cronológico</div>
        </div>
        {isLoading && <Loader2 className="animate-spin" size={16} aria-hidden />}
      </div>

      <div className="trk-event-filters">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            className={`chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => handleFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="trk-error-box" data-testid="events-error">
          {error}
        </div>
      ) : events.length === 0 && !isLoading ? (
        <div className="trk-error-box" data-testid="events-empty">
          Sin eventos para este filtro.
        </div>
      ) : (
        <div className="trk-event-list">
          {events.map((e) => {
            const isOpen = expanded.has(e.event_id);
            return (
              <div className="trk-event" key={e.event_id} data-testid={`event-${e.event_id}`}>
                <button
                  type="button"
                  className="trk-event-row"
                  onClick={() => toggleExpanded(e.event_id)}
                  aria-expanded={isOpen}
                >
                  <EventIcon type={e.event_type} />
                  <div className="trk-event-main">
                    <span className="trk-event-title">{eventTitle(e)}</span>
                    <span className="trk-event-sub">{eventSubtitle(e)}</span>
                  </div>
                  <span className="trk-event-when">
                    {fmtDate(e.event_date)}
                    <span className="dim">
                      {' · '}
                      {new Date(e.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                  {isOpen ? (
                    <ChevronDown size={14} aria-hidden />
                  ) : (
                    <ChevronRight size={14} aria-hidden />
                  )}
                </button>
                {isOpen && <EventDetail e={e} />}
              </div>
            );
          })}
        </div>
      )}

      <div className="trk-event-pager" data-testid="events-pager">
        <span className="dim">
          {from}–{to} de {total}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            size="sm"
            variant="ghost"
            disabled={offset === 0 || isLoading}
            onClick={() => handlePage(Math.max(0, offset - PAGE_SIZE))}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={offset + PAGE_SIZE >= total || isLoading}
            onClick={() => handlePage(offset + PAGE_SIZE)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
