/**
 * Verificación ejecutable del indicador de noticias en el frontend (#271).
 *
 *     npx vite-node tests/checks/news-indicator.ts
 *
 * Mismo motivo que los otros `tests/checks/*.ts`: el repo no tiene runner
 * unitario (solo Playwright, que no arranca en este WSL). Ejerce el código
 * real — el badge renderizado con `react-dom/server`, el store del screener y
 * el `mapping.ts` del builder — contra el contrato de #268:
 *
 *   1. Badge: 4 estados con texto y estilo distintos; `sin_cobertura` sin score;
 *      tooltip con score / evidencia / notas / eventos / título; sin `topNews`
 *      no hay enlace y no rompe; `aria-label` con el nivel.
 *   2. Serialización: nivel `bajista` + excluir `oferta` + orden `news_score
 *      desc` produce exactamente esas claves; sin tocar nada, ningún `news_*`.
 *   3. Mapping: los 5 filtros y la clave de ranking con los nombres de #268.
 *
 * Opcional: `NEWS_TAXONOMY_PY=<ruta a app/indicators/news_taxonomy.py>` agrega
 * un chequeo de deriva contra la fuente de verdad del backend.
 */
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  NewsLevelBadge,
  newsBadgeLabel,
  newsTooltip,
  type NewsLevelBadgeProps,
} from '../../src/components/ui/NewsLevelBadge';
import { NEWS_LEVELS, NEWS_TAGS, TAG_DESCRIPTIONS } from '../../src/lib/newsTaxonomy';
import { useScreenerStore, parseSignedRangeParam } from '../../src/features/screener/stores/screenerStore';
import {
  NEWS_FILTERS,
  TABLE_COLUMN_PRESETS,
  defaultAdditionalFilters,
} from '../../src/features/screener/constants';
import {
  cfgToSpec,
  DEFAULT_CONFIG,
  SCREENER_FILTERS,
  SORT_FIELDS,
  specToConfig,
} from '../../src/features/strategy-builder/mapping';
import type { BuilderConfig } from '../../src/features/strategy-builder/types';

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.log(`FAIL ${name}\n  got:  ${g}\n  want: ${w}`);
    fail++;
  } else {
    console.log(`ok   ${name}`);
  }
};
const ok = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`ok   ${name}`);
  else {
    console.log(`FAIL ${name}${detail ? `\n  ${detail}` : ''}`);
    fail++;
  }
};
const render = (p: NewsLevelBadgeProps) => renderToStaticMarkup(createElement(NewsLevelBadge, p));
const pickNews = (o: object) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => k.startsWith('news_')));

// ---------------------------------------------------------------------------
// 0. Taxonomía local
// ---------------------------------------------------------------------------
eq('(tax) 4 niveles', [...NEWS_LEVELS], ['alcista', 'neutral', 'bajista', 'sin_cobertura']);
eq('(tax) 12 etiquetas', NEWS_TAGS.length, 12);
eq('(tax) una descripción por etiqueta', Object.keys(TAG_DESCRIPTIONS), [...NEWS_TAGS]);
if (process.env.NEWS_TAXONOMY_PY) {
  const py = readFileSync(process.env.NEWS_TAXONOMY_PY, 'utf8');
  const tagsBlock = /NEWS_TAGS: tuple\[str, \.\.\.\] = \(([\s\S]*?)\)/.exec(py)?.[1] ?? '';
  const pyTags = [...tagsBlock.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  eq('(tax) deriva: etiquetas == backend', pyTags, [...NEWS_TAGS]);
  const lvBlock = /NEWS_LEVELS: tuple\[str, \.\.\.\] = \(([^)]*)\)/.exec(py)?.[1] ?? '';
  eq('(tax) deriva: niveles == backend', [...lvBlock.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]), [...NEWS_LEVELS]);
  // Descripciones: el .py puede partirlas en varias líneas con concatenación implícita.
  const descBlock = /TAG_DESCRIPTIONS: dict\[str, str\] = \{([\s\S]*?)\n\}/.exec(py)?.[1] ?? '';
  for (const tag of NEWS_TAGS) {
    const m = new RegExp(`"${tag}": \\(?([\\s\\S]*?)\\)?,\\n    "|"${tag}": \\(?([\\s\\S]*?)\\)?,\\s*$`).exec(descBlock);
    const raw = (m?.[1] ?? m?.[2] ?? '');
    const text = [...raw.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]).join('');
    eq(`(tax) deriva: descripción ${tag}`, text, TAG_DESCRIPTIONS[tag]);
  }
}

