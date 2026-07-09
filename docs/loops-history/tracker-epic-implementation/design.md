# Inner Loop: tracker-epic-implementation

> **Status:** APPROVED 2026-07-09 — aprobado con enmienda del usuario: #4 se implementa ya
> (sin esperar el despliegue de backend#50), ejecución continua de todo el backlog.

**Classification:** inner loop (backlog finito: la épica #12, una iteración por issue)

**Trigger:** orden directa del usuario en la sesión de Claude Code. Dentro del run, cada issue
se dispara al completarse (o fallar) la anterior, en el orden sugerido por la épica.
**Enmienda 2026-07-09:** el usuario ordenó implementar también #4 de inmediato, sin esperar
el despliegue de backend#50. Se implementa contra el contrato documentado en la issue; si el
endpoint `GET /trackers` no existe aún en el backend local, el oracle de #4 se degrada según
la regla general (niveles 1-2 + estados de error verificables) y queda registrado en el log.

**Executor:** el agente en el chat (Claude Code, esta sesión o una que retome el log).
Cada iteración es una ronda de tool calls; los interrupts del usuario aterrizan entre iteraciones.

## Objective (verifiable)

Por issue: los criterios de aceptación de esa issue implementados en el repo, con el oracle en
verde y **un commit local por issue** en la rama `feature/tracker-page` (creada desde `master`).

Épica completa cuando #5, #6, #7, #8, #9, #10, #11 y #4 están `done` (o `failed` con
diagnóstico, si alguna agota su presupuesto).

### Backlog (orden de ejecución, según la épica #12)

| # | Issue | Estado inicial |
|---|-------|----------------|
| 1 | #5 Vista detalle: header, banners de estado y acciones | pending |
| 2 | #6 Flujo de activación: preview de materialización + crear tracker | pending |
| 3 | #7 Tabla de posiciones actuales + modo precios intradía | pending |
| 4 | #8 Panel de drift: próximo rebalanceo | pending |
| 5 | #9 Performance: equity vs SPY + overlay de backtest | pending |
| 6 | #10 Composición sectorial: actual vs target | pending |
| 7 | #11 Historial de eventos (journal) | pending |
| 8 | #4 Vista índice: lista + summary | pending (contra el contrato de la issue; backend#50 puede no estar desplegado) |

Cada iteración comienza con `gh issue view <n>` para leer el contrato completo de la issue
(API, notas de implementación, criterios de aceptación). El design doc no duplica esos contratos;
la issue en GitHub es la fuente de verdad de cada tarea.

### Convenciones transversales (de la épica #12 — aplican a todas las iteraciones)

- Base `/api/v1`, JWT Bearer con el interceptor existente; errores `{detail}` → toasts/banners.
- Badge global "Datos al cierre de {data_as_of}"; nunca aparentar tiempo real (salvo `?mark=live`).
- **Ratings numéricos** (escala ADE −3…+3), NO letras: componente único reutilizable con badge de color.
- **Score** = valor del campo `sort_by` de la estrategia — formateo genérico, no 0-100.
- `coverage_pct` llega como fracción 0-1.
- El mock (`src/tracker.jsx` del diseño aprobado) es referencia visual; los contratos reales
  están en cada issue.

## Oracle

Externo al modelo, invocable standalone, en tres niveles (todos deben pasar):

1. **`npm run build`** — type-check (`tsc -b`) + build de producción.
2. **`npm run lint`** — ESLint sin errores.
3. **Playwright e2e** — un spec nuevo por issue en `tests/e2e/tracker-<issue>.spec.ts` que
   verifica los criterios de aceptación automatizables (render de la sección, estados
   loading/empty/error, navegación), ejecutado con `npm run test:e2e -- tracker-<issue>`.
   Requiere el backend local en `http://localhost:8000` con un usuario de prueba y al menos
   una estrategia con datos (misma premisa que los specs existentes). Si el backend local no
   está disponible al iniciar el run, se degrada a niveles 1-2 + verificación manual dirigida
   con el navegador, y se deja constancia en el log.

La **fidelidad visual al diseño aprobado** no es automatizable: queda en la revisión humana
(ver Human-in-the-loop). El oracle valida comportamiento, no estética.

## Exit criteria

- **Éxito (por issue):** oracle en verde en los 3 niveles → commit → estado `done`.
- **Presupuesto de fallo (por issue):** máx **3 intentos** de poner el oracle en verde.
  Agotados → estado `failed` con diagnóstico en el log, se revierte el working tree a limpio
  (el trabajo parcial se preserva en una rama `wip/tracker-<issue>` antes de revertir) y se
  continúa con la siguiente issue. Nunca reintento silencioso más allá del presupuesto.
- **Fin del run:** todas las issues del backlog en `done`/`failed`/`deferred` → reporte final
  al usuario con el veredicto por issue y el diagnóstico de las fallidas.
- **Cortes de sesión / compactación:** el run se retoma leyendo el log JSONL (no la memoria
  de la conversación): `done` se salta, `in-progress` se verifica contra la realidad
  (¿existe el commit? ¿el working tree está limpio?), `pending` continúa.

## Memory

`docs/loops-history/tracker-epic-implementation/` (esta carpeta), comiteada en git:

- `design.md` — este documento (el contrato del loop).
- `run-<fecha>.jsonl` — write-ahead log, un evento por línea:
  `{"ts", "run_id", "item": "#<n>", "phase": "intent"|"outcome", "action", "verdict", "evidence", "artifacts"}`.
  El `intent` se escribe ANTES de cada efecto (empezar issue, commitear); el `outcome` después,
  con el veredicto del oracle y el hash del commit como evidencia.
- Git history de `feature/tracker-page` — un commit por issue, mensaje
  `feat(tracker): <resumen> (#<n>)`.

Tras una compactación de contexto, el log es la fuente de verdad; los valores recordados no.

## Human-in-the-loop

- El usuario revisa el **commit de cada issue** (diff + la app corriendo) a su ritmo; puede
  hacerlo al final del run o por issue interrumpiendo al agente. La revisión de fidelidad
  visual contra el diseño aprobado es suya.
- Los checkboxes de la épica #12 en GitHub los marca el usuario, no el agente.
- **Push y PR solo si el usuario lo pide** — el loop termina en commits locales.

## Irreversible actions

Ninguna. Todo efecto es local y reversible: ediciones de archivos y commits locales en una
rama nueva (reversibles con `git reset`/`git branch -D`). Sin push, sin llamadas de escritura
a servicios externos, sin tocar la base de datos del backend.

## Kill switch

Interrumpir al agente en el chat. Los efectos por iteración son atómicos y verificables tras
un interrupt: o el commit de la issue existe o no existe; el working tree se inspecciona con
`git status`. No se lanzan operaciones detached de larga vida (los procesos de build/test
mueren con la sesión; el dev server que arranca Playwright se cierra al terminar cada corrida).
Al retomar: reconciliar log vs `git log` antes de continuar.

## Outcome

**Run:** run-2026-07-09 · **Resultado: épica completa — 8/8 issues `done`**, todas al
primer o segundo intento del oracle (presupuesto: 3).

| Issue | Veredicto | Commit | Intentos oracle | Notas |
|---|---|---|---|---|
| #5 header/banners/acciones | done | 2a5a2d7 | 2 | fixes de spec (strict mode, checkbox sr-only), no de app |
| #6 flujo de activación | done | 0a1c937 | 2 | 1 error lint nuevo (set-state-in-effect) corregido |
| #7 posiciones + intradía | done | 525ec1c | 2 | stale flag → solo panel de drift (decisión documentada) |
| #8 panel de drift | done | a561435 | 1 | — |
| #9 performance + vs-backtest | done | f411cd0 | 2 | hallazgo: requests sin mock van a la API de producción (401 → logout); stubs añadidos a todos los specs |
| #10 composición sectorial | done | 94b5ecc | 1 | tokens --c-sector-* añadidos al design system |
| #11 journal de eventos | done | 355acc9 | 1 | — |
| #4 vista índice | done | 29f5e2c | 2 | backend#50 sin desplegar: implementada contra el contrato de la issue, service defensivo |

**Oracle final:** `tsc -b` + `vite build` OK · ESLint = baseline de master (10 problemas
preexistentes, 0 nuevos) · Playwright 42/42 (40 specs de tracker nuevos + 2 de curve).
Los 12 rojos de `registration.spec.ts` son preexistentes: el copy del login se tradujo
a inglés en `64b1604` y el spec quedó desactualizado (verificado sin relación con esta rama).

**Degradación aplicada (registrada en el precheck):** backend local apagado y backend#50
OPEN → el nivel 3 del oracle se ejecutó con Playwright + API mockeada por interceptación
de red usando los contratos documentados en las issues (mejora sobre la verificación
manual prevista en el diseño). Cuando backend#50 esté desplegado, los criterios de #4
deben re-verificarse contra el endpoint real (el service ya normaliza array/objeto).

**Exit reason:** success — backlog agotado, sin issues `failed`.
