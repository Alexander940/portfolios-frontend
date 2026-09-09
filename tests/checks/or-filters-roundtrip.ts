/**
 * Verificación ejecutable del round-trip de los grupos OR (#173).
 *
 *     npx vite-node tests/checks/or-filters-roundtrip.ts
 *
 * Existe por la misma razón que `rebalance-rules-roundtrip.ts`: el navegador
 * de Playwright no arranca en este WSL, así que los e2e (`tests/e2e/
 * builder-or-filters.spec.ts`) se escriben pero no se pueden ejecutar aquí.
 * Lo que se protege es el riesgo real y silencioso de esta fase:
 *
 *   - una config SIN grupos no debe ganar la clave `any_of` en ninguno de los
 *     dos screens (universo y selection_filters) — eso cambiaría el
 *     content_hash de las 21 estrategias reales guardadas hoy, TODAS sin
 *     grupos, y rompería el dedupe de backtests;
 *   - un grupo de 2 opciones y otro de 3 deben sobrevivir cfg → spec → cfg →
 *     spec sin perder ni añadir nada — ni una opción, ni un campo, ni la
 *     distinción entre reglas sueltas y agrupadas;
 *   - un grupo de 1 opción (el mínimo del backend es 2) no debe llegar al
 *     spec, y el formulario debe marcarlo como inválido si de algún modo
 *     aparece en una config guardada a mano;
 *   - reglas sueltas + un grupo deben convivir: las sueltas siguen en el
 *     nivel plano del screen, el grupo va a `any_of`, y ninguna de las dos
 *     formas contamina a la otra.
 */
import {
  cfgToSpec,
  DEFAULT_CONFIG,
  findDuplicateRuleKeys,
  mergeSpecPreserving,
  normalizeCfg,
  ruleListError,
  specToConfig,
} from '../../src/features/strategy-builder/mapping';
import type {
  BuilderConfig,
  FilterGroup,
  FundamentalFilter,
  RuleEntry,
  StrategySpec,
  UniverseSpec,
} from '../../src/features/strategy-builder/types';
import { isFilterGroup } from '../../src/features/strategy-builder/types';

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

const rating = (min: number): FundamentalFilter => ({ key: 'rating', type: 'range', min, max: '' });
const peRatio = (max: number): FundamentalFilter => ({ key: 'pe_ratio', type: 'range', min: '', max });
const trendStrength = (min: number): FundamentalFilter => ({
  key: 'trend_strength',
  type: 'range',
  min,
  max: '',
});
const smartMomentum = (min: number): FundamentalFilter => ({
  key: 'smart_momentum',
  type: 'range',
  min,
  max: '',
});
const returnYtd = (min: number): FundamentalFilter => ({ key: 'return_ytd', type: 'range', min, max: '' });
const group = (...options: FundamentalFilter[][]): FilterGroup => ({
  id: `g_${Math.random().toString(36).slice(2)}`,
  options,
});

// ---------------------------------------------------------------------------
// (a) Config SIN grupos → `any_of` no aparece en ninguno de los dos screens.
// ---------------------------------------------------------------------------
{
  const cfgNoGroups: BuilderConfig = {
    ...DEFAULT_CONFIG,
    name: 'X',
    additionalRules: [rating(1), peRatio(30)],
    selectionFilters: [returnYtd(0)],
  };
  const spec = cfgToSpec(cfgNoGroups);
  ok('(a) sin grupos → universe sin any_of', !('any_of' in spec.universe), JSON.stringify(spec.universe));
  ok(
    '(a) sin grupos → selection_filters sin any_of',
    !!spec.selection_filters && !('any_of' in spec.selection_filters),
    JSON.stringify(spec.selection_filters),
  );
  // Reglas sueltas normales siguen intactas (no se rompió nada de #98/#154).
  eq('(a) rating plano intacto', spec.universe.rating, { min: 1 });
  eq('(a) pe_ratio plano intacto', spec.universe.pe_ratio, { max: 30 });
}

