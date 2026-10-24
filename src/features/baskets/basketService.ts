import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { apiClient } from '@/lib/axios';
import { getErrorMessage } from '@/lib/apiErrors';
import type {
  BasketCreate,
  BasketCreateResponse,
  BasketDetail,
  BasketListItem,
  BasketUpdate,
  SkippedTicker,
} from './types';

/**
 * Cliente de `/api/v1/baskets` (historia #291).
 *
 * Los 403/404/409/422 del backend se devuelven como {@link BasketApiError}
 * tipado para que la UI los muestre. Se aceptan vía `validateStatus` en vez de
 * dejarlos llegar al interceptor global porque `transformAxiosError` asume que
 * `detail` es un string, y aquí 409 (`basket_in_use`) y 422
 * (`no_resolved_tickers` / validación) traen un objeto o una lista. 401/5xx
 * siguen por el interceptor (logout en 401, mensaje genérico en 5xx).
 */

const HANDLED = new Set([403, 404, 409, 422]);
const acceptHandled = (s: number) => (s >= 200 && s < 300) || HANDLED.has(s);

export type BasketErrorCode = 'basket_in_use' | 'no_resolved_tickers' | 'duplicate_name' | null;

export class BasketApiError extends Error {
  readonly status: number;
  readonly code: BasketErrorCode;
  /** Nombres de estrategias que usan el basket (409 `basket_in_use`). */
  readonly strategies: string[];
  /** Tickers no resueltos (422 `no_resolved_tickers`). */
  readonly skipped: SkippedTicker[];
  readonly detail: unknown;

  constructor(status: number, detail: unknown) {
    const obj = detail && typeof detail === 'object' && !Array.isArray(detail)
      ? (detail as Record<string, unknown>)
      : null;
    const code = (obj?.code as BasketErrorCode | undefined)
      ?? (status === 409 && typeof detail === 'string' ? 'duplicate_name' : null);
    super(BasketApiError.messageFor(status, code, detail));
    this.name = 'BasketApiError';
    this.status = status;
    this.code = code;
    this.strategies = Array.isArray(obj?.strategies) ? (obj.strategies as string[]) : [];
    this.skipped = Array.isArray(obj?.skipped) ? (obj.skipped as SkippedTicker[]) : [];
    this.detail = detail;
  }

  private static messageFor(status: number, code: BasketErrorCode, detail: unknown): string {
    if (code === 'duplicate_name') return 'You already have a basket with that name';
    if (code === 'basket_in_use') return 'This basket is used by a strategy';
    if (code === 'no_resolved_tickers') return 'None of the tickers could be resolved';
    if (status === 403) return 'System baskets cannot be edited — duplicate it to edit';
    if (status === 404) return 'Basket not found';
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return 'Invalid input';
    return `Request failed (${status})`;
  }
}

/** Mensaje legible para cualquier error de este servicio (o del interceptor). */
export function basketErrorMessage(err: unknown): string {
  if (err instanceof BasketApiError) return err.message;
  return getErrorMessage(err);
}

async function call<T>(config: AxiosRequestConfig): Promise<T> {
  const res: AxiosResponse<unknown> = await apiClient.request({
    ...config,
    validateStatus: acceptHandled,
  });
  if (res.status >= 300) {
    const body = res.data as { detail?: unknown } | undefined;
    throw new BasketApiError(res.status, body?.detail);
  }
  return res.data as T;
}

export function listBaskets(): Promise<BasketListItem[]> {
  return call<BasketListItem[]>({ method: 'GET', url: '/baskets/' });
}

export function getBasket(basketId: string): Promise<BasketDetail> {
  return call<BasketDetail>({ method: 'GET', url: `/baskets/${basketId}` });
}

export function createBasket(payload: BasketCreate): Promise<BasketCreateResponse> {
  return call<BasketCreateResponse>({ method: 'POST', url: '/baskets/', data: payload });
}

export function updateBasket(basketId: string, payload: BasketUpdate): Promise<BasketDetail> {
  return call<BasketDetail>({ method: 'PATCH', url: `/baskets/${basketId}`, data: payload });
}

export async function deleteBasket(basketId: string): Promise<void> {
  await call<unknown>({ method: 'DELETE', url: `/baskets/${basketId}` });
}

export function addMembers(basketId: string, tickers: string[]): Promise<BasketCreateResponse> {
  return call<BasketCreateResponse>({
    method: 'POST',
    url: `/baskets/${basketId}/members`,
    data: { tickers },
  });
}

export async function removeMember(basketId: string, symbolId: string): Promise<void> {
  await call<unknown>({ method: 'DELETE', url: `/baskets/${basketId}/members/${symbolId}` });
}

export function duplicateBasket(basketId: string, name: string): Promise<BasketDetail> {
  return call<BasketDetail>({
    method: 'POST',
    url: `/baskets/${basketId}/duplicate`,
    data: { name },
  });
}
