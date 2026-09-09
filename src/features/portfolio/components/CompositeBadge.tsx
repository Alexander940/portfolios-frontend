import { Layers } from 'lucide-react';

interface CompositeBadgeProps {
  /** `sm` for the list table (next to the name), `md` for the detail header. */
  size?: 'sm' | 'md';
}

/**
 * Insignia «Compuesto» (#208).
 *
 * Marca los portafolios creados a partir de mangas de estrategias (#197): son
 * los únicos que tienen pestaña «Mangas» y que se rebalancean replicando sus
 * estrategias en vez de un screener guardado. Se decide SIEMPRE con
 * `isCompositePortfolio` sobre el spec de creación — nunca por el
 * `portfolio_type`, que es una columna aparte y puede decir «Custom».
 */
export function CompositeBadge({ size = 'md' }: CompositeBadgeProps) {
  const small = size === 'sm';
  return (
    <span
      className="type-badge"
      title="Portafolio compuesto: sus posiciones salen de las mangas de estrategias que lo componen"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'var(--c-accent-soft)',
        color: 'var(--c-accent-text)',
        fontSize: small ? 10 : 11,
        padding: small ? '1px 6px' : '2px 8px',
      }}
    >
      <Layers size={small ? 10 : 12} style={{ flexShrink: 0 }} />
      Compuesto
    </span>
  );
}