// ---------------------------------------------------------------------------
// (b) Un grupo de 2 y otro de 3 opciones round-trippean cfg → spec → cfg → spec.
// ---------------------------------------------------------------------------
{
  const groupOf2 = group([trendStrength(2)], [smartMomentum(5)]);
  const groupOf3 = group([returnYtd(0)], [returnYtd(-5)], [returnYtd(10)]);
  const cfgWithGroups: BuilderConfig = {
    ...DEFAULT_CONFIG,
    name: 'X',
    additionalRules: [rating(1), groupOf2],
    selectionFilters: [groupOf3],
  };
  const spec = cfgToSpec(cfgWithGroups);

  ok('(b) universe.any_of presente', Array.isArray(spec.universe.any_of));
  eq('(b) universe.any_of: 1 grupo de 2 opciones', spec.universe.any_of?.length, 1);
  eq(
    '(b) universe.any_of[0].options',
    spec.universe.any_of?.[0].options,
    [{ trend_strength: { min: 2 } }, { smart_momentum: { min: 5 } }],
  );
  eq('(b) rating plano sigue fuera del grupo', spec.universe.rating, { min: 1 });
  ok('(b) universe NO tiene trend_strength/smart_momentum planos', !('trend_strength' in spec.universe) && !('smart_momentum' in spec.universe));

  ok('(b) selection_filters.any_of: 1 grupo de 3 opciones', spec.selection_filters?.any_of?.length === 1);
  eq(
    '(b) selection_filters.any_of[0].options (3)',
    spec.selection_filters?.any_of?.[0].options,
    [{ return_ytd: { min: 0 } }, { return_ytd: { min: -5 } }, { return_ytd: { min: 10 } }],
  );

  // spec → cfg: los grupos vuelven reconstruidos (loose primero, luego grupos).
  const back = specToConfig(spec, 'X');
  const backAdditionalGroups = back.additionalRules.filter(isFilterGroup);
  const backSelectionGroups = back.selectionFilters.filter(isFilterGroup);
  eq('(b) vuelta: 1 grupo en additionalRules', backAdditionalGroups.length, 1);
  eq('(b) vuelta: el grupo tiene 2 opciones', backAdditionalGroups[0]?.options.length, 2);
  eq(
    '(b) vuelta: opciones del grupo (additionalRules)',
    backAdditionalGroups[0]?.options.map((o) => o.map((f) => ({ key: f.key, min: f.min, max: f.max }))),
    [
      [{ key: 'trend_strength', min: 2, max: '' }],
      [{ key: 'smart_momentum', min: 5, max: '' }],
    ],
  );
  eq('(b) vuelta: rating plano sigue suelto', back.additionalRules.some((r) => !isFilterGroup(r) && r.key === 'rating'), true);
  eq('(b) vuelta: 1 grupo en selectionFilters', backSelectionGroups.length, 1);
  eq('(b) vuelta: el grupo tiene 3 opciones', backSelectionGroups[0]?.options.length, 3);

  // cfg → spec de la vuelta: el spec vuelve a ser BYTE-A-BYTE el mismo — el
  // guard real contra que specToConfig/cfgToSpec diverjan silenciosamente.
  const spec2 = cfgToSpec(back);
  eq('(b) round-trip completo: universe idéntico', spec2.universe, spec.universe);
  eq('(b) round-trip completo: selection_filters idéntico', spec2.selection_filters, spec.selection_filters);
}

// ---------------------------------------------------------------------------
// (c) Un grupo de 1 opción no se emite, y la validación del form lo rechaza.
// ---------------------------------------------------------------------------
{
  const badGroup: FilterGroup = { id: 'g_bad', options: [[rating(1)]] };
  const cfgBadGroup: BuilderConfig = {
    ...DEFAULT_CONFIG,
    name: 'X',
    additionalRules: [badGroup],
  };
  const spec = cfgToSpec(cfgBadGroup);
  ok('(c) grupo de 1 opción → any_of NO se emite', !('any_of' in spec.universe), JSON.stringify(spec.universe));
  ok('(c) grupo de 1 opción → universe queda vacío salvo country', Object.keys(spec.universe).sort().join(',') === 'country');

  const err = ruleListError(cfgBadGroup.additionalRules);
  ok('(c) ruleListError rechaza el grupo de 1 opción', !!err && /at least 2/.test(err), err);

  // La UI normal (FundamentalFilterGroup) nunca produce este estado — lo
  // confirma normalizeCfg dejándolo pasar sin reventar (solo el spec lo
  // silencia) y la validación arriba marcándolo, no un crash.
  const normalized = normalizeCfg(cfgBadGroup);
  ok('(c) normalizeCfg no revienta con un grupo inválido', Array.isArray(normalized.additionalRules));
}

