// Oráculo de identidad de #209: con UNA manga al 100 %, la transformación del
// gráfico debe devolver, punto a punto, la misma serie para el compuesto y para
// la hija (base 100 y capital). Fixture con la forma del contrato de #206.
//
// El repo no tiene runner de tests unitarios (y esta historia no podía agregar
// dependencias), así que el oráculo se corre a mano compilando el módulo puro:
//
//   npx tsc src/features/portfolio/lib/compositeCurve.ts --outDir /tmp/oracle-209 \
//       --module commonjs --target es2022 --skipLibCheck
//   cp docs/loops-history/issue-209/identity_oracle.cjs /tmp/oracle-209/
//   node /tmp/oracle-209/identity_oracle.cjs
//
// Sale 0 con todos los checks en verde.
const { buildCompositeChartRows, capitalKey } = require('./compositeCurve.js');

function mkCurve(start, values, benchStart) {
  // fechas hábiles ficticias correlativas YYYY-MM-DD (sin fines de semana reales:
  // solo hacen de clave, la transformación no interpreta el calendario)
  const out = [];
  const d = new Date(start + 'T00:00:00Z');
  for (let i = 0; i < values.length; i++) {
    out.push({
      date: d.toISOString().slice(0, 10),
      total_value: values[i],
      benchmark_value: benchStart == null ? null : benchStart * (1 + 0.0003 * i),
    });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

let failures = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
};

// ---- Fixture: la hija cubre 2016-01-04..(70 días); el compuesto es la ventana
// común (arranca 10 días después y termina 5 antes), con los MISMOS valores.
const childValues = [];
let v = 100000;
for (let i = 0; i < 70; i++) {
  v *= 1 + ((i % 7) - 3) * 0.0021; // serie con subidas y bajadas
  childValues.push(v);
}
const child = mkCurve('2016-01-04', childValues, 200);
const composite = child.slice(10, 65).map((p) => ({ ...p })); // ventana común

const rows = buildCompositeChartRows(composite, [
  { key: 'sleeve0', label: 'GROW IA BUILDER', points: child },
]);

check('filas = puntos del compuesto', rows.length === composite.length,
  `${rows.length} filas`);

let maxIdx = 0, maxCap = 0;
for (const r of rows) {
  maxIdx = Math.max(maxIdx, Math.abs(r.portfolio - r.sleeve0));
  // relativo: (v/base)*base no vuelve al bit exacto en punto flotante
  maxCap = Math.max(maxCap,
    Math.abs(r.totalValue - r[capitalKey('sleeve0')]) / Math.abs(r.totalValue));
}
check('base 100: compuesto == hija punto a punto (exacto)', maxIdx === 0,
  `desvío máx = ${maxIdx}`);
check('capital: compuesto == hija punto a punto (rel < 1e-12)', maxCap < 1e-12,
  `desvío relativo máx = ${maxCap}`);
check('la serie arranca en 100', Math.abs(rows[0].portfolio - 100) < 1e-12 &&
  Math.abs(rows[0].sleeve0 - 100) < 1e-12);
check('la hija se recorta a la ventana común',
  rows[0].date === composite[0].date && rows[rows.length - 1].date === composite[composite.length - 1].date,
  `${rows[0].date} → ${rows[rows.length - 1].date}`);

// ---- Misma identidad cuando el compuesto viene escalado a otro capital inicial
const scaled = composite.map((p) => ({ ...p, total_value: p.total_value * 2.5 }));
const rows2 = buildCompositeChartRows(scaled, [
  { key: 'sleeve0', label: 'GROW IA BUILDER', points: child },
]);
let maxIdx2 = 0, maxCap2 = 0;
for (const r of rows2) {
  maxIdx2 = Math.max(maxIdx2, Math.abs(r.portfolio - r.sleeve0));
  maxCap2 = Math.max(maxCap2, Math.abs(r.totalValue - r[capitalKey('sleeve0')]));
}
check('compuesto escalado ×2,5: base 100 sigue idéntica', maxIdx2 < 1e-12,
  `desvío máx = ${maxIdx2}`);
check('compuesto escalado ×2,5: capital re-anclado al compuesto', maxCap2 < 1e-6,
  `desvío máx = ${maxCap2}`);

// ---- Dos mangas: la que no cubre una fecha deja hueco (null), no cero
const child2 = mkCurve('2016-01-20', childValues.slice(0, 40), null);
const rows3 = buildCompositeChartRows(composite, [
  { key: 'sleeve0', label: 'A', points: child },
  { key: 'sleeve1', label: 'B', points: child2 },
]);
const nulls = rows3.filter((r) => r.sleeve1 === null).length;
check('manga con menos historia → null (hueco), nunca 0',
  nulls > 0 && rows3.every((r) => r.sleeve1 === null || r.sleeve1 > 0),
  `${nulls} de ${rows3.length} filas sin dato de la manga B`);
check('benchmark rebasado a 100 en el primer punto',
  Math.abs(rows[0].benchmark - 100) < 1e-12);
check('curva vacía → sin filas', buildCompositeChartRows([], []).length === 0);

console.log(failures === 0 ? '\nOK — todos los checks verdes' : `\n${failures} check(s) en rojo`);
process.exit(failures === 0 ? 0 : 1);
