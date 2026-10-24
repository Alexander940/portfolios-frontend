import type { BasketCreateResponse, SkippedReason } from './types';

/**
 * Parte el texto pegado en tickers: coma, `;`, espacios, tabs y saltos de
 * línea (pegado desde una columna o fila de Excel). Los tickers se mandan tal
 * cual los escribió el usuario — el backend normaliza (upper, `.`→`-`, dedupe).
 *
 *   parseTickers('nvda, AMD\nbrk.b XXXX') → ['nvda', 'AMD', 'brk.b', 'XXXX']
 */
export function parseTickers(text: string): string[] {
  return text.split(/[\s,;]+/).filter((t) => t.length > 0);
}

const REASON_LABEL: Record<SkippedReason, string> = {
  not_found: 'not found',
  inactive: 'inactive',
  duplicate: 'duplicate',
};

export function skippedReasonLabel(reason: SkippedReason | string): string {
  return REASON_LABEL[reason as SkippedReason] ?? reason;
}

/** «3 added · 1 skipped (XXXX: not found)». */
export function formatAddResult(res: Pick<BasketCreateResponse, 'resolved' | 'skipped'>): string {
  const base = `${res.resolved} added · ${res.skipped.length} skipped`;
  if (res.skipped.length === 0) return base;
  const detail = res.skipped
    .map((s) => `${s.ticker}: ${skippedReasonLabel(s.reason)}`)
    .join(', ');
  return `${base} (${detail})`;
}

/** `weight` llega en porcentaje: 7.776316 → «7.78 %». */
export function formatWeight(weight: number | null | undefined): string {
  return weight === null || weight === undefined ? '—' : `${weight.toFixed(2)} %`;
}

export function formatPrice(price: number | null | undefined): string {
  return price === null || price === undefined ? '—' : `$${price.toFixed(2)}`;
}

/** ISO datetime/date → 'YYYY-MM-DD' (sin conversión de zona: es una fecha de datos). */
export function formatDay(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '—';
}

export const SYSTEM_EDIT_TOOLTIP = 'Duplicate it to edit';
