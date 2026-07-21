/** Tipos del módulo de alertas — contrato del backend (epic portfolios-backend#94). */

export type AlertCategory = 'rating_tendencia' | 'precio' | 'eventos_fundamentales';

export interface AlertField {
  key: string;
  label: string;
  category: AlertCategory;
  dtype: 'decimal' | 'integer' | 'boolean';
  unit: string; // fraction | percent | usd | days | ratio | level | z | shares | x | none
  operators: string[];
  enabled: boolean;
  description: string;
}

export type TriggerMode = 'recurrente' | 'una_vez';

export interface Alert {
  alert_id: string;
  user_id: string;
  symbol_id: string;
  ticker: string | null;
  field: string;
  operator: string;
  threshold: string | null;
  trigger_mode: TriggerMode;
  cooldown_days: number;
  channels: string[];
  armed: boolean;
  is_active: boolean;
  last_triggered_at: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
}

/** Respuesta de POST/PATCH: incluye el valor actual del campo. */
export interface AlertWithValue extends Alert {
  current_value: string | number | boolean | null;
}

export interface AlertListResponse {
  items: Alert[];
  total: number;
  limit: number;
  offset: number;
}

export interface AlertEvent {
  event_id: string;
  alert_id: string;
  symbol_id: string;
  ticker: string;
  data_date: string;
  field: string;
  operator: string;
  threshold: string | null;
  observed_value: string | null;
  title: string;
  read_at: string | null;
  created_at: string;
}

export interface AlertEventListResponse {
  items: AlertEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface AlertCreatePayload {
  symbol_id: string;
  field: string;
  operator: string;
  threshold?: string | null;
  trigger_mode?: TriggerMode;
  cooldown_days?: number;
  channels?: string[];
  message?: string | null;
}

export interface AlertUpdatePayload {
  operator?: string;
  threshold?: string | null;
  trigger_mode?: TriggerMode;
  cooldown_days?: number;
  channels?: string[];
  is_active?: boolean;
  message?: string | null;
}

export type AlertStatusKey = 'pausada' | 'disparo_hoy' | 'cooldown' | 'armada';

export interface AlertStatus {
  key: AlertStatusKey;
  label: string;
}
