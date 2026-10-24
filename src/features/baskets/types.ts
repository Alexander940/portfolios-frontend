/**
 * DTOs de la API `/baskets` (épica #287, historia #291). Espejo 1:1 de
 * `app/schemas/basket.py` del backend: los nombres se copian del código
 * mergeado, no de la issue.
 *
 * - `is_system` = `user_id IS NULL` (hoy sólo `slug='sp500'`, `kind='index'`).
 * - `weight` viene en **porcentaje** (7.776316 = 7,78 %), no en fracción.
 * - `rating` es el entero ADE {-3..+3} (sin 0) o null.
 * - Fechas: `date` → 'YYYY-MM-DD'; `datetime` → ISO 8601.
 */

export type BasketKind = 'user' | 'index';

export type SkippedReason = 'not_found' | 'inactive' | 'duplicate';

export interface SkippedTicker {
  ticker: string;
  reason: SkippedReason;
}

export interface BasketListItem {
  basket_id: string;
  slug: string | null;
  kind: BasketKind;
  name: string;
  description: string | null;
  is_system: boolean;
  member_count: number;
  weights_as_of: string | null;
  updated_at: string | null;
}

export interface BasketMemberOut {
  symbol_id: string;
  ticker: string;
  name: string | null;
  sector: string | null;
  valid_from: string;
  weight: number | null;
  weight_as_of: string | null;
  rating: number | null;
  price: number | null;
}

export interface BasketChange {
  ticker: string;
  name: string | null;
  date: string;
  kind: 'entered' | 'left';
  reason: string | null;
}

export interface BasketDetail extends BasketListItem {
  members: BasketMemberOut[];
  recent_changes: BasketChange[];
  /** Sólo en `kind='index'`: constituyentes de la fuente sin símbolo en la DB. */
  unresolved_count: number | null;
}

/** Respuesta de `POST /baskets/` y de `POST /baskets/{id}/members`. */
export interface BasketCreateResponse {
  basket: BasketDetail;
  resolved: number;
  skipped: SkippedTicker[];
}

// ── Payloads ────────────────────────────────────────────────────────────────

export interface BasketCreate {
  name: string;
  description?: string | null;
  /** Tal como los escribió el usuario; el backend normaliza (upper, `.`→`-`, dedupe). */
  tickers: string[];
}

export interface BasketUpdate {
  name?: string | null;
  description?: string | null;
}

export interface BasketMembersAdd {
  tickers: string[];
}

export interface BasketDuplicate {
  name: string;
}
