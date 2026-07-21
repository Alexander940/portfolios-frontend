import { apiClient } from '@/lib/axios';
import type {
  Alert,
  AlertCreatePayload,
  AlertEventListResponse,
  AlertField,
  AlertListResponse,
  AlertUpdatePayload,
  AlertWithValue,
} from './types';

/** Catálogo tipado — la ÚNICA fuente del constructor (nada hardcodeado). */
export async function getAlertFields(): Promise<AlertField[]> {
  const { data } = await apiClient.get<AlertField[]>('/alerts/fields');
  return data;
}

export async function listAlerts(params?: {
  symbol_id?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}): Promise<AlertListResponse> {
  const { data } = await apiClient.get<AlertListResponse>('/alerts', { params });
  return data;
}

export async function createAlert(payload: AlertCreatePayload): Promise<AlertWithValue> {
  const { data } = await apiClient.post<AlertWithValue>('/alerts', payload);
  return data;
}

export async function updateAlert(
  alertId: string,
  payload: AlertUpdatePayload,
): Promise<AlertWithValue> {
  const { data } = await apiClient.patch<AlertWithValue>(`/alerts/${alertId}`, payload);
  return data;
}

export async function deleteAlert(alertId: string): Promise<void> {
  await apiClient.delete(`/alerts/${alertId}`);
}

export async function listAlertEvents(params?: {
  unread_only?: boolean;
  limit?: number;
  offset?: number;
}): Promise<AlertEventListResponse> {
  const { data } = await apiClient.get<AlertEventListResponse>('/alerts/events', { params });
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>('/alerts/events/unread-count');
  return data.count;
}

export async function markEventsRead(
  body: { event_ids?: string[]; all?: boolean },
): Promise<number> {
  const { data } = await apiClient.post<{ marked: number }>('/alerts/events/mark-read', body);
  return data.marked;
}

export type { Alert };
