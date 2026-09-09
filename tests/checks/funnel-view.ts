/**
 * Verificación ejecutable de la pestaña "Selection" — embudo del último
 * rebalanceo (#174, Fase B).
 *
 *     npx vite-node tests/checks/funnel-view.ts
 *
 * Existe por la misma razón que `or-filters-roundtrip.ts`: el navegador de
 * Playwright no arranca en este WSL, así que el e2e
 * (`tests/e2e/builder-funnel.spec.ts`) se escribe pero no se ejecuta aquí.
 * Esto ejerce las funciones puras extraídas a `selectionTrace.ts` sobre
 * respuestas de ejemplo con la MISMA forma que el contrato fijado en
 * docs/loops-history/issue-174/design.md — no contra las 1.185 filas reales
 * (eso lo cubre el oráculo 3 del backend, la fidelidad contra los fills).
 *
 * Lo que se protege:
 *   - conservación: filtrar `rows` por etapa (del lado del cliente) reproduce
 *     exactamente el `count` que esa etapa reporta — la tabla nunca puede
 *     mostrar un número que no cuadre con el riel;
 *   - `exit_stage: null` ("llegó a la cartera") nunca se cuenta como una
 *     etapa de salida, en ninguna de las 5 vistas por etapa;
 *   - los 8 códigos de `reason` del contrato traducen a texto legible — nunca
 *     el string crudo (top_n_cut, per_sector_full, etc.);
 *   - la detección de empates dispara cuando el tope del ranking comparte
 *     score y NO dispara cuando los scores son distintos.
 */
import {
  detectRankingTies,
  exitStageLabel,
  reasonLabel,
  rowsAtStage,
  STAGE_LABELS,
  STAGE_ORDER,
  stageDropLabel,
} from '../../src/features/strategy-builder/selectionTrace';
import type {
  SelectionExitReason,
  SelectionRow,
  SelectionStage,
} from '../../src/features/strategy-builder/types';

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
  if (cond) {
    console.log(`ok   ${name}`);
  } else {
    console.log(`FAIL ${name}${detail ? `\n  ${detail}` : ''}`);
    fail++;
  }
};

// ---------------------------------------------------------------------------
// Fixture — same shape as the fixed contract, scaled down from 1,185 to 12
// candidates so the arithmetic is checkable by eye. 20 candidates considered,
// 12 survive the universe filter (`rows` — like prod, only tracks candidates
// FROM the universe stage's output onward; the universe stage's own rejects
// never appear as rows, hence no row below has exit_stage: 'universe').
//
//   universe        12 → (dropped 2 here)
//   selection_rules 10 → (dropped 5 here, top_n_cut)
//   ranking          5 → (dropped 1 here, below_floor)
//   weighting        4 → (dropped 1 here, no_price)
//   execution        3   (== rows with exit_stage: null, "in portfolio")
// ---------------------------------------------------------------------------
function row(p: Partial<SelectionRow> & { symbol_id: string; ticker: string }): SelectionRow {
  return {
    name: p.ticker,
    sector: 'Technology',
    score: null,
    rank: null,
    exit_stage: null,
    reason: null,
    weight_pct: null,
    ...p,
  };
}

