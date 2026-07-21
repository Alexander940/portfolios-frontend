# Inner Loop issue-16: Constructor de reglas dinámico desde el catálogo

> **Status:** APPROVED 2026-07-20

**Resuelve:** [#16](https://github.com/Alexander940/portfolios-frontend/issues/16) · Módulo de Alertas (epic backend #94) · Diseño visual: https://claude.ai/design/p/44e4379b-f2e5-4592-9c52-7df08d59cf44?file=Alertas.html

**Classification:** inner loop de código (frontend). Produce un PR. Contrato heredado de los loops previos del repo.

**Trigger:** backend #88 (catálogo) y #89 (CRUD) mergeados y desplegados + orden del usuario. Recomendado tras issue-15 (la página donde vive el constructor); si #15 no está mergeado, el constructor se monta igual accesible desde la ficha del símbolo y se integra a la página después.

**Executor:** agente in-chat en `../portfolios-frontend`, branch `feature/alerts-16-builder` desde `master`. La iteración comienza leyendo `gh issue view 16`, el diseño enlazado y la respuesta real de `GET /api/v1/alerts/fields` (o su contrato en el doc backend §7.1).

**Objective (verifiable):** PR con el constructor de alertas:
1. Flujo símbolo (autocomplete) → categoría → campo → operador → umbral → opciones, **pintado 100% desde `GET /api/v1/alerts/fields`** — prohibido hardcodear campos/operadores (regla de la casa tras la lección `mapping.ts`).
2. Umbral con la unidad del campo y conversión fracción↔% donde el catálogo lo declare (usuario escribe 15 → POST manda 0.15); operadores filtrados por campo; booleanos y `change` sin input de umbral.
3. Campos `enabled:false` visibles, deshabilitados, badge "Próximamente".
4. Valor actual del campo al elegirlo y aviso "la condición ya se cumple — disparará en el próximo cruce" (usa `current_value`/`armed` de la respuesta del POST o del endpoint que el backend provea).
5. Vista previa en frase natural en vivo; canales checkboxes (Email ✓ y Campana ✓ preseleccionados, SMS deshabilitado "Próximamente"); modo Recurrente/Una sola vez; cooldown avanzado; nota opcional.
6. Accesible desde la página de Alertas y desde la ficha del símbolo; 422 del backend mapeados a mensajes de campo claros.

**Oracle (executable, standalone) — 3 niveles, todos en verde:**
1. `npm run build`.
2. `npm run lint` — 0 problemas nuevos vs baseline de master.
3. Playwright e2e nuevo `tests/e2e/alerts-16-builder.spec.ts` con catálogo y CRUD mockeados por `page.route`: el catálogo mock pinta categorías/campos/operadores; elegir un campo booleano oculta el umbral; campo `fraction` con entrada "15" → el POST capturado lleva `0.15`; campo disabled no es seleccionable y muestra el badge; preview de frase se actualiza en vivo; defaults de canales correctos (email+in_app marcados, sms disabled); mock de `current_value` con condición ya cumplida muestra el aviso; respuesta 422 mockeada renderiza el error en el campo correcto.

La fidelidad visual queda en la revisión humana contra el diseño.

**Exit criteria:** éxito = oracle verde + PR abierto. Fallo = máx. **4** iteraciones (la superficie más grande del FE) → trabajo parcial a `wip/alerts-16`, escalar con diagnóstico.

**Memory:** `docs/loops-history/issue-16/` (este repo) — `design.md` + `run-<fecha>.jsonl` write-ahead. `## Outcome` al cerrar.

**Human-in-the-loop:** aprobar este design; revisar PR + fidelidad visual + **redacción de tooltips/frases** (es la cara del catálogo ante el usuario); ordenar merge (= deploy Vercel).

**Irreversible actions:** ninguna dentro del loop.

**Kill switch:** interrumpir al agente.

## Outcome — SUCCESS (2026-07-21, 2 iteraciones)

PR [#19](https://github.com/Alexander940/portfolios-frontend/pull/19)
mergeado, issue cerrada. AlertBuilderModal 100% catálogo-driven con
conversión %↔fracción verificada en el POST capturado, aviso
condición-ya-cumplida, edición con campos bloqueados y 422 en el
formulario. Iteración 2: useRef de React 19 exige valor inicial, y
transformAxiosError devuelve ApiError plano (no Error) → el catch lee
.message del objeto. Oracle: build ✓ · lint baseline · e2e 12/12.
