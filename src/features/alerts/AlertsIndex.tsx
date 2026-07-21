import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, BellOff, Mail, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  deleteAlert,
  getAlertFields,
  listAlertEvents,
  listAlerts,
  updateAlert,
} from './service';
import { STATUS_STYLES, alertStatus, formatDate, formatInUnit, rulePhrase } from './lib';
import { AlertBuilderModal } from './AlertBuilderModal';
import type { Alert, AlertEvent, AlertField, AlertStatusKey, AlertWithValue } from './types';

const MAX_ACTIVE = 200;

type Tab = 'alertas' | 'historial';

/**
 * Página "Mis alertas" (issue #15): lista con estados, filtros, acciones y
 * pestaña de historial de disparos. El constructor (issue #16) se monta sobre
 * el botón "Nueva alerta" / "Editar".
 */
export function AlertsIndex() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'historial' ? 'historial' : 'alertas';

  const [fields, setFields] = useState<Map<string, AlertField>>(new Map());
  const [fieldsList, setFieldsList] = useState<AlertField[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tickerFilter, setTickerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todas' | AlertStatusKey>('todas');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [fieldList, alertList] = await Promise.all([
          getAlertFields(),
          listAlerts({ limit: 200 }),
        ]);
        if (cancelled) return;
        setFields(new Map(fieldList.map((f) => [f.key, f])));
        setFieldsList(fieldList);
        setAlerts(alertList.items);
        setError(null);
      } catch {
        if (!cancelled) setError('No se pudieron cargar tus alertas.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tab !== 'historial' || eventsLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await listAlertEvents({ limit: 50 });
        if (!cancelled) {
          setEvents(res.items);
          setEventsLoaded(true);
        }
      } catch {
        if (!cancelled) setError('No se pudo cargar el historial.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, eventsLoaded]);

  const filtered = useMemo(() => {
    const q = tickerFilter.trim().toUpperCase();
    return alerts.filter((a) => {
      if (q && !(a.ticker ?? '').toUpperCase().includes(q)) return false;
      if (statusFilter !== 'todas' && alertStatus(a).key !== statusFilter) return false;
      return true;
    });
  }, [alerts, tickerFilter, statusFilter]);

  const activeCount = alerts.filter((a) => a.is_active).length;

  async function toggle(alert: Alert) {
    try {
      const updated = await updateAlert(alert.alert_id, { is_active: !alert.is_active });
      setAlerts((prev) =>
        prev.map((a) => (a.alert_id === alert.alert_id ? { ...a, ...updated } : a)),
      );
    } catch {
      setError('No se pudo actualizar la alerta.');
    }
  }

  async function remove(alert: Alert) {
    const ok = window.confirm(
      `¿Eliminar la alerta de ${alert.ticker ?? 'este símbolo'}? Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    try {
      await deleteAlert(alert.alert_id);
      setAlerts((prev) => prev.filter((a) => a.alert_id !== alert.alert_id));
    } catch {
      setError('No se pudo eliminar la alerta.');
    }
  }

  function switchTab(next: Tab) {
    setSearchParams(next === 'historial' ? { tab: 'historial' } : {});
  }

  function openBuilder(alert: Alert | null) {
    setEditingAlert(alert);
    setBuilderOpen(true);
  }

  function onSaved(saved: AlertWithValue) {
    setAlerts((prev) => {
      const exists = prev.some((a) => a.alert_id === saved.alert_id);
      return exists
        ? prev.map((a) => (a.alert_id === saved.alert_id ? { ...a, ...saved } : a))
        : [saved, ...prev];
    });
    if (!saved.armed && saved.current_value !== null && saved.current_value !== undefined) {
      const field = fields.get(saved.field);
      const current =
        typeof saved.current_value === 'boolean'
          ? saved.current_value
            ? 'sí'
            : 'no'
          : formatInUnit(field, saved.current_value);
      setNotice(
        `${saved.ticker ?? 'El símbolo'}: la condición ya se cumple hoy (valor actual ${current}) — la alerta disparará en el próximo cruce.`,
      );
    } else {
      setNotice(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
          <p className="text-gray-600 mt-1">
            Reglas por símbolo evaluadas al cierre del mercado. Recibes los avisos
            por correo y en la campana.
          </p>
        </div>
        <button
          type="button"
          data-testid="new-alert"
          onClick={() => openBuilder(null)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16304f]"
        >
          <Plus size={16} /> Nueva alerta
        </button>
      </div>

      {notice && (
        <div
          data-testid="already-met"
          className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
        >
          <span>{notice}</span>
          <button
            type="button"
            className="text-amber-600 font-semibold"
            onClick={() => setNotice(null)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center gap-1 border-b border-gray-200">
        {(
          [
            ['alertas', 'Mis alertas'],
            ['historial', 'Historial'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            data-testid={`tab-${key}`}
            onClick={() => switchTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === key
                ? 'border-[#1e3a5f] text-[#1e3a5f]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto pb-2 text-xs text-gray-500" data-testid="active-count">
          {activeCount}/{MAX_ACTIVE} activas
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]" />
        </div>
      ) : tab === 'alertas' ? (
        <AlertsTab
          alerts={filtered}
          allCount={alerts.length}
          fields={fields}
          tickerFilter={tickerFilter}
          statusFilter={statusFilter}
          onTickerFilter={setTickerFilter}
          onStatusFilter={setStatusFilter}
          onToggle={toggle}
          onDelete={remove}
          onNew={() => openBuilder(null)}
          onEdit={(a) => openBuilder(a)}
        />
      ) : (
        <HistoryTab events={events} fields={fields} />
      )}

      <AlertBuilderModal
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        fields={fieldsList}
        editing={editingAlert}
        onSaved={onSaved}
      />
    </div>
  );
}

function AlertsTab(props: {
  alerts: Alert[];
  allCount: number;
  fields: Map<string, AlertField>;
  tickerFilter: string;
  statusFilter: 'todas' | AlertStatusKey;
  onTickerFilter: (v: string) => void;
  onStatusFilter: (v: 'todas' | AlertStatusKey) => void;
  onToggle: (a: Alert) => void;
  onDelete: (a: Alert) => void;
  onNew: () => void;
  onEdit: (a: Alert) => void;
}) {
  const { alerts, allCount, fields } = props;

  if (allCount === 0) {
    return (
      <div
        className="bg-white rounded-xl p-10 shadow-sm border border-gray-200 text-center"
        data-testid="empty-state"
      >
        <div className="w-16 h-16 bg-[#1e3a5f]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Bell className="w-8 h-8 text-[#1e3a5f]" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Aún no tienes alertas</h3>
        <p className="text-gray-500 max-w-md mx-auto mb-4">
          Crea tu primera regla — por ejemplo, que te avisemos cuando el retroceso
          de un símbolo supere tu umbral o su rating pase a bear.
        </p>
        <button
          type="button"
          onClick={props.onNew}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16304f]"
        >
          <Plus size={16} /> Crear mi primera alerta
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          data-testid="ticker-filter"
          value={props.tickerFilter}
          onChange={(e) => props.onTickerFilter(e.target.value)}
          placeholder="Filtrar por símbolo…"
          className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#1e3a5f] focus:outline-none"
        />
        <select
          data-testid="status-filter"
          value={props.statusFilter}
          onChange={(e) => props.onStatusFilter(e.target.value as 'todas' | AlertStatusKey)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white focus:border-[#1e3a5f] focus:outline-none"
        >
          <option value="todas">Todos los estados</option>
          <option value="armada">Armada</option>
          <option value="disparo_hoy">Disparó hoy</option>
          <option value="cooldown">En cooldown</option>
          <option value="pausada">Pausada</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
        {alerts.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-gray-500">
            Ninguna alerta coincide con los filtros.
          </div>
        )}
        {alerts.map((a) => {
          const status = alertStatus(a);
          const field = fields.get(a.field);
          return (
            <div
              key={a.alert_id}
              data-testid="alert-row"
              className="flex flex-wrap items-center gap-3 px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{a.ticker ?? '—'}</span>
                  <span
                    data-testid="alert-status"
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status.key]}`}
                  >
                    {status.label}
                  </span>
                  <span className="flex items-center gap-1 text-gray-400">
                    {a.channels.includes('email') && <Mail size={13} aria-label="Email" />}
                    {a.channels.includes('in_app') && <Bell size={13} aria-label="Campana" />}
                  </span>
                </div>
                <div className="truncate text-sm text-gray-600">
                  {rulePhrase(field, a)}
                  {a.trigger_mode === 'una_vez' && (
                    <span className="ml-2 text-xs text-gray-400">(una sola vez)</span>
                  )}
                  {a.message && <span className="ml-2 text-xs text-gray-400">· {a.message}</span>}
                </div>
              </div>
              <div className="text-xs text-gray-500 w-28">
                Último: {formatDate(a.last_triggered_at)}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="alert-toggle"
                  onClick={() => props.onToggle(a)}
                  title={a.is_active ? 'Pausar' : 'Activar'}
                  className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
                >
                  {a.is_active ? <BellOff size={15} /> : <Bell size={15} />}
                </button>
                <button
                  type="button"
                  data-testid="alert-edit"
                  onClick={() => props.onEdit(a)}
                  title="Editar"
                  className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  data-testid="alert-delete"
                  onClick={() => props.onDelete(a)}
                  title="Eliminar"
                  className="rounded-lg border border-gray-200 p-1.5 text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoryTab(props: { events: AlertEvent[]; fields: Map<string, AlertField> }) {
  if (props.events.length === 0) {
    return (
      <div
        className="bg-white rounded-xl p-10 shadow-sm border border-gray-200 text-center text-sm text-gray-500"
        data-testid="history-empty"
      >
        Sin disparos todavía — cuando una alerta se dispare aparecerá aquí.
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
      {props.events.map((e) => (
        <div key={e.event_id} data-testid="event-row" className="flex items-center gap-3 px-5 py-3">
          <div className="w-24 text-xs text-gray-500">{formatDate(e.data_date)}</div>
          <div className="min-w-0 flex-1 text-sm text-gray-800 truncate">{e.title}</div>
          {e.observed_value !== null && (
            <div className="text-xs text-gray-400">
              {formatInUnit(props.fields.get(e.field), e.observed_value)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
