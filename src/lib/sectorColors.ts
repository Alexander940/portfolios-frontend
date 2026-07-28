/**
 * Colores por sector del design system (tokens --c-sector-*, definidos en
 * :root — usables en cualquier feature). Vocabulario FMP canónico, el mismo
 * que devuelve el backend tras normalizar.
 */
export const SECTOR_TOKEN: Record<string, string> = {
  Technology: 'var(--c-sector-1)',
  'Financial Services': 'var(--c-sector-2)',
  Healthcare: 'var(--c-sector-3)',
  'Consumer Cyclical': 'var(--c-sector-4)',
  'Consumer Defensive': 'var(--c-sector-5)',
  Industrials: 'var(--c-sector-6)',
  Energy: 'var(--c-sector-7)',
  'Basic Materials': 'var(--c-sector-8)',
  'Real Estate': 'var(--c-sector-9)',
  Utilities: 'var(--c-sector-10)',
  'Communication Services': 'var(--c-sector-11)',
};

export const UNCLASSIFIED_SECTOR = 'Unclassified';
export const CASH_SECTOR = 'Cash';

export function sectorColor(sector: string): string {
  if (sector === UNCLASSIFIED_SECTOR) return 'var(--c-text-dim)';
  if (sector === CASH_SECTOR) return 'var(--c-text-soft)';
  return SECTOR_TOKEN[sector] ?? 'var(--c-sector-12)';
}
