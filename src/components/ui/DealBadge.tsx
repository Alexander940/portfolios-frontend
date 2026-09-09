/* eslint-disable react-refresh/only-export-components --
 * Same rationale as RatingBadge: the label/tooltip helpers are co-located with
 * the badge so every consumer imports one module. The rule only affects Vite
 * fast-refresh granularity, not correctness. */

/**
 * Shared "En adquisición" badge (épica #175 — M&A deals).
 *
 * Rendered next to the ticker of any symbol that is the target of a pending
 * acquisition, in the portfolio positions table and in the tracker holdings.
 * Both tables live in the CSS-custom-properties design system (`--c-*`), not
 * Tailwind, so — like `RatingBadge` — this component styles itself inline with
 * those variables and works unchanged inside `index.css` and `tracker.css`.
 *
 * The detail (acquirer, payment type, price or exchange ratio, dates, spread)
 * goes in the native `title` tooltip so the badge stays one line wide inside a
 * table cell.
 *
 * `deal === null | undefined` renders NOTHING: a portfolio without deals must
 * look exactly like it did before this feature.
 */
import type { DealInfo, DealPaymentType, DealStatus } from '@/services/portfolioService';
import { fmtDate, fmtMoney, fmtNumber, fmtPct } from '@/lib/format';

const STATUS_LABEL: Record<DealStatus, string> = {
  rumored: 'Rumor de adquisición',
  announced: 'En adquisición',
  pending: 'En adquisición',
  completed: 'Adquisición cerrada',
  terminated: 'Adquisición cancelada',
};

const PAYMENT_LABEL: Record<DealPaymentType, string> = {
  cash: 'efectivo',
  stock: 'acciones',
  mixed: 'mixto (efectivo + acciones)',
};

/** A rumor is shown in a softer tone — it is never used to exclude a name. */
function statusColor(status: DealStatus): string {
  if (status === 'rumored') return 'var(--c-text-dim)';
  if (status === 'terminated') return 'var(--c-neg)';
  return 'var(--c-warn)';
}

/** Short chip label; the full story is in the tooltip. */
export function dealBadgeLabel(deal: DealInfo): string {
  return STATUS_LABEL[deal.status] ?? 'En adquisición';
}

/** Multi-line tooltip: comprador · pago · precio o ratio · fechas · spread. */
export function dealTooltip(deal: DealInfo): string {
  const lines: string[] = [dealBadgeLabel(deal)];
  if (deal.acquirer) lines.push(`Comprador: ${deal.acquirer}`);
  if (deal.payment_type) {
    lines.push(`Pago: ${PAYMENT_LABEL[deal.payment_type] ?? deal.payment_type}`);
  }
  if (deal.deal_price !== null && deal.deal_price !== undefined) {
    lines.push(`Precio ofrecido: ${fmtMoney(deal.deal_price)}`);
  }
  if (deal.exchange_ratio !== null && deal.exchange_ratio !== undefined) {
    lines.push(`Ratio de canje: ${fmtNumber(deal.exchange_ratio, 4)}`);
  }
  if (deal.announced_date) lines.push(`Anunciada: ${fmtDate(deal.announced_date)}`);
  if (deal.expected_close_date) {
    lines.push(`Cierre estimado: ${fmtDate(deal.expected_close_date)}`);
  }
  if (deal.closed_date) lines.push(`Cerrada: ${fmtDate(deal.closed_date)}`);
  // spread_pct already arrives in percent units — never multiply it by 100.
  if (deal.spread_pct !== null && deal.spread_pct !== undefined) {
    lines.push(`Spread: ${fmtPct(deal.spread_pct, 2, true)}`);
  }
  return lines.join('\n');
}

export function DealBadge({
  deal,
  compact = false,
}: {
  deal: DealInfo | null | undefined;
  /** Icon-only chip ("M&A") for very narrow cells. */
  compact?: boolean;
}) {
  if (!deal) return null;
  const color = statusColor(deal.status);
  return (
    <span
      data-testid="deal-badge"
      data-deal-status={deal.status}
      title={dealTooltip(deal)}
      aria-label={dealTooltip(deal)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        marginLeft: 4,
        padding: '1px 6px',
        borderRadius: 999,
        border: `1px solid ${color}`,
        background: `color-mix(in oklch, ${color} 14%, transparent)`,
        color,
        fontSize: 10,
        fontWeight: 600,
        lineHeight: '14px',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        cursor: 'help',
      }}
    >
      {compact ? 'M&A' : dealBadgeLabel(deal)}
    </span>
  );
}
