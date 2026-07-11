# Inner Loop: builder-min-position-weight

> **Status:** APPROVED 2026-07-11 — el usuario ordenó ejecutar el diseño tal como está.

**Classification:** inner loop (un solo ítem: issue #13)

Hereda el contrato del loop `tracker-epic-implementation` (aprobado 2026-07-09) con el
mismo oracle, entrega y executor; este doc registra solo lo específico de esta corrida.

**Trigger:** orden directa del usuario. El bloqueante `portfolios-backend#53` está
CLOSED (verificado 2026-07-10); se asume desplegado, como ocurrió con backend#50.

**Executor:** el agente en el chat (Claude Code).

## Objective (verifiable)

Issue **#13** implementada en el Strategy Builder, con oracle en verde y **un commit
local** en la rama `feature/builder-min-weight` (creada desde `master`). Criterios:

1. Input de **peso mínimo por posición** (%) junto al de peso máximo existente
   (patrón de referencia: `max_position_weight`, commit `fe58481`), con validación
   client-side **en vivo** replicando la del backend: fracción en (0,1) y
   `min < max` cuando ambos están definidos (backend responde 422 con `detail`).
2. **Tooltip/helper** con la semántica: "las posiciones que no alcanzan este peso se
   eliminan y su peso se redistribuye entre las demás — el portafolio puede quedar
   con menos posiciones que el top-N".
3. El spec posteado incluye `min_position_weight` (fracción, ej. `0.05` = 5%)
   **solo cuando el usuario lo define**; omitido = sin mínimo.

La iteración comienza leyendo `gh issue view 13` y el código actual del builder
(`src/features/strategy-builder/`) para seguir exactamente el patrón del campo máximo
(mapeo %↔fracción incluido). La issue en GitHub es la fuente de verdad del contrato.

## Oracle

Los 3 niveles del loop anterior, todos deben pasar:

1. `npm run build` (tsc + vite).
2. `npm run lint` — baseline de master: 10 problemas preexistentes, 0 nuevos.
3. Playwright e2e nuevo `tests/e2e/builder-13-min-weight.spec.ts` con la API mockeada
   por interceptación (`page.route`), verificando: validación en vivo bloquea el
   submit con mensaje cuando `min >= max` o fuera de (0,1); el POST del spec contiene
   `min_position_weight` como fracción cuando se definió; y lo omite cuando el campo
   quedó vacío; tooltip/helper presente.

La fidelidad visual queda en la revisión humana.

## Exit criteria

- **Éxito:** oracle verde en los 3 niveles → commit → `done`.
- **Presupuesto:** máx 3 intentos; agotados → trabajo parcial a `wip/builder-13`,
  working tree limpio, `failed` con diagnóstico y escalada al usuario.
- **Retoma tras corte:** leer `run-<fecha>.jsonl` de esta carpeta y reconciliar con
  `git log` antes de continuar.

## Memory

`docs/loops-history/builder-min-position-weight/` — este doc + un JSONL write-ahead
por run (mismo esquema de eventos del loop anterior), comiteados como audit trail.

## Human-in-the-loop

- El usuario revisa el commit y la validación en la app; los checkboxes de #13 en
  GitHub los marca él.
- **Push / merge a master / deploy solo a orden explícita del usuario** (como en la
  corrida anterior).

## Irreversible actions

Ninguna: ediciones locales y un commit en rama nueva. Sin push automático.

## Kill switch

Interrumpir al agente; efectos atómicos (el commit existe o no). Reconciliar log vs
`git log` al retomar.

## Outcome

**Run:** run-2026-07-11 · **Resultado: `done`** — issue #13 implementada y verificada.

- Commit: `feat(strategy-builder): min weight per stock (min_position_weight) (#13)`
  en `feature/builder-min-weight`.
- Oracle: build OK · lint = baseline (10 preexistentes, 0 nuevos) · e2e `builder-13`
  4/4 + regresión tracker 44/44.
- Intentos del nivel 3: 3 de 3 (dos fallas de locators del spec — botón "New strategy"
  duplicado en la lista vacía y colisión de texto tooltip/error — ninguna de la app).
- Pendiente del usuario: revisión visual, checkboxes de #13 en GitHub, y orden de
  push/merge/deploy.

**Exit reason:** success.
