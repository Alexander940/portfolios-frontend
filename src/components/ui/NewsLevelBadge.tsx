/* eslint-disable react-refresh/only-export-components --
 * Same rationale as RatingBadge/DealBadge: the label/tooltip helpers are
 * co-located with the badge so every consumer (and the executable check in
 * tests/checks) imports one module. Only affects fast-refresh granularity. */

/**
 * Badge del indicador de noticias (épica #262, #271).
 *
 * Cuatro estados visualmente distintos: `alcista` verde, `bajista` rojo,
 * `neutral` gris relleno y `sin_cobertura` gris con borde punteado y SIN score
 * (sin cobertura no es «cero neutral»: es «no sabemos»). Como `DealBadge`, se
 * estiliza inline con las variables `--c-*`, así funciona igual en el screener,
 * en el portafolio y en el tracker.
 *
 * El detalle (score, evidencia, «N notas / 30 d», eventos de 7 días con su
 * descripción corta, fecha de la fila en hora NY y el título de la nota
 * principal) va en el `title` nativo — alcanzable con teclado porque el chip es
 * focusable (`tabIndex=0`). Un `title` no puede llevar enlaces, así que cuando
 * viene `topNews` se agrega al lado un enlace propio a la nota
 * (`target=_blank rel=noopener`).
 *
 * Los Decimal del backend llegan como string: todo número se coacciona.
 */
import { ExternalLink } from 'lucide-react';
import { fmtDate } from '@/lib/format';
import {
  isNewsLevel,
  NEWS_LEVEL_LABELS,
  shortTagDescription,
  type NewsLevel,
} from '@/lib/newsTaxonomy';

type Num = number | string | null | undefined;

export interface NewsTopNews {
  title: string;
  url: string;
  /** ISO timestamp de publicación. */
  publishedAt?: string | null;
}

export interface NewsLevelBadgeProps {
  /** `null`/desconocido se trata como `sin_cobertura` (la regla del backend:
   *  un símbolo sin fila es sin cobertura, nunca NULL). */
  level: NewsLevel | string | null | undefined;
  score?: Num;
  evidence?: Num;
  nNotes30d?: Num;
  events7d?: string[] | null;
  topNews?: NewsTopNews | null;
  /** Fecha de la fila (`YYYY-MM-DD`, día calendario de Nueva York). */
  date?: string | null;
  /** Solo el punto de color + el score (celdas angostas). */
  compact?: boolean;
}

const LEVEL_COLOR: Record<NewsLevel, string> = {
  alcista: 'var(--c-pos)',
  bajista: 'var(--c-neg)',
  neutral: 'var(--c-text-soft)',
  sin_cobertura: 'var(--c-text-dim)',
};

function toNum(v: Num): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** El nivel efectivo: cualquier cosa fuera de la taxonomía → `sin_cobertura`. */
export function normalizeNewsLevel(level: NewsLevelBadgeProps['level']): NewsLevel {
  return isNewsLevel(level) ? level : 'sin_cobertura';
}

/** "+42" / "-17" / "0" (score entero, −100..+100). */
export function formatNewsScore(score: Num): string {
  const n = toNum(score);
  if (n === null) return '0';
  const r = Math.round(n);
  return r > 0 ? `+${r}` : `${r}`;
}

/** Texto del chip. `sin_cobertura` nunca muestra score. */
export function newsBadgeLabel(p: Pick<NewsLevelBadgeProps, 'level' | 'score'>): string {
  const level = normalizeNewsLevel(p.level);
  if (level === 'sin_cobertura') return NEWS_LEVEL_LABELS.sin_cobertura;
  return `${NEWS_LEVEL_LABELS[level]} ${formatNewsScore(p.score)}`;
}

/** "Oct 16, 2026, 9:30 AM (NY)" — un instante en hora de Nueva York. */
function fmtNyInstant(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })} (NY)`;
}

/** Tooltip multilínea del badge. */
export function newsTooltip(p: NewsLevelBadgeProps): string {
  const level = normalizeNewsLevel(p.level);
  const lines: string[] = [`Noticias: ${NEWS_LEVEL_LABELS[level]}`];
  if (level !== 'sin_cobertura') {
    lines.push(`Score: ${formatNewsScore(p.score)} (−100..+100)`);
  }
  const evidence = toNum(p.evidence);
  lines.push(`Evidencia: ${evidence === null ? '0' : String(Math.round(evidence * 100) / 100)}`);
  const n = toNum(p.nNotes30d);
  lines.push(`${n === null ? 0 : Math.round(n)} notas / 30 d`);
  const events = p.events7d ?? [];
  if (events.length > 0) {
    lines.push('Eventos (7 d):');
    for (const tag of events) lines.push(`  • ${tag}: ${shortTagDescription(tag)}`);
  }
  if (p.date) lines.push(`Fecha: ${fmtDate(p.date)} (NY)`);
  if (p.topNews?.title) {
    const when = p.topNews.publishedAt ? ` — ${fmtNyInstant(p.topNews.publishedAt)}` : '';
    lines.push(`Nota principal: ${p.topNews.title}${when}`);
  }
  return lines.join('\n');
}

export function NewsLevelBadge(props: NewsLevelBadgeProps) {
  const level = normalizeNewsLevel(props.level);
  const color = LEVEL_COLOR[level];
  const noCoverage = level === 'sin_cobertura';
  const tooltip = newsTooltip(props);
  const label = props.compact && !noCoverage ? formatNewsScore(props.score) : newsBadgeLabel(props);
  const events = props.events7d ?? [];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}>
      <span
        data-testid="news-level-badge"
        data-news-level={level}
        tabIndex={0}
        title={tooltip}
        aria-label={`Noticias: ${NEWS_LEVEL_LABELS[level]}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '1px 7px',
          borderRadius: 999,
          border: `1px ${noCoverage ? 'dashed' : 'solid'} ${color}`,
          background: noCoverage
            ? 'transparent'
            : `color-mix(in oklch, ${color} ${level === 'neutral' ? 10 : 14}%, transparent)`,
          color,
          fontSize: 11,
          fontWeight: noCoverage ? 500 : 600,
          fontStyle: noCoverage ? 'italic' : undefined,
          lineHeight: '15px',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
          cursor: 'help',
        }}
      >
        {label}
        {events.length > 0 && !noCoverage && (
          <span
            aria-hidden
            style={{
              padding: '0 4px',
              borderRadius: 999,
              background: 'var(--c-bg-softer)',
              color: 'var(--c-text-soft)',
              fontSize: 9,
              fontWeight: 600,
            }}
          >
            {events.length} ev
          </span>
        )}
      </span>
      {props.topNews?.url && (
        <a
          href={props.topNews.url}
          target="_blank"
          rel="noopener noreferrer"
          title={props.topNews.title}
          aria-label={`Nota principal: ${props.topNews.title}`}
          style={{ display: 'inline-flex', color: 'var(--c-text-dim)' }}
        >
          <ExternalLink size={11} />
        </a>
      )}
    </span>
  );
}
