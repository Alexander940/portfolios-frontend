import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { SymbolModal } from '@/components/symbol';
import { getUnreadCount, listAlertEvents, markEventsRead } from './service';
import { formatDate } from './lib';
import type { AlertEvent } from './types';

/** Refresco suave del badge: los eventos llegan UNA vez al día (EOD), no hace
 * falta tiempo real — al navegar + un intervalo largo alcanza. */
const POLL_MS = 60_000;

/**
 * Campana de notificaciones del Topbar (issue #17): badge con no-leídas,
 * panel con los eventos recientes, marcar-leídas y acceso al historial.
 */
export function NotificationsBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [symbolModal, setSymbolModal] = useState<{ symbol_id: string; ticker: string } | null>(
    null,
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const refreshCount = useCallback(async () => {
    try {
      setCount(await getUnreadCount());
    } catch {
      /* silencioso: la campana nunca rompe el shell */
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const id = setInterval(() => void refreshCount(), POLL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  // refresco al navegar (los eventos aparecen tras el cierre, no en vivo)
  useEffect(() => {
    void refreshCount();
  }, [location.pathname, refreshCount]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const res = await listAlertEvents({ limit: 10 });
        setEvents(res.items);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }
  }

  async function markAll() {
    try {
      await markEventsRead({ all: true });
      setEvents((prev) =>
        prev.map((e) => ({ ...e, read_at: e.read_at ?? new Date().toISOString() })),
      );
      await refreshCount();
    } catch {
      /* best-effort */
    }
  }

  async function openEvent(event: AlertEvent) {
    setSymbolModal({ symbol_id: event.symbol_id, ticker: event.ticker });
    setOpen(false);
    if (!event.read_at) {
      try {
        await markEventsRead({ event_ids: [event.event_id] });
        await refreshCount();
      } catch {
        /* best-effort */
      }
    }
  }

  function goToHistory() {
    setOpen(false);
    navigate('/dashboard/alerts?tab=historial');
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="topbar-icon-btn"
        aria-label="Notificaciones"
        data-testid="bell-button"
        onClick={() => void toggleOpen()}
      >
        <Bell size={16} />
        {count > 0 && (
          <span className="bell-badge" data-testid="bell-badge">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="bell-panel" data-testid="bell-panel" role="menu">
          <div className="bell-panel-header">
            <strong>Notificaciones</strong>
            {count > 0 && (
              <button type="button" data-testid="bell-mark-all" onClick={() => void markAll()}>
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="bell-panel-body">
            {loading ? (
              <div className="bell-empty">Cargando…</div>
            ) : events.length === 0 ? (
              <div className="bell-empty" data-testid="bell-empty">
                Sin notificaciones
              </div>
            ) : (
              events.map((e) => (
                <button
                  key={e.event_id}
                  type="button"
                  className="bell-item"
                  data-testid="bell-item"
                  onClick={() => void openEvent(e)}
                >
                  {!e.read_at && <span className="bell-unread-dot" data-testid="unread-dot" />}
                  <span className="bell-item-body">
                    <span className="bell-item-title">{e.title}</span>
                    <span className="bell-item-meta">
                      {e.ticker} · {formatDate(e.data_date)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="bell-panel-footer">
            <button type="button" data-testid="bell-see-all" onClick={goToHistory}>
              Ver todas
            </button>
          </div>
        </div>
      )}

      {symbolModal && (
        <SymbolModal
          isOpen={!!symbolModal}
          onClose={() => setSymbolModal(null)}
          symbolId={symbolModal.symbol_id}
          ticker={symbolModal.ticker}
          name={symbolModal.ticker}
          exchange={null}
          sector={null}
        />
      )}
    </div>
  );
}
