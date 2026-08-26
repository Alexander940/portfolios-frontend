/**
 * Verificación ejecutable del round-trip de las reglas de rebalanceo (#154).
 *
 *     npx vite-node tests/checks/rebalance-rules-roundtrip.ts
 *
 * Existe porque este repo no tiene runner de tests unitarios y los e2e de
 * Playwright no arrancan en WSL (el navegador no puede lanzarse). Lo que se
 * protege es la parte con riesgo real y silencioso:
 *
 *   - una estrategia SIN reglas no debe ganar ninguna clave en `rebalance`
 *     (el backend las popea de canonical_json; emitir un null cambiaría el
 *     content_hash de los 225 specs guardados y rompería el dedupe);
 *   - las unidades: el formulario recoge PORCENTAJES y el spec lleva
 *     FRACCIONES. Un 25 que viaje como 25 en vez de 0.25 pediría un 2.500 %
 *     de turnover.
 */
import { DEFAULT_CONFIG, cfgToSpec, specToConfig, normalizeCfg } from '../../src/features/strategy-builder/mapping';
import type { BuilderConfig } from '../../src/features/strategy-builder/types';

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { console.log(`FAIL ${name}\n  got:  ${g}\n  want: ${w}`); fail++; }
  else console.log(`ok   ${name}`);
};

// 1) Config por defecto → la cláusula rebalance NO gana ninguna clave.
const base = cfgToSpec({ ...DEFAULT_CONFIG, name: 'X' } as BuilderConfig);
eq('sin reglas → solo cadence', Object.keys(base.rebalance).sort(), ['cadence']);

// 2) Unidades: % de UI → fracción del backend; multiplicadores y días sin tocar.
const withRules = cfgToSpec({
  ...DEFAULT_CONFIG, name: 'X',
  holdRankBuffer: 1.5, prioritizeHeld: true, minHoldingDays: 60,
  maxEntriesPerRebalance: 5, maxTurnoverPct: 25, cashBufferPct: 2.5,
  minTradePct: 0.5, driftBandPct: 5, stopLossPct: 20, trailingStopAtr: 3,
  exitOnStalePriceDays: 10,
} as BuilderConfig);
eq('hold_rank_buffer (multiplicador)', withRules.rebalance.hold_rank_buffer, 1.5);
eq('prioritize_held', withRules.rebalance.prioritize_held, true);
eq('min_holding_days (días)', withRules.rebalance.min_holding_days, 60);
eq('max_entries_per_rebalance', withRules.rebalance.max_entries_per_rebalance, 5);
eq('max_turnover_pct 25% → 0.25', withRules.rebalance.max_turnover_pct, 0.25);
eq('cash_buffer_pct 2.5% → 0.025', withRules.rebalance.cash_buffer_pct, 0.025);
eq('min_trade_pct 0.5% → 0.005', withRules.rebalance.min_trade_pct, 0.005);
eq('drift_band_pct 5pp → 0.05', withRules.rebalance.drift_band_pct, 0.05);
eq('stop_loss_pct 20% → 0.2', withRules.rebalance.stop_loss_pct, 0.2);
eq('trailing_stop_atr (múltiplos)', withRules.rebalance.trailing_stop_atr, 3);
eq('exit_on_stale_price_days (días)', withRules.rebalance.exit_on_stale_price_days, 10);

// 3) Round-trip completo spec → cfg → spec.
const back = specToConfig(withRules, 'X');
eq('vuelta: buffer', back.holdRankBuffer, 1.5);
eq('vuelta: turnover en %', back.maxTurnoverPct, 25);
eq('vuelta: cash buffer en %', back.cashBufferPct, 2.5);
eq('vuelta: stop en %', back.stopLossPct, 20);
eq('round-trip idéntico', cfgToSpec(back).rebalance, withRules.rebalance);

// 4) Un spec LEGADO (sin reglas) round-trippea sin ganar claves — el guard del content_hash.
const legacy = { ...base, rebalance: { cadence: 'weekly' as const } };
eq('legado weekly → sigue solo cadence',
   Object.keys(cfgToSpec(specToConfig(legacy, 'X')).rebalance).sort(), ['cadence']);

// 5) Valores basura de un config viejo no llegan al spec.
const garbage = normalizeCfg({ ...DEFAULT_CONFIG, name: 'X',
  holdRankBuffer: 0.9 as number, maxTurnoverPct: '' } as BuilderConfig);
eq('buffer inválido (≤1) no se emite',
   'hold_rank_buffer' in cfgToSpec(garbage).rebalance, false);

console.log(fail === 0 ? '\nTODO VERDE' : `\n${fail} FALLOS`);
process.exit(fail === 0 ? 0 : 1);
