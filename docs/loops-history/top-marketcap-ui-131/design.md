# Inner Loop top-marketcap-ui-131: selector de método en la Capa 1 del builder

> **Status:** APPROVED 2026-07-29 — aprobación explícita del dueño ("Sí, hacelo ahora en el repo del frontend"), sobre el alcance de 6 archivos + la trampa del early-return que se le presentó y aprobó en el chat

**Resuelve:** [portfolios-backend#131](https://github.com/Alexander940/portfolios-backend/issues/131) · UI de la Capa 1: elegir entre `universe_marketcap` (actual) y `top_marketcap` + `top_n`, con el preview sectorial reflejando la base elegida. Es la parte FE de backend#130, igual que #126 fue la UI de #124/#125.

**Classification:** inner loop **de código frontend** (repo `portfolios-frontend`). Branch `feat/top-marketcap-ui` desde `origin/master` (6b39f74). **Protocolo cumplido: `git fetch origin` ANTES de tocar nada** — origin/master == local, sin trabajo paralelo sobre layer1.

**Trigger:** backend#130 implementado (rama `feat/top-marketcap-130`, commit 52087e4) — contrato del API congelado por ese design.

**Bloqueante que resuelve:** hoy `mapping.ts:467` hardcodea `layer1: { method: 'universe_marketcap' }` y `types.ts:328` declara el tipo con un solo valor ⇒ guardar una estrategia `top_marketcap` desde la UI **la revierte en silencio**. Sin esto el backend solo es usable por API.

**Decisión de producto (parte de esta aprobación):**
- Selector de método de Capa 1 en la sección de weighting sectorial, con `top_n` (default **700**) visible solo cuando el método es `top_marketcap`.
- El preview (`/strategies/resolve-universe`) manda `layer1`, de modo que la tabla de Capa 2 muestre la base que el motor va a usar y no otra.
- `specToCfg` lee `layer1` de vuelta: editar una estrategia guardada debe conservar el método.
- **Trampa conocida y de tratamiento obligatorio** (`mapping.ts:465`): `if (cfg.layer3Method === 'equal' && !hasTilt && !hasGamma && !hasCap) return undefined;` descarta la cláusula `layered` ENTERA. Elegir `top_marketcap` con todo lo demás en default caería al weighting plano y perdería el método sin aviso ⇒ la condición debe incluir "layer1 en su default".
- Contrato del backend que hay que respetar: `top_n` es **requerido** con `top_marketcap` y **rechazado** (422) con `universe_marketcap`. El request no debe mandar `top_n` en el método viejo.

**Objective (verifiable):**
1. Tipos ensanchados (`Layer1Method`, `Layer1Spec.top_n`, DTOs de resolve-universe con `layer1`/`base_method`/`top_n`).
2. `cfgToSpec` emite `layer1` desde la config (nunca hardcodeado) y `specToCfg` lo lee de vuelta.
3. El early-return de `mapping.ts` ya no descarta `layered` cuando la Capa 1 no está en su default.
4. Selector + input de `top_n` en la UI, y `layer1` viajando en la llamada del preview.
5. e2e Playwright del feature.

**Oracle (executable, standalone):** `npm run build` (tsc estricto + vite build) + `npm run lint` + `npx playwright test` de los e2e del feature — verdes. Regla de mocks del repo: `**/alerts/events/**`, NUNCA `**/alerts/**`.

**Exit criteria:** éxito = build + lint + e2e verdes y rama lista para review. Fallo = 3 iteraciones → detener, persistir el parcial y escalar con diagnóstico.

**Memory:** esta carpeta — `design.md` + `run-2026-07-29.jsonl` (ítems: `tipos`, `mapping`, `ui`, `preview`, `e2e`).

**Human-in-the-loop:** review + merge por el dueño (Vercel auto-deploya master).

**Irreversible actions:** ninguna (sin deploy, sin tocar prod).

**Kill switch:** interrumpir al agente; descartar la rama/worktree.

## Outcome — SUCCESS (2026-07-29, 1 iteración)

Rama `feat/top-marketcap-ui` desde origin/master (6b39f74, fetch previo sin colisiones). 7 archivos: 6 de `src/features/strategy-builder/` + 1 spec e2e nuevo.

**Oracle:** `npm run build` (tsc estricto) verde · `npm run lint` **idéntico al baseline** (7 problemas preexistentes en `screenerStore.ts`/`router.tsx`, **cero** en archivos tocados) · e2e del feature **5/5 verdes** · specs hermanos (`builder-13-min-weight`, `builder-rerun-update`, `sector-weighting-126`) **12/12 verdes** → cero regresiones.

> **Nota de entorno:** Playwright no arranca en esta WSL (falta `libnspr4.so` y `sudo` pide contraseña, así que no se pudo `playwright install-deps`). Los e2e se ejecutaron **desde el lado Windows** (node 22.14 + `npm ci` sobre el mismo directorio, que es `C:\...` montado). Ahí corren perfecto. Además se verificó la lógica pura con `tsx`: **14/14** asserts sobre `buildLayer1`, las dos trampas, el round-trip `specToConfig`↔`cfgToSpec` y `mergeSpecPreserving`.

### Las dos trampas (ambas de pérdida silenciosa)

1. **Early-return de `buildLayered`** (la que ya venía identificada en la issue): `if (layer3 === 'equal' && !hasTilt && !hasGamma && !hasCap) return undefined` descartaba la cláusula `layered` **entera**. Elegir `top_marketcap` y no tocar nada más habría degradado la estrategia al weighting plano sin aviso. Se agregó el término `hasLayer1`. Cubierto por un test y por su **gemelo de regresión**: con todo en default la cláusula sigue omitiéndose, o cambiaría el `content_hash` de toda estrategia plana ya guardada.
2. **`mergeSpecPreserving` resucitaba el `layered` viejo** — *esta no estaba en la issue; la encontró el reconocimiento*. Hacía `{...original, ...formSpec}` y, a diferencia de `selection_filters`, nunca borraba `layered`. Volver una estrategia guardada de `top_marketcap` a `universe_marketcap` produce un formSpec **sin** `layered`, así que la cláusula original sobrevivía el spread y **el cambio del usuario no se aplicaba**. Se agregó el `delete` simétrico. Es exactamente el mismo patrón del bug de filtros que revivían (#98).

### Detalles que valen para el próximo que toque esto

- **`layer1TopN`, no `topN`:** `BuilderConfig.topN` ya significa la SELECCIÓN top-N (cuántas posiciones lleva el libro). Reusar el nombre habría sido un bug silencioso.
- **`top_n` se omite por spread** bajo `universe_marketcap`: el request del backend es `extra="forbid"` y un `top_n: null` *presente* sigue siendo 422.
- **`layer1Key` en el array de dependencias de `useResolveSectors`** es load-bearing y va **serializado**: sin él la tabla sectorial seguiría mostrando la base vieja tras cambiar de método — dato incorrecto con aspecto de feature funcionando; con el objeto crudo, el efecto refiraría en cada render.
- El componente arma su `layer1` con el **mismo `buildLayer1`** que el spec, así que el preview y lo guardado no pueden divergir.

### Pendiente (del dueño)

Review + merge de `feat/top-marketcap-ui` (Vercel auto-deploya master) y de la rama backend `feat/top-marketcap-130`. **Orden recomendado: backend primero** — si el FE sale antes, el selector manda `layer1.top_marketcap` a un backend que aún lo rechaza con 422.