// ---------------------------------------------------------------------------
// 1. Badge
// ---------------------------------------------------------------------------
const base = { evidence: '3.5', nNotes30d: 7, events7d: ['resultados', 'oferta'], date: '2026-10-16' };
const html = {
  alcista: render({ level: 'alcista', score: '42.4', ...base }),
  neutral: render({ level: 'neutral', score: 3, ...base }),
  bajista: render({ level: 'bajista', score: -37, ...base }),
  sin_cobertura: render({ level: 'sin_cobertura', score: 0, evidence: 0, nNotes30d: 0, events7d: [] }),
};
eq('(badge) textos', Object.fromEntries(Object.entries(html).map(([k]) => [k, newsBadgeLabel({ level: k, score: k === 'alcista' ? '42.4' : k === 'neutral' ? 3 : k === 'bajista' ? -37 : 0 })])), {
  alcista: 'Alcista +42',
  neutral: 'Neutral +3',
  bajista: 'Bajista -37',
  sin_cobertura: 'Sin cobertura',
});
for (const [lvl, h] of Object.entries(html)) {
  ok(`(badge) ${lvl}: data-news-level`, h.includes(`data-news-level="${lvl}"`), h);
  ok(`(badge) ${lvl}: aria-label con el nivel`, /aria-label="Noticias: [A-Z][a-z ]+"/.test(h), h);
}
const colorOf = (h: string) => /border:1px (solid|dashed) ([^;"]+)/.exec(h)?.slice(1).join(' ');
const looks = Object.values(html).map(colorOf);
eq('(badge) 4 estilos distintos', new Set(looks).size, 4);
ok('(badge) sin_cobertura punteado', (colorOf(html.sin_cobertura) ?? '').startsWith('dashed'));
ok('(badge) neutral NO punteado', (colorOf(html.neutral) ?? '').startsWith('solid'));
const tipNone = newsTooltip({ level: 'sin_cobertura', score: 55, evidence: 0, nNotes30d: 0 });
ok('(badge) sin_cobertura: tooltip sin score', !tipNone.includes('Score'), tipNone);
ok('(badge) sin_cobertura: chip sin score', !html.sin_cobertura.includes('+0') && html.sin_cobertura.includes('Sin cobertura'));
const tip = newsTooltip({
  level: 'alcista',
  score: 42,
  ...base,
  topNews: { title: 'ACME sube guidance', url: 'https://example.com/n', publishedAt: '2026-10-16T13:30:00Z' },
});
for (const frag of ['Score: +42', 'Evidencia: 3.5', '7 notas / 30 d', 'resultados: Reporte trimestral, sorpresa de EPS o de ingresos', 'oferta: Emisión de acciones, colocación privada, convertibles o ATM', '(NY)', 'Nota principal: ACME sube guidance', '9:30']) {
  ok(`(badge) tooltip contiene «${frag}»`, tip.includes(frag), tip);
}
const withLink = render({ level: 'alcista', score: 42, ...base, topNews: { title: 'T', url: 'https://example.com/n' } });
ok('(badge) con topNews: enlace target=_blank rel=noopener', /<a [^>]*href="https:\/\/example.com\/n"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/.test(withLink), withLink);
ok('(badge) sin topNews: sin enlace', !html.alcista.includes('<a '));
ok('(badge) nivel null → sin_cobertura', render({ level: null }).includes('data-news-level="sin_cobertura"'));
ok('(badge) focusable', html.alcista.includes('tabindex="0"'));

// ---------------------------------------------------------------------------
// 2. Serialización del screener (store real)
// ---------------------------------------------------------------------------
{
  const st = useScreenerStore.getState();
  eq('(ser) sin tocar nada → ningún news_*', pickNews(st.getApiRequest()), {});
  eq('(ser) defaults no incluyen news_*', pickNews(defaultAdditionalFilters()), {});
  st.setAdditionalFilter('news_level', ['bajista']);
  st.setAdditionalFilter('news_events_none', ['oferta']);
  st.setSort('news_score', 'desc');
  const req = useScreenerStore.getState().getApiRequest();
  eq('(ser) bajista + excluir oferta + news_score desc', {
    ...pickNews(req),
    sort_by: req.sort_by,
    sort_order: req.sort_order,
  }, { news_level: ['bajista'], news_events_none: ['oferta'], sort_by: 'news_score', sort_order: 'desc' });
  st.removeAdditionalFilter('news_level');
  st.removeAdditionalFilter('news_events_none');
  eq('(ser) quitar → vuelve a no haber news_*', pickNews(useScreenerStore.getState().getApiRequest()), {});
  eq('(ser) 5 filtros, apiKey == key', NEWS_FILTERS.map((f) => [f.key, f.apiKey, f.type]), [
    ['news_level', 'news_level', 'multiselect'],
    ['news_score', 'news_score', 'range'],
    ['news_evidence', 'news_evidence', 'range'],
    ['news_events_any', 'news_events_any', 'multiselect'],
    ['news_events_none', 'news_events_none', 'multiselect'],
  ]);
  const overview = TABLE_COLUMN_PRESETS.find((p) => p.id === 'overview')!;
  ok('(ser) columna Noticias en Overview, sortable por news_score', overview.columns.some((c) => c.key === 'news_score' && c.sortable && c.label === 'Noticias'));
  // URL: rango con signo.
  eq('(url) -30-50', parseSignedRangeParam('-30-50'), { min: -30, max: 50 });
  eq('(url) --10', parseSignedRangeParam('--10'), { max: -10 });
  eq('(url) -30--10', parseSignedRangeParam('-30--10'), { min: -30, max: -10 });
  eq('(url) 5-', parseSignedRangeParam('5-'), { min: 5 });
  useScreenerStore.getState().hydrateFromUrl(new URLSearchParams('news_level=bajista,bogus&news_score=-30-&news_events_any=oferta'));
  eq('(url) hidrata y descarta valores fuera de taxonomía', pickNews(useScreenerStore.getState().additionalFilters), {
    news_score: { min: -30 },
    news_level: ['bajista'],
    news_events_any: ['oferta'],
  });
}

// ---------------------------------------------------------------------------
// 3. Mapping del builder
// ---------------------------------------------------------------------------
{
  const newsDefs = SCREENER_FILTERS.filter((f) => f.key.startsWith('news_'));
  eq('(map) claves y tipos de los 5 filtros', newsDefs.map((f) => [f.key, f.type ?? 'range', f.sections ?? 'both']), [
    ['news_level', 'multiselect', 'both'],
    ['news_score', 'range', 'both'],
    ['news_evidence', 'range', 'both'],
    ['news_events_any', 'multiselect', 'both'],
    ['news_events_none', 'multiselect', 'both'],
  ]);
  eq('(map) opciones de nivel', newsDefs[0].staticOptions, [...NEWS_LEVELS]);
  eq('(map) opciones de eventos', newsDefs[3].staticOptions, [...NEWS_TAGS]);
  ok('(map) news_score es clave de ranking', SORT_FIELDS.some((f) => f.k === 'news_score'));
  ok('(map) news_score / evidence con kind ratio (sin ÷100)', newsDefs[1].kind === 'ratio' && newsDefs[2].kind === 'ratio');

  const plain = cfgToSpec({ ...DEFAULT_CONFIG, name: 'X' });
  eq('(map) DEFAULT_CONFIG → universo sin news_*', pickNews(plain.universe), {});
  eq('(map) DEFAULT_CONFIG → selection_filters sin news_*', pickNews(plain.selection_filters ?? {}), {});

  const cfg: BuilderConfig = {
    ...DEFAULT_CONFIG,
    name: 'X',
    sortBy: 'news_score',
    additionalRules: [
      { key: 'news_level', type: 'multiselect', values: ['alcista'] },
      { key: 'news_score', type: 'range', min: -20, max: '' },
    ],
    selectionFilters: [{ key: 'news_events_none', type: 'multiselect', values: ['oferta', 'bufete'] }],
  };
  const spec = cfgToSpec(cfg);
  eq('(map) universo news_*', pickNews(spec.universe), { news_level: ['alcista'], news_score: { min: -20 } });
  eq('(map) selection_filters news_*', pickNews(spec.selection_filters ?? {}), { news_events_none: ['oferta', 'bufete'] });
  eq('(map) selection.sort_by', spec.selection.sort_by, 'news_score');
  const back = cfgToSpec(specToConfig(spec, 'id'));
  eq('(map) round-trip spec → cfg → spec', [pickNews(back.universe), pickNews(back.selection_filters ?? {}), back.selection.sort_by], [
    pickNews(spec.universe),
    pickNews(spec.selection_filters ?? {}),
    'news_score',
  ]);
}

console.log(fail === 0 ? '\nTODO VERDE' : `\n${fail} FALLOS`);
process.exit(fail === 0 ? 0 : 1);
