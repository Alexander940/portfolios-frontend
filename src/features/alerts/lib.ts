import type { Alert, AlertField, AlertStatus } from './types';

/** Etiquetas en español de los operadores del catálogo. */
export const OPERATOR_LABELS: Record<string, string> = {
  gt: 'mayor que',
  gte: 'mayor o igual que',
  lt: 'menor que',
  lte: 'menor o igual que',
  eq: 'igual a',
  change: 'cualquier cambio',
  becomes_true: 'se activa',
  becomes_false: 'se desactiva',
};

const trim = (s: string) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);

/**
 * Formatea un valor en la unidad del campo, como lo ve el usuario.
 * El backend siempre habla en la unidad NATIVA (fraction = 0.15); aquí se
 * convierte a lo legible (15%).
 */
export function formatInUnit(field: AlertField | undefined, raw: string | number | null): string {
  if (raw === null || raw === undefined || raw === '') return 's/d';
  const v = typeof raw === 'number' ? raw : parseFloat(raw);
  if (Number.isNaN(v)) return String(raw);
  switch (field?.unit) {
    case 'fraction':
      return `${trim((v * 100).toFixed(2))}%`;
    case 'percent':
      return `${trim(v.toFixed(2))}%`;
    case 'usd':
      return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'x':
      return `${trim(v.toFixed(2))}×`;
    case 'days':
      return `${Math.round(v)} días`;
    case 'shares':
      return Math.round(v).toLocaleString('en-US');
    default:
      return trim(v.toFixed(4));
  }
}

/** La regla en frase natural: "Retroceso del ciclo mayor que 15%". */
export function rulePhrase(field: AlertField | undefined, alert: Pick<Alert, 'field' | 'operator' | 'threshold'>): string {
  const label = field?.label ?? alert.field;
  const op = OPERATOR_LABELS[alert.operator] ?? alert.operator;
  if (alert.operator === 'change') return `${label}: cualquier cambio`;
  if (alert.operator === 'becomes_true' || alert.operator === 'becomes_false') {
    return `${label} ${op}`;
  }
  return `${label} ${op} ${formatInUnit(field, alert.threshold)}`;
}

/** Estado visible de la alerta (§9 del diseño): Pausada > Disparó hoy > En cooldown > Armada. */
export function alertStatus(alert: Alert, now: Date = new Date()): AlertStatus {
  if (!alert.is_active) return { key: 'pausada', label: 'Pausada' };
  if (alert.last_triggered_at) {
    const fired = new Date(alert.last_triggered_at);
    const sameDay =
      fired.getUTCFullYear() === now.getUTCFullYear() &&
      fired.getUTCMonth() === now.getUTCMonth() &&
      fired.getUTCDate() === now.getUTCDate();
    if (sameDay) return { key: 'disparo_hoy', label: 'Disparó hoy' };
    if (alert.cooldown_days > 0) {
      const days = Math.floor((now.getTime() - fired.getTime()) / 86_400_000);
      if (days < alert.cooldown_days) return { key: 'cooldown', label: 'En cooldown' };
    }
  }
  return { key: 'armada', label: 'Armada' };
}

export const STATUS_STYLES: Record<string, string> = {
  armada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  disparo_hoy: 'bg-amber-50 text-amber-700 border-amber-200',
  cooldown: 'bg-sky-50 text-sky-700 border-sky-200',
  pausada: 'bg-gray-100 text-gray-500 border-gray-200',
};

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
