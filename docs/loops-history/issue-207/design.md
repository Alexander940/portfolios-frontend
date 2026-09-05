# Inner Loop issue-207: Frontend — modal «Crear desde estrategias» con asignaciones, reglas y previsualización

> **Status:** APPROVED 2026-09-05 — orden explícita del dueño («Comienza con la implementación de los loops… con agentes de Opus 5, tú solo trabaja como orquestador»). Executor confirmado: subagente Opus 5 por historia en worktree hermano, coordinado desde el chat orquestador.

**Resuelve:** [#207](https://github.com/Alexander940/portfolios-backend/issues/207) · La superficie donde el usuario elige estrategias, reparte el 100 % y ve el compuesto antes de comprarlo.

**Classification:** inner loop **de código (frontend)**, one-shot, en el repo `../portfolios-frontend` (React 19 + Vite + TS). **Depende de #202** (contrato JSON fijado en su design doc; el FE puede arrancar contra ese contrato con un mock y cerrar contra el backend mergeado).

**Trigger:** aprobación de este design; #202 mergeado para el cierre.

**Executor:** agente in-chat en worktree hermano del FE — `git -C ../portfolios-frontend worktree add ../portfolios-frontend-fe-207 -b feat/fe-207 origin/master` (el `master` local del FE va 14 commits atrás) → `board.sh start fe-207` en el tablero del backend (el FE no tiene tablero; se registra acá con el worktree del FE en la nota).

## Alcance

- **Servicio** (`src/services/portfolioService.ts`, al lado de `createPortfolioFromScreener`): `previewPortfolioFromStrategies(body)` y `createPortfolioFromStrategies(body)`; tipos `SleeveAllocation`, `CompositeRules`, `PortfolioFromStrategiesResponse` espejo del contrato de #202.
- **Modal** `CreateFromStrategiesModal` en `src/features/portfolio/components/`, abierto desde la vista de portafolios (`PortfoliosTable.tsx` / botón de creación existente). Tres pasos en un mismo modal: (1) selección múltiple de estrategias propias (`GET /strategies/`: nombre, versión, `top_n`, cadencia); (2) asignaciones con control que obliga Σ = 100 % (sliders o inputs con "repartir en partes iguales"), reglas (`max_position_weight`, `cash_buffer_pct`) e `initial_cash`; (3) previsualización: riel de mangas (asignación, cobertura, nombres), tabla de nombres con peso final y chips de las mangas de origen, sección «Solapamiento» (nombres en ≥ 2 mangas), excluidos con razón, caja resultante y warnings.
- **Confirmar** → `POST /from-strategies` → navegar a `/dashboard/analysis/:portfolioId`.
- Estados: cargando, 422 con el mensaje del backend (cobertura baja nombrando la manga, Σ ≠ 1), 404 de estrategia ajena.

## Objective (verifiable)

1. Servicio + tipos.
2. Modal con los tres pasos y el botón de confirmar deshabilitado hasta que Σ = 100 % y haya ≥ 2 estrategias.
3. La previsualización y la respuesta de creación muestran los mismos nombres y pesos (el FE no recalcula nada; solo pinta).

## Oracle (executable, standalone)

- `npm run lint` y `npm run build` (tsc) en verde en el worktree del FE; `npm test` si el proyecto tiene tests (mantener los existentes en verde).
- Test de componente (Vitest/RTL si existe en el repo; si no, un test mínimo de la función de validación de asignaciones): Σ ≠ 100 → deshabilitado; < 2 estrategias → deshabilitado; 100 → habilitado.
- **Revisión visual del dueño** (lección de #173: build y lint no dicen si la pantalla se entiende): captura del paso 3 con un caso con solapamiento.

## Exit criteria

Éxito = lint + build verdes + revisión visual aprobada. Fallo = 3 iteraciones → detener y escalar.

## Memory

Esta carpeta (en el repo backend, como el resto de la épica) — `design.md` + `run-<fecha>.jsonl` (ítems: `service`, `modal-select`, `modal-allocations`, `modal-preview`, `confirm`, `visual-review`).

## Human-in-the-loop

Aprobación de este design; revisión visual; merge en el FE por el dueño; deploy a Vercel fuera del loop.

## Irreversible actions

Ninguna.

## Kill switch

Interrumpir al agente; descartar rama/worktree del FE.

## Fuera de alcance

Editar mangas después de crear (#208), backtest compuesto (#209), estrategias compartidas por otros usuarios.

---

## Outcome — SUCCESS (2026-09-05, 1 iteración)

Implementado en el repo **frontend**, worktree `portfolios-frontend-fe-207`, rama `feat/fe-207` (base `origin/master` 6cc3e9c). Los dos oráculos ejecutables salieron verdes en la **primera** iteración.

### Commits

- `feat(portfolios): modal «Crear desde estrategias» — portafolio compuesto (#207)`
- `docs(loops): outcome de #207`

### Archivos

| Archivo | Qué es |
|---|---|
| `src/services/portfolioService.ts` | **+183 líneas** al final: bloque «Composite portfolio» con los tipos espejo del contrato de #202 (`SleeveAllocation`, `CompositeRules`, `PortfolioFromStrategiesCreate`, `PortfolioFromStrategiesResponse`, `CompositeSleeveResult`, `CompositeHolding`, `CompositeHoldingSleeve`, `CompositeOverlapItem`, `CompositeExcludedItem`, `CompositeCadence`, `CompositeRebalanceOn`, `CompositeOverlapPolicy`, `CompositeExcludedReason`) + `previewPortfolioFromStrategies()` y `createPortfolioFromStrategies()` |
| `src/features/portfolio/lib/sleeves.ts` | **nuevo**, 183 líneas, puro (sin React, sin DB): `splitEvenly`, `sumAllocations`, `isBalanced`, `toAllocationFractions`, `pctToFraction`, `parseOptionalNumber`, `buildSleeves`, `validateCompositeDraft`, `fmtCoverage` + las constantes `MIN_SLEEVES`/`MAX_SLEEVES`/`MIN_INITIAL_CASH`/`ALLOCATION_TOLERANCE_PP` |
| `src/features/portfolio/components/CreateFromStrategiesModal.tsx` | **nuevo**: el modal de tres pasos |
| `src/features/portfolio/components/index.ts` | exporta el modal |
| `src/features/portfolio/components/PortfoliosTable.tsx` | prop `onCreateFromStrategiesClick` + botón «Create from Strategies» (cabecera de la tarjeta y estado vacío) |
| `src/features/portfolio/components/Portfolio.tsx` | estado del modal, montaje detrás de `showImport` (solo la vista «Mis portafolios») |

### Los tres pasos

1. **select** — `GET /strategies/` (se reusa `listStrategies` del strategy-builder en vez de duplicar el DTO del endpoint; el import cross-feature está justificado en un comentario). Cada fila: nombre, `v{latest_version}`, chip `Top {top_n} · {cadencia}` y descripción. Tope duro de 10 (las no seleccionadas se deshabilitan al llegar); «Next» exige ≥ 2.
2. **allocate** — una fila por manga con input en % + «Split evenly», totalizador verde/rojo, reglas (`cadence`, `max_position_weight` %, `cash_buffer_pct` %) y nombre/descripción/`initial_cash`. **El re-reparto equitativo se dispara solo al cambiar la selección**: así Σ = 100 % por construcción y el camino feliz nunca queda inválido.
3. **preview** — `POST /from-strategies/preview` y se pinta lo que vuelve: cuatro celdas de resumen (posiciones, caja, fecha de precios, nº de mangas), riel horizontal de mangas (asignación, peso en el compuesto, nombres/elegibles, cobertura, `data_as_of`, warnings propios), tabla de nombres (ticker, chips coloreados de las mangas de origen con su aporte, precio, acciones, valor, peso realizado + target), sección «Overlap», «Left out or trimmed» con la razón legible y la lista de warnings.

**El FE no recalcula ningún peso** (objetivo 3 del design): `weight_pct`, `weight_realized_pct`, `cash_pct` y `target_weight_pct` se pintan tal cual; lo único que el cliente calcula es el reparto de las asignaciones que él mismo pide.

### Puerta del botón de confirmar

`validateCompositeDraft` (en `sleeves.ts`, pura) es la única puerta: 2–10 mangas, ids únicos, cada asignación en (0, 100 %], Σ = 100 % ± 0,005 pp, nombre no vacío, `initial_cash ≥ 1000`, cap en (0, 100 %] y buffer en (0, 100 %) exclusivo. «Preview» y «Create Portfolio» comparten esa puerta; «Create» además exige una previsualización cargada.

### Oráculos

- `npm run lint` → **6 errores + 1 warning, todos preexistentes** y en archivos que este loop no toca (`components/ui/Modal.tsx`, `components/ui/MultiSelect.tsx`, `screener/components/FilterModal.tsx`, `SavePortfolioModal.tsx`, `SaveScreenModal.tsx`, `screener/stores/screenerStore.ts`, `routes/router.tsx`). **Cero problemas en los 6 archivos del cambio.**
- `npm run build` (`tsc -b && vite build`) → **verde**, `✓ built in 59.37s`.
- No hay runner de tests unitarios en el repo (solo Playwright e2e, que necesita backend) y **no se añadió ninguna dependencia**, según la consigna. Por eso la lógica de asignaciones vive en funciones puras: es lo testeable el día que entre un runner.

### Supuestos sobre el contrato (todos centralizados)

Todo lo que el FE asume del backend está en **un solo bloque**: el comentario `// Composite portfolio — create from strategy sleeves` al final de `src/services/portfolioService.ts`. Si #202 se desvía, se reconcilia ahí y en `fmtCoverage`.

1. **Unidades mezcladas.** `allocation`, `max_position_weight`, `min_position_weight`, `cash_buffer_pct` y `coverage_pct` son **fracciones**; `weight_pct`, `weight_realized_pct`, `target_weight_pct` y `cash_pct` son **porcentajes**. Sale del ejemplo del contrato (`"allocation": 0.6`, `"coverage_pct": 0.97`, `"weight_pct": 10.0`, `"cash_pct": 3.42`).
2. **`coverage_pct` se llama `_pct` pero es fracción** (el warning del propio backend imprime «cobertura 0.91»). `fmtCoverage` lo formatea asumiendo fracción y deja pasar tal cual cualquier valor > 1, por si el backend lo normaliza: es el único punto a tocar.
3. **`portfolio` solo viene en create** → tipado `portfolio?: PortfolioResponse | null`; la navegación solo ocurre si llega.
4. Campos que el contrato no marca como nulables pero que el FE tolera nulos: `holdings[].name`, `holdings[].sector`, `holdings[].price`, `holdings[].weight_realized_pct`, `sleeves[].coverage_pct`, `sleeves[].eligible_count`, `sleeves[].target_weight_pct`, `as_of`, `data_as_of`.
5. **`rules` se envía completo siempre** (incluidos `min_position_weight: null`, `on: "period_start"` y `overlap: "sum"`): `CompositeRules` es `extra="forbid"`, así que el objeto va campo por campo como el modelo, sin claves de más.
6. **`name` es obligatorio también en la previsualización** — el request model es el mismo, así que se exige antes de llamar a `/preview`.

### Desviaciones respecto del alcance

- **`min_position_weight` no tiene control de UI** (el alcance pedía `max_position_weight` y `cash_buffer_pct`); se envía `null`. Añadirlo después es un input más + la regla «floor < cap».
- **`on` (`period_start`/`period_end`) tampoco se expone**; se fija en `period_start`, el valor por defecto del backend. `cadence` **sí** se expone porque es el calendario que #204 va a leer.

### Riesgos anotados

- **422 de pydantic.** `lib/apiErrors.ts::mapErrorDetail` hace `detail.toLowerCase()`, y un 422 de validación de modelo de FastAPI trae `detail` como **lista**, no como string: reventaría dentro del interceptor de axios. No se tocó ese archivo compartido (fuera de alcance), pero `resolveCompositeError` del modal degrada a un mensaje genérico en vez de mostrar basura interna. Los 422 del contrato (`HTTPException(422, detail="…")`, que nombran la manga) sí son strings y se muestran verbatim. **Vale la pena endurecer `mapErrorDetail` en un loop aparte.**
- **Sin backend corriendo**, nada de esto se ejercitó contra la API real: la reconciliación con #202 mergeado (nombres de campo, nulabilidad, unidades) sigue pendiente.
- El import cross-feature `portfolio → strategy-builder/service` es el primero del repo entre features (antes solo lo hacían las páginas). No hay ciclo (`service.ts` solo importa axios + tipos) ni arrastra el CSS del builder.

### Qué mirar en la revisión visual

1. **Paso 3 con solapamiento** (dos estrategias que compartan nombres): que los chips de manga en la tabla se lean y que la sección «Overlap» tenga sentido.
2. El **riel de mangas** con 4+ estrategias: hace scroll horizontal, ¿se entiende que hay más a la derecha?
3. Un caso con **cap** (`max_position_weight` = 5 %): los nombres recortados aparecen en «Left out or trimmed» **aunque sigan en cartera** — comprobar que la etiqueta («trimmed by the per-position cap (still held)») no se lea como que se perdieron.
4. El **totalizador** de asignaciones en rojo mientras Σ ≠ 100 %, y que «Split evenly» lo arregle de un clic.
5. Los dos botones nuevos de la tabla de portafolios: si «Create from Strategies» + «Import from Excel» juntos aprietan demasiado la cabecera en pantallas chicas.
