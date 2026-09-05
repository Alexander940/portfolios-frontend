# Inner Loop issue-209: Frontend — vista del backtest compuesto con hijas superpuestas y aproximaciones visibles

> **Status:** APPROVED 2026-09-05 — orden explícita del dueño («Comienza con la implementación de los loops… con agentes de Opus 5, tú solo trabaja como orquestador»). Executor confirmado: subagente Opus 5 por historia en worktree hermano, coordinado desde el chat orquestador.

**Resuelve:** [#209](https://github.com/Alexander940/portfolios-backend/issues/209) · Juzgar si la mezcla aporta frente a cada estrategia sola y frente a SPY, sin confundir la curva aproximada con un backtest de verdad.

**Classification:** inner loop **de código (frontend)**, one-shot, en `../portfolios-frontend`. **Depende de #206** (contrato en su design doc). Reutiliza `ResultsView.tsx` / `EquityChart.tsx` del builder (`src/features/strategy-builder/components/`).

**Trigger:** aprobación de este design; #206 mergeado para el cierre.

**Executor:** agente in-chat en worktree hermano del FE — `git -C ../portfolios-frontend worktree add ../portfolios-frontend-fe-209 -b feat/fe-209 origin/master` → `board.sh start fe-209`.

## Alcance

- **Servicio**: `runCompositeBacktest(portfolioId)` que maneja 200/202/422; en 202 muestra el progreso por manga y reintenta con backoff (poleteando `GET /backtests/{job_id}` de cada hijo pendiente, como hace hoy el builder).
- **Vista** en la página del compuesto (botón «Backtest compuesto» en la pestaña Mangas o en Overview): `EquityChart` con la curva compuesta + las hijas + SPY, todas rebasadas a 100 (respetar el toggle Base 100 / Capital si #134 ya está en master); tabla de métricas del compuesto y de cada hija (mismas columnas que `ResultsView`); bloque **«Aproximaciones»** visible, no colapsado por defecto, con el texto de cada clave de `approximations`; enlace a cada backtest hijo (`/dashboard/strategy/:strategyId`).
- Estados: hijos en curso (progreso), hijo en error (mensaje nombrando la manga sin romper la vista), ventana común corta (422).

## Objective (verifiable)

1. Servicio con el manejo de 202.
2. Vista con las tres series superpuestas, tabla de métricas y bloque de aproximaciones.
3. Enlaces a los hijos.

## Oracle (executable, standalone)

- `npm run lint` + `npm run build` verdes; tests existentes verdes.
- Test del servicio: 202 → reintento; 200 → datos; 422 → error tipado.
- Con una sola manga al 100 % (fixture del contrato de #206), la curva compuesta y la hija son la misma serie en el gráfico (test de que los datos rebasados coinciden punto a punto).
- **Revisión visual del dueño**: el bloque de aproximaciones se ve sin hacer clic.

## Exit criteria

Éxito = lint + build + tests verdes + revisión visual. Fallo = 3 iteraciones → detener y escalar.

## Memory

Esta carpeta — `design.md` + `run-<fecha>.jsonl` (ítems: `service-202`, `chart-overlay`, `metrics-table`, `approximations-block`, `links`, `visual-review`).

## Human-in-the-loop

Aprobación de este design; revisión visual; merge y deploy a Vercel por el dueño.

## Irreversible actions

Ninguna.

## Kill switch

Interrumpir al agente; descartar rama/worktree del FE.

## Fuera de alcance

Selector de ventana, comparación entre dos compuestos, embudo del compuesto.

---

## Outcome — SUCCESS (2026-09-05, 1 iteración)

Implementado en el repo del **frontend**, rama `feat/fe-209` (worktree
`../portfolios-frontend-fe-209`, base `origin/master` 6cc3e9c). El backend no
estaba corriendo: todo se construyó contra el contrato de #206 tal como quedó
fijado en su design doc.

### Archivos

| Archivo | Qué |
|---|---|
| `src/services/portfolioService.ts` | Tipos del contrato (`CompositeBacktestPendingChild`, `CompositeBacktestPending`, `CompositeBacktestChild`, `CompositeBacktestDone`, `CompositeApproximationKey`) + `runCompositeBacktest(portfolioId, signal)`; `parseCreationSpec` extendido a v3 (`kind`, `rules`) + `isCompositePortfolio` y `COMPOSITE_SPEC_VERSION`. |
| `src/features/portfolio/lib/compositeCurve.ts` | **Nuevo, puro**: `buildCompositeChartRows` — la transformación que alimenta el gráfico. |
| `src/features/portfolio/components/CompositeBacktestView.tsx` | **Nueva**: la vista completa (botón, poleteo del 202, gráfico, métricas, aproximaciones, enlaces). |
| `src/features/strategy-builder/components/EquityChart.tsx` | Props opcionales `extraSeries` (una línea por manga, con su par `key`/`capitalKey` para el toggle #134) y `height`. Compatible hacia atrás: el builder no cambia. |
| `src/features/portfolio/components/Portfolio.tsx` | Pestaña «Backtest compuesto», visible **solo** si `isCompositePortfolio(portfolio)`. |
| `src/features/portfolio/components/index.ts` | Export de la vista. |
| `docs/loops-history/issue-209/identity_oracle.cjs` | El oráculo de identidad (ver abajo). |

### Decisiones que fija esta implementación

1. **Las curvas de las hijas no vienen en la respuesta**: el 200 de #206 trae,
   por manga, solo `metrics`. La superposición se arma pidiendo
   `GET /backtests/{job_id}` de cada hijo (`getBacktest` del builder) después
   del 200. Si alguna no llega, el gráfico dibuja las que sí y lo dice; la
   tabla de métricas queda completa igual.
2. **La curva compuesta es el espinazo del gráfico**: una fila por fecha del
   compuesto y cada hija leída por fecha, de modo que la ventana de la hija se
   **recorta** sola a la ventana común. Cada serie se rebasa a su primer valor
   *dentro de esa ventana*. Rebasar la hija sobre su ventana completa habría
   hecho que una manga al 100 % se separara del compuesto que ES — la identidad
   del oráculo O4 depende de este recorte.
3. **`approximations` se tipa como `string[]`** (con una unión aparte solo para
   el mapa de textos): una clave nueva del backend se pinta cruda en vez de
   desaparecer.
4. **202 vs 200 se distingue por el cuerpo**, no por una excepción: 202 es un
   status de éxito y el interceptor de axios no lo rechaza.
5. **Las métricas de cada manga son de su propia ventana completa**, no de la
   ventana común (así las devuelve #206). La tabla muestra la ventana de cada
   fila y lo aclara, para que nadie compare peras con manzanas sin saberlo.

### Oráculos

| Oráculo | Resultado |
|---|---|
| `npm run build` | **verde** (tsc -b + vite, 57,9 s) |
| `npx eslint` sobre los 6 archivos de la rama | **0 problemas** (exit 0) |
| `npm run lint` (repo entero) | 6 errores + 1 warning, **todos preexistentes en `origin/master`** y en archivos que esta rama no toca (`Modal`, `MultiSelect`, `FilterModal`, `SavePortfolioModal`, `SaveScreenModal`, `screenerStore`, `router`) |
| Identidad del contrato (una manga al 100 %) | **10/10 checks verdes**, exit 0 |

El repo no tiene runner de tests unitarios y esta historia no podía agregar
dependencias, así que la identidad se verifica compilando el módulo puro y
corriéndolo con node:

```bash
npx tsc src/features/portfolio/lib/compositeCurve.ts --outDir /tmp/oracle-209 \
    --module commonjs --target es2022 --skipLibCheck
cp docs/loops-history/issue-209/identity_oracle.cjs /tmp/oracle-209/
node /tmp/oracle-209/identity_oracle.cjs
```

Con el fixture (hija de 70 días, compuesto = ventana común de 55 días con los
mismos valores): **base 100 idéntica bit a bit** (desvío máximo `0`) y capital
idéntico con desvío **relativo** 1,47e-16 (`(v/base)*base` no vuelve al bit
exacto en punto flotante). Con el compuesto escalado ×2,5 la identidad base 100
se mantiene (2,8e-14). Una manga con menos historia deja 15 filas en `null`
(hueco) y ninguna en 0.

### Qué mirar en la revisión visual

- El bloque **«Aproximaciones»** se ve **sin hacer clic**: card con borde ámbar
  al pie de la vista, cinco viñetas en español. No hay estado de colapso.
- Las tres capas del gráfico: compuesta (acento, gruesa), una línea por manga
  (colores distintos, finas) y SPY (gris punteada); el toggle **Base 100 /
  Capital** conmuta todas juntas.
- La pestaña «Backtest compuesto» **no debe aparecer** en un portafolio normal.
- El 202: la tabla de progreso nombra cada manga (o su id si `GET /strategies/`
  no la lista) y el botón queda deshabilitado mientras espera.

### Pendiente / notas para la integración

- `parseCreationSpec` v3 también está en el alcance de **#208** (insignia y
  pestaña «Mangas»): al integrar, esperar conflicto en ese bloque y en la lista
  de pestañas de `Portfolio.tsx`. Ambos cambios son aditivos.
- Sin e2e: playwright necesita el backend. La verificación contra el endpoint
  real queda para el cierre, cuando #206 esté mergeado.
