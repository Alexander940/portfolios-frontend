# Inner Loop issue-15: Página "Mis alertas" — lista, estados e historial

> **Status:** APPROVED 2026-07-20

**Resuelve:** [#15](https://github.com/Alexander940/portfolios-frontend/issues/15) · Módulo de Alertas (epic backend [#94](https://github.com/Alexander940/portfolios-backend/issues/94)) · Diseño visual (fuente de verdad de UI): https://claude.ai/design/p/44e4379b-f2e5-4592-9c52-7df08d59cf44?file=Alertas.html

**Classification:** inner loop de código (frontend). Produce un PR. Contrato heredado de los loops previos del repo (`tracker-epic-implementation` / `builder-min-position-weight`): mismo oracle de 3 niveles, mismo esquema de entrega.

**Trigger:** backend #89 (CRUD) y #92 (eventos) **mergeados y desplegados** en prod + orden del usuario. El e2e mockea la API (`page.route`), así que el desarrollo no bloquea en el backend — pero la validación final del dueño sí lo necesita vivo.

**Executor:** agente in-chat en `../portfolios-frontend`, branch `feature/alerts-15-page` desde `master`. La iteración comienza leyendo `gh issue view 15` y el diseño enlazado; la issue es la fuente de verdad del contrato funcional, el diseño de la UI.

**Objective (verifiable):** PR con la página de Alertas (ruta + entrada de navegación):
1. Lista: símbolo (ticker + nombre), regla en frase natural, canales, estado (**Armada / Disparó hoy / En cooldown / Pausada** — incluida la auto-pausada por símbolo sin datos), último disparo.
2. Acciones: toggle activar/pausar (PATCH), editar (abre el constructor de #16 prellenado — si #16 aún no existe, botón presente deshabilitado con tooltip), eliminar con confirmación.
3. Filtros por símbolo y estado; indicador del límite 200; estado vacío con CTA.
4. Pestaña/sección **Historial** con eventos (fecha, símbolo, frase, valor observado) desde `GET /api/v1/alerts/events`.
5. Copy en español, responsive, dark mode, componentes del sistema existente.

**Oracle (executable, standalone) — los 3 niveles del contrato del repo, todos en verde:**
1. `npm run build` (tsc + vite).
2. `npm run lint` — 0 problemas nuevos vs baseline de master (medir baseline al arrancar).
3. Playwright e2e nuevo `tests/e2e/alerts-15-page.spec.ts` con la API mockeada por `page.route`: render de la lista con los 4 estados distinguibles; toggle emite el PATCH esperado; delete pide confirmación y emite DELETE; filtros filtran; estado vacío muestra el CTA; la pestaña Historial lista eventos del mock.

La fidelidad visual contra el diseño de Claude Design queda en la revisión humana.

**Exit criteria:** éxito = oracle verde en los 3 niveles + PR abierto. Fallo = máx. **3** iteraciones → trabajo parcial a `wip/alerts-15`, working tree limpio, escalar con diagnóstico. Retoma tras corte: leer `run-<fecha>.jsonl` de esta carpeta y reconciliar con `git log`.

**Memory:** `docs/loops-history/issue-15/` (este repo) — `design.md` + `run-<fecha>.jsonl` write-ahead, comiteados como audit trail. `## Outcome` al cerrar.

**Human-in-the-loop:** aprobar este design; revisar PR + **fidelidad visual vs el diseño**; ordenar merge — **merge a master = deploy automático de Vercel**, así que el merge es la puerta de producción.

**Irreversible actions:** ninguna dentro del loop (el deploy lo implica el merge, gated por el dueño).

**Kill switch:** interrumpir al agente; PR sin mergear no despliega nada.

## Outcome — SUCCESS (2026-07-21, 1 iteración + fix de glob)

PR [#18](https://github.com/Alexander940/portfolios-frontend/pull/18)
mergeado (squash `d8fd98d`), issue cerrada. Feature `src/features/alerts`
(types/service/lib/AlertsIndex) + página con 4 estados, filtros, acciones,
historial (`?tab=historial`) y límite 200. Requirió addendum backend #102
(ticker en AlertResponse). Oracle: build ✓ · lint 10=baseline · e2e 6/6.
Lecciones de entorno: chromium sin libnspr4/libnss3 en la WSL → deps
extraídas user-space a scratchpad con LD_LIBRARY_PATH (sin sudo); el glob
`**/alerts**` intercepta la navegación de la app → guard por resourceType
en los mocks. El checkout FE tenía cambios sin commitear de otra sesión
(strategy-builder) — no tocados, commits con paths explícitos.