const rows: SelectionRow[] = [
  // Ranks 1-2 tie at the best score (3.0) — the design's called-out failure
  // mode (low-cardinality ranking key). Both make it to the portfolio.
  row({ symbol_id: 's1', ticker: 'R1', rank: 1, score: 3.0, weight_pct: 34.0 }),
  row({ symbol_id: 's2', ticker: 'R2', rank: 2, score: 3.0, weight_pct: 33.0 }),
  row({ symbol_id: 's3', ticker: 'R3', rank: 3, score: 2.5, weight_pct: 33.0 }),
  row({ symbol_id: 's4', ticker: 'R4', rank: 4, score: 2.0, exit_stage: 'execution', reason: 'no_price' }),
  row({ symbol_id: 's5', ticker: 'R5', rank: 5, score: 1.5, exit_stage: 'weighting', reason: 'below_floor' }),
  row({ symbol_id: 's6', ticker: 'R6', rank: 6, score: 1.0, exit_stage: 'ranking', reason: 'top_n_cut' }),
  row({ symbol_id: 's7', ticker: 'R7', rank: 7, score: 0.5, exit_stage: 'ranking', reason: 'top_n_cut' }),
  row({ symbol_id: 's8', ticker: 'R8', rank: 8, score: 0.0, exit_stage: 'ranking', reason: 'top_n_cut' }),
  row({ symbol_id: 's9', ticker: 'R9', rank: 9, score: -0.5, exit_stage: 'ranking', reason: 'top_n_cut' }),
  row({ symbol_id: 's10', ticker: 'R10', rank: 10, score: -1.0, exit_stage: 'ranking', reason: 'top_n_cut' }),
  row({ symbol_id: 's11', ticker: 'R11', exit_stage: 'selection_rules' }),
  row({ symbol_id: 's12', ticker: 'R12', exit_stage: 'selection_rules' }),
];

const stages: SelectionStage[] = [
  { key: 'universe', count: 12, dropped_from_prev: 8, applies: true },
  { key: 'selection_rules', count: 10, dropped_from_prev: 2, applies: true },
  { key: 'ranking', count: 5, dropped_from_prev: 5, applies: true },
  { key: 'weighting', count: 4, dropped_from_prev: 1, applies: true },
  { key: 'execution', count: 3, dropped_from_prev: 1, applies: true },
];

// ---------------------------------------------------------------------------
// (a) Conservación: filtrar rows por etapa reproduce el count que la etapa
// reporta, para las 5 etapas — este es el guard "la tabla nunca miente sobre
// el riel".
// ---------------------------------------------------------------------------
for (const s of stages) {
  eq(`(a) rowsAtStage('${s.key}').length === stages['${s.key}'].count`, rowsAtStage(rows, s.key).length, s.count);
}
// Total conservado de punta a punta: nadie desaparece sin etapa — el universo
// completo (12) es superset de cada etapa siguiente.
ok(
  '(a) universo ⊇ selection_rules ⊇ ranking ⊇ weighting ⊇ execution',
  STAGE_ORDER.every((k, i) => i === 0 || rowsAtStage(rows, STAGE_ORDER[i - 1]).length >= rowsAtStage(rows, k).length),
);

// ---------------------------------------------------------------------------
// (b) exit_stage: null == "En cartera", y NUNCA se cuenta como una etapa de
// salida — ni en la traducción de un valor puntual, ni en el filtrado por
// etapa (las 3 filas en null deben aparecer en las 5 vistas por etapa).
// ---------------------------------------------------------------------------
const inPortfolio = rows.filter((r) => r.exit_stage == null);
eq('(b) 3 filas en cartera (exit_stage: null)', inPortfolio.length, 3);
eq('(b) exitStageLabel(null) === "In portfolio"', exitStageLabel(null), 'In portfolio');
for (const s of STAGE_ORDER) {
  ok(
    `(b) las 3 filas "en cartera" sobreviven la vista de '${s}'`,
    inPortfolio.every((r) => rowsAtStage(rows, s).some((x) => x.symbol_id === r.symbol_id)),
  );
}
// Y el conteo de "en cartera" coincide con el count de la ÚLTIMA etapa
// (execution) — es literalmente la cartera resultante.
eq('(b) count("en cartera") === stages.execution.count', inPortfolio.length, stages[stages.length - 1].count);
// exitStageLabel de una etapa real SÍ traduce a su label, nunca a la clave cruda.
for (const s of STAGE_ORDER) {
  eq(`(b) exitStageLabel('${s}') === STAGE_LABELS['${s}']`, exitStageLabel(s), STAGE_LABELS[s]);
}