// ---------------------------------------------------------------------------
// (d) Reglas sueltas + un grupo conviven sin pisarse.
// ---------------------------------------------------------------------------
{
  const g = group([peRatio(15)], [peRatio(50)]); // barbell: PE<15 OR PE>50 (mismo campo, dos alternativas)
  const cfgMixed: BuilderConfig = {
    ...DEFAULT_CONFIG,
    name: 'X',
    additionalRules: [rating(1), trendStrength(0), g],
  };
  const spec = cfgToSpec(cfgMixed);
  eq('(d) reglas sueltas siguen en el nivel plano', {
    rating: spec.universe.rating,
    trend_strength: spec.universe.trend_strength,
  }, { rating: { min: 1 }, trend_strength: { min: 0 } });
  ok('(d) el grupo va a any_of, no al nivel plano', Array.isArray(spec.universe.any_of) && spec.universe.any_of.length === 1);
  eq(
    '(d) el grupo reutiliza el mismo campo en 2 alternativas (barbell)',
    spec.universe.any_of?.[0].options,
    [{ pe_ratio: { max: 15 } }, { pe_ratio: { max: 50 } }],
  );

  const back = specToConfig(spec, 'X');
  const looseKeys = back.additionalRules.filter((r) => !isFilterGroup(r)).map((r) => (r as FundamentalFilter).key).sort();
  eq('(d) vuelta: reglas sueltas reconstruidas', looseKeys, ['rating', 'trend_strength']);
  eq('(d) vuelta: 1 grupo reconstruido', back.additionalRules.filter(isFilterGroup).length, 1);
  eq('(d) round-trip cfg→spec→cfg→spec idéntico', cfgToSpec(back).universe, spec.universe);
}

// ---------------------------------------------------------------------------
// Bonus — el defecto de claves duplicadas (#173 item 4) ahora es detectable,
// y ya NO se pisa en silencio: la primera regla gana, determinística.
// ---------------------------------------------------------------------------
{
  const dupRules: RuleEntry[] = [peRatio(10), peRatio(50)]; // dos reglas SUELTAS, mismo campo
  eq('(bonus) findDuplicateRuleKeys detecta el choque', findDuplicateRuleKeys(dupRules), ['pe_ratio']);
  const err = ruleListError(dupRules);
  ok('(bonus) ruleListError lo reporta', !!err && /Duplicate/.test(err), err);

  const cfgDup: BuilderConfig = { ...DEFAULT_CONFIG, name: 'X', additionalRules: dupRules };
  const universe: UniverseSpec = cfgToSpec(cfgDup).universe;
  eq('(bonus) addFilters no pisa en silencio: gana la PRIMERA regla', universe.pe_ratio, { max: 10 });

  // Claves repetidas ENTRE alternativas del MISMO grupo (barbell) no cuentan
  // como el defecto — son mini-screens independientes, no una colisión.
  const legitBarbell: RuleEntry[] = [group([peRatio(10)], [peRatio(50)])];
  eq('(bonus) el barbell dentro de un grupo NO se marca como duplicado', findDuplicateRuleKeys(legitBarbell), []);
}

// ---------------------------------------------------------------------------
// Bonus — mergeSpecPreserving (the real edit-and-resave path a server-
// persisted strategy goes through) treats `any_of` like `layered`: the form
// owns it end-to-end, so an unrelated edit keeps it, ungrouping in the form
// drops it, and a field the form can't express at all (live-only) survives
// either way.
// ---------------------------------------------------------------------------
{
  const original: StrategySpec = {
    general: { instrument_type: 'stocks', currency: 'USD', benchmark: 'SPY', performance_metric: 'total_return' },
    universe: {
      country: ['US'],
      rating: { min: 1 },
      any_of: [{ options: [{ trend_strength: { min: 2 } }, { smart_momentum: { min: 5 } }] }],
    },
    entry_exit: {
      mode: 'trade_state', min_er: 0.3, max_sm_atr_mult: 10, atr_spike_mult: 2,
      trail_atr_mult: 3, emergency_atr_mult: 4, exit_rating_long: -1, exit_rating_short: 1,
      use_trail_stop: false,
    },
    selection: { sort_by: 'rating', sort_order: 'desc', top_n: 25 },
    weighting: { method: 'equal' },
    costs: { commission_bps: 5, slippage_bps: 8 },
    validation: { start: '2024-01-02', end: '2024-06-28', oos_split: 0.2, min_n_trades: 30 },
  };

  const cfg = specToConfig(original, 'X');
  const unchanged = mergeSpecPreserving(original, cfgToSpec(cfg));
  eq('(merge) resave sin tocar nada conserva any_of', unchanged.universe.any_of, original.universe.any_of);

  const ungroupedCfg: BuilderConfig = {
    ...cfg,
    additionalRules: cfg.additionalRules.flatMap((r) => (isFilterGroup(r) ? r.options.flat() : [r])),
  };
  const afterUngroup = mergeSpecPreserving(original, cfgToSpec(ungroupedCfg));
  ok('(merge) ungroup en el form borra any_of del spec guardado', !('any_of' in afterUngroup.universe));
  eq('(merge) ungroup conserva los campos sueltos', {
    trend_strength: afterUngroup.universe.trend_strength,
    smart_momentum: afterUngroup.universe.smart_momentum,
  }, { trend_strength: { min: 2 }, smart_momentum: { min: 5 } });
}

console.log(fail === 0 ? '\nTODO VERDE' : `\n${fail} FALLOS`);
process.exit(fail === 0 ? 0 : 1);
