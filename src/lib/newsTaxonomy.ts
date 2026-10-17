/**
 * Taxonomía del indicador de noticias (épica #262, #271).
 *
 * COPIA A MANO de `app/indicators/news_taxonomy.py` del backend, que es la
 * ÚNICA fuente de verdad (ADR 0009). El backend no expone un endpoint de
 * taxonomía, así que si allá se agrega, quita o renombra una etiqueta o un
 * nivel (o cambia su descripción), hay que actualizar este archivo también:
 * el screener rechaza (422) cualquier valor que no esté en su lista.
 */

/** Los cuatro niveles de `news_indicator.level` (`NEWS_LEVELS`). */
export const NEWS_LEVELS = ['alcista', 'neutral', 'bajista', 'sin_cobertura'] as const;
export type NewsLevel = (typeof NEWS_LEVELS)[number];

/** Las 12 etiquetas de evento, en el orden de la épica (`NEWS_TAGS`). */
export const NEWS_TAGS = [
  'resultados',
  'guia',
  'ma',
  'capital',
  'analistas',
  'direccion',
  'regulatorio',
  'oferta',
  'producto',
  'legal',
  'bufete',
  'macro_sector',
] as const;
export type NewsTag = (typeof NEWS_TAGS)[number];

/** Una línea por etiqueta (`TAG_DESCRIPTIONS`), copiada literal. */
export const TAG_DESCRIPTIONS: Record<NewsTag, string> = {
  resultados: 'Reporte trimestral, sorpresa de EPS o de ingresos.',
  guia: 'Guidance subido, bajado o retirado.',
  ma: 'Adquisición, fusión, oferta o acuerdo definitivo (comprador o target; el rol se refleja en relevancia y polaridad).',
  capital: 'Dividendo, recompra o split.',
  analistas: 'Upgrade, downgrade, precio objetivo o inicio de cobertura.',
  direccion: 'Nombramiento o salida de CEO, CFO o miembros del directorio.',
  regulatorio: 'FDA, SEC, DOJ, antimonopolio, multas o recalls.',
  oferta: 'Emisión de acciones, colocación privada, convertibles o ATM.',
  producto: 'Lanzamiento, contrato, cliente grande o alianza.',
  legal: 'Demanda o fallo real contra o a favor de la empresa (no de un bufete).',
  bufete: 'Alerta de bufete a inversores, class action o plazo de lead plaintiff (no puntúa).',
  macro_sector: 'La nota es sobre el mercado o el sector y menciona al símbolo de paso (pesa 0,3).',
};

/** Texto visible de cada nivel (UI). */
export const NEWS_LEVEL_LABELS: Record<NewsLevel, string> = {
  alcista: 'Alcista',
  neutral: 'Neutral',
  bajista: 'Bajista',
  sin_cobertura: 'Sin cobertura',
};

export function isNewsLevel(v: unknown): v is NewsLevel {
  return typeof v === 'string' && (NEWS_LEVELS as readonly string[]).includes(v);
}

export function isNewsTag(v: unknown): v is NewsTag {
  return typeof v === 'string' && (NEWS_TAGS as readonly string[]).includes(v);
}

/** La descripción corta de una etiqueta (sin el paréntesis ni el punto final),
 *  la misma regla que `alert_catalog._short` del backend. Una etiqueta que no
 *  está en la copia local se muestra cruda. */
export function shortTagDescription(tag: string): string {
  if (!isNewsTag(tag)) return tag;
  return TAG_DESCRIPTIONS[tag].split(' (')[0].replace(/\.$/, '');
}