// ---------------------------------------------------------------------------
// (c) Los 8 códigos de reason del contrato traducen a texto legible — ninguno
// cae a un string crudo (snake_case) ni queda vacío.
// ---------------------------------------------------------------------------
const CONTRACT_REASONS: SelectionExitReason[] = [
  'top_n_cut',
  'per_sector_full',
  'below_floor',
  'no_price',
  'turnover_cap',
  'min_trade',
  'min_holding',
  'max_entries',
  'execution_skip',
];
for (const code of CONTRACT_REASONS) {
  const label = reasonLabel(code);
  ok(`(c) reasonLabel('${code}') traduce (no es el código crudo)`, label !== code, label);
  ok(`(c) reasonLabel('${code}') no tiene guiones bajos`, !label.includes('_'), label);
  ok(`(c) reasonLabel('${code}') no está vacío`, label.trim().length > 0);
}
eq('(c) reasonLabel(null) es un placeholder, no vacío', reasonLabel(null), '—');
// Un código desconocido (futuro, del lado del backend) se humaniza en vez de
// mostrarse crudo — defensivo, no forma parte del contrato de hoy.
ok('(c) código desconocido se humaniza igual', !reasonLabel('some_future_code').includes('_'));

// ---------------------------------------------------------------------------
// (d) Detección de empates: dispara cuando el tope del ranking comparte
// score, y NO dispara cuando los scores son distintos.
// ---------------------------------------------------------------------------
{
  const ties = detectRankingTies(rows);
  eq('(d) empate detectado (R1/R2 comparten score 3.0)', ties.tied, true);
  eq('(d) tiedCount cuenta las 2 filas empatadas en el tope', ties.tiedCount, 2);
  eq('(d) topScore es el mejor score visto', ties.topScore, 3.0);
}
{
  // Mismas 5 filas rankeadas, pero con scores estrictamente decrecientes: el
  // tope ya no empata con nadie.
  const noTieRows: SelectionRow[] = [
    row({ symbol_id: 't1', ticker: 'T1', rank: 1, score: 5.0 }),
    row({ symbol_id: 't2', ticker: 'T2', rank: 2, score: 4.0 }),
    row({ symbol_id: 't3', ticker: 'T3', rank: 3, score: 3.0 }),
  ];
  const ties = detectRankingTies(noTieRows);
  eq('(d) sin empate cuando los scores son todos distintos', ties.tied, false);
  eq('(d) tiedCount es 1 (solo el propio tope) sin empate', ties.tiedCount, 1);
}
{
  // Sin candidatos rankeados en absoluto (p.ej. universo entero cortado antes
  // de ranking) — no debe reventar, y no hay empate que reportar.
  const ties = detectRankingTies([]);
  eq('(d) sin filas rankeadas: no dispara y topScore es null', ties, { tied: false, topScore: null, tiedCount: 0 });
}

// ---------------------------------------------------------------------------
// (e) stageDropLabel: "no rules" para applies:false (el gris del diseño
// aprobado — la etapa NUNCA se oculta), "no change" para un applies:true sin
// caída, y la caída formateada para un applies:true con drop > 0.
// ---------------------------------------------------------------------------
eq('(e) applies:false -> "no rules"', stageDropLabel({ key: 'weighting', count: 30, dropped_from_prev: 0, applies: false }), 'no rules');
eq('(e) applies:true, drop 0 -> "no change"', stageDropLabel({ key: 'weighting', count: 30, dropped_from_prev: 0, applies: true }), 'no change');
eq('(e) applies:true, drop > 0 -> caída formateada', stageDropLabel({ key: 'ranking', count: 30, dropped_from_prev: 1155, applies: true }), '−1,155');

console.log(fail === 0 ? '\nTODO VERDE' : `\n${fail} FALLOS`);
process.exit(fail === 0 ? 0 : 1);
