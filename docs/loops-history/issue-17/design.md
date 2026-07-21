# Inner Loop issue-17: Campana de notificaciones en el navbar

> **Status:** APPROVED 2026-07-20

**Resuelve:** [#17](https://github.com/Alexander940/portfolios-frontend/issues/17) · Módulo de Alertas (epic backend #94) · Diseño visual: https://claude.ai/design/p/44e4379b-f2e5-4592-9c52-7df08d59cf44?file=Alertas.html

**Classification:** inner loop de código (frontend). Produce un PR. Contrato heredado de los loops previos del repo.

**Trigger:** backend #92 (API de campana) mergeado y desplegado + orden del usuario. Independiente de #15/#16 salvo el link "Ver todas" (si la página de #15 no existe aún, el link apunta a la ruta y queda funcional cuando #15 mergee).

**Executor:** agente in-chat en `../portfolios-frontend`, branch `feature/alerts-17-bell` desde `master`. La iteración comienza leyendo `gh issue view 17` y el diseño enlazado.

**Objective (verifiable):** PR con la campana global:
1. Ícono en el navbar con badge de no-leídas (`unread-count`), refrescado al navegar o polling suave — sin afordances de tiempo real (los eventos llegan una vez al día).
2. Dropdown/panel: eventos recientes con título, ticker, fecha del dato y distinción leída/no-leída.
3. Acciones: click en evento → ficha del símbolo; "Marcar todas como leídas" (badge a 0); "Ver todas" → historial de la página de Alertas.
4. Estado vacío ("Sin notificaciones"); responsive + dark mode; español.

**Oracle (executable, standalone) — 3 niveles, todos en verde:**
1. `npm run build`.
2. `npm run lint` — 0 problemas nuevos vs baseline de master.
3. Playwright e2e nuevo `tests/e2e/alerts-17-bell.spec.ts` con la API mockeada por `page.route`: badge muestra el count del mock; abrir el panel lista eventos con no-leídas distinguidas; "Marcar todas" emite el POST `{all:true}` y el badge pasa a 0; click en un evento navega a la ficha del símbolo; mock con 0 eventos muestra el estado vacío.

La fidelidad visual queda en la revisión humana contra el diseño.

**Exit criteria:** éxito = oracle verde + PR abierto. Fallo = máx. **3** iteraciones → trabajo parcial a `wip/alerts-17`, escalar con diagnóstico.

**Memory:** `docs/loops-history/issue-17/` (este repo) — `design.md` + `run-<fecha>.jsonl` write-ahead. `## Outcome` al cerrar.

**Human-in-the-loop:** aprobar este design; revisar PR + fidelidad visual; ordenar merge (= deploy Vercel).

**Irreversible actions:** ninguna dentro del loop.

**Kill switch:** interrumpir al agente.

## Outcome — SUCCESS (2026-07-21, 1 iteración)

PR [#20](https://github.com/Alexander940/portfolios-frontend/pull/20)
mergeado, issue cerrada. NotificationsBell en el Topbar (badge unread,
panel leída/no-leída, marcar todas, click→SymbolModal+mark-read, Ver
todas→historial), estilos bell-* en index.css. Oracle: build ✓ · lint
baseline · e2e 5/5 nuevos (17/17 acumulados sin regresión).
