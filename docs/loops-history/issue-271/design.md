# Inner Loop issue-271: frontend — badge de nivel, filtros de noticias en screener y builder, campos en el constructor de alertas

> **Status:** APPROVED 2026-10-16 — aprobación explícita del dueño («La implementacion hazla con agentes opus 5.5, en las demas, vamos con tus recomendaciones»). Executor: subagente Opus 5.5 por historia en worktree hermano; el chat principal orquesta, verifica el oráculo él mismo, revisa y mergea. Las decisiones abiertas del plan §10 quedaron con la propuesta por defecto.

**Resuelve:** [#271](https://github.com/Alexander940/portfolios-backend/issues/271) · Épica #262, ola 3, repo **frontend** (`../portfolios-frontend`, React 19 + Vite + TS, `master` 0160e6d).

**Classification:** inner loop **de código de UI**, one-shot; oráculo = build + tests de componentes + verificación visual del orquestador contra un backend local con datos sembrados.

**Trigger:** este design APPROVED, #268, #269 y #270 mergeadas a `feat/news-indicator` (el backend de integración corriendo en local con el PG efímero sembrado), orden del dueño.

**Executor:** subagente Opus 5.5 en worktree hermano del frontend — `git -C ../portfolios-frontend worktree add ../portfolios-frontend-news-fe-271 -b feat/news-fe-271 master` → `board.sh start news-fe-271` (el tablero es del backend, se registra igual para visibilidad). El orquestador levanta el backend de integración (`uv run python main.py` en `../portfolios-backend-news-indicator-int` con `TEST_DATABASE_URL`/`DATABASE_URL` al PG efímero sembrado) y el FE con `npm run dev` apuntando a él.

## Contrato

- `src/components/ui/NewsLevelBadge.tsx` (junto a `RatingBadge.tsx` y `DealBadge.tsx`): props `{ level, score, evidence, nNotes30d, events7d, topNews?: {title, url, publishedAt} , date? }`; cuatro estados visuales distintos (`alcista` verde, `bajista` rojo, `neutral` gris, `sin_cobertura` gris punteado/outline con texto «Sin cobertura»); tooltip con score, evidencia, «N notas / 30 d», eventos (chips con la descripción corta de `TAG_DESCRIPTIONS` servida por la API o copiada en un `newsTags.ts`), fecha de la fila (hora NY) y el título enlazado de la nota principal (`target=_blank rel=noopener`).
- Screener (`src/features/screener`): columna «Noticias» con el badge en la tabla; en el panel de filtros: nivel (multi), rango de score, evidencia mínima, eventos incluir/excluir (multi), y `news_score`/`news_evidence` en el selector de orden; se serializan a los campos de `ScreenerRequest` de #268; **sin valor por defecto** (regla #98).
- Portafolio (`src/features/portfolio`): badge en la tabla de posiciones (y en holdings del tracker si comparten componente de fila).
- Builder (`src/features/strategy-builder/mapping.ts`): entradas para `news_level`, `news_score`, `news_evidence`, `news_events_any`, `news_events_none` en el catálogo de filtros (universo y selección) y `news_score` como clave de ranking; el mensaje del linter del backend se muestra tal cual (ya hay un camino para violaciones PIT).
- Alertas (`src/features/alerts/AlertBuilderModal.tsx`): la categoría `noticias` y sus campos se pintan desde `GET /alerts/fields` (ya es así); solo se verifica que los `boolean` con `becomes_true` solo y la categoría nueva se rendericen bien; si el dueño eligió la alternativa de #269 (`news_level` entero), un selector de nivel para `eq`.
- `ToolActivity.tsx`: etiqueta de `get_news_indicator` si #270 no la hizo.
- Tipos: `src/types/screener.ts` (o donde viva `ScreenerResultItem`) con los 7 campos nuevos.

## Objective (verifiable)

1. Componentes, filtros, mapping, tipos, tests.
2. Oráculo verde + verificación visual registrada (capturas en `docs/loops-history/issue-271/` del repo backend).

## Oracle (executable, standalone)

1. **Build/lint/tests**: los scripts `build`, `lint` y `test` del `package.json` en verde; `tsc --noEmit` sin errores.
2. **Componente**: tests de `NewsLevelBadge` (vitest/RTL, el runner que use el repo): 4 estados con texto y clase distintos; tooltip muestra score/evidencia/eventos/título; sin `topNews` no rompe; `sin_cobertura` no muestra score.
3. **Serialización**: test del panel de filtros: elegir nivel `bajista` + evento excluir `oferta` + orden `news_score desc` produce exactamente `{news_level:["bajista"], news_events_none:["oferta"], sort_by:"news_score", sort_order:"desc"}` y nada de `news_*` cuando no se toca nada (sin defaults).
4. **Mapping**: test de que `mapping.ts` expone los 5 filtros y la clave de ranking con los nombres de #268 (snapshot de las claves).
5. **Visual (orquestador)**: contra el backend de integración con los 4 símbolos sembrados de #268: en el screener se ven los 4 badges distintos; el tooltip de A enlaza la nota; filtrar `bajista` deja solo B; ordenar por score pone A primero; en el builder, agregar `news_level` y pedir backtest sin el setting muestra el mensaje del linter; en alertas se crea `news_alcista becomes_true`, `news_score ≥ 30` y `news_event_oferta` y aparecen listadas. Capturas guardadas.
6. **Accesibilidad mínima**: el badge tiene `aria-label` con el nivel; el tooltip es alcanzable por teclado (si el componente base de tooltips del repo lo permite; si no, se anota).

## Exit criteria

Éxito = 1-6 verdes. Fallo = 3 iteraciones o 2 h → parar, commitear el parcial, escalar.

## Memory

Esta carpeta (en el repo backend) — `design.md` + `run-<fecha>.jsonl` (ítems: `badge`, `screener-table`, `screener-filters`, `portfolio`, `mapping`, `alerts-modal`, `types`, `oracle-build`, `oracle-tests`, `oracle-visual`) + capturas `visual-*.png`.

## Human-in-the-loop

Aprobación del design (fija el aspecto del badge y qué filtros se exponen); review del PR del frontend por el dueño; deploy a Vercel en #272.

## Irreversible actions

Ninguna (PR; el deploy es de #272).

## Kill switch

Interrumpir al agente; descartar rama/worktree del frontend.

## Riesgo principal

Que el FE adivine semántica en vez de leerla de la API (etiquetas, niveles, descripciones): por eso las descripciones vienen de `TAG_DESCRIPTIONS` vía API (si #268/#270 no las exponen, esta historia añade un endpoint mínimo `GET /api/v1/news/taxonomy` — se decide en el loop y se anota) y los nombres de filtros se prueban por snapshot contra el contrato de #268.

## Fuera de alcance

Cualquier cambio de backend salvo el endpoint de taxonomía si hace falta; deploy.

## Outcome — SUCCESS (2026-10-17, 1 iteración)

Repo frontend, rama `feat/news-fe-271` (worktree `portfolios-frontend-news-fe-271`, base `master` 0160e6d). Sin push.

**Commits:** `47f5177` taxonomía + tipos + badge · `a266f1c` screener (filtros, columna, URL) + portafolio · `af0d628` builder · `1c18c07` alertas · `7c32e1f` chat · `e881612` check ejecutable + fix de URL · (este) docs(loops).

**Oráculo**
- Línea base: build OK; lint ROJO preexistente `✖ 7 problems (6 errors, 1 warning)`.
- Final: `npm run build` → `✓ built in 1m 3s`; `npm run lint` → `✖ 7 problems (6 errors, 1 warning)`, los mismos 7 (0 nuevos).
- Tests: `npx vite-node tests/checks/news-indicator.ts` → `TODO VERDE` (51 ok; 68 con `NEWS_TAXONOMY_PY=…/app/indicators/news_taxonomy.py`, que verifica etiquetas, niveles y descripciones contra el backend). Los 3 checks existentes siguen en verde.
- Visual (5): pendiente, la hace el orquestador.

**Desviaciones**
1. Taxonomía copiada a mano en `src/lib/newsTaxonomy.ts` (el backend no tiene endpoint); el check detecta la deriva si se le pasa la ruta del .py.
2. No hay runner unitario (vitest/RTL): no se instaló nada. Los tests del design viven en `tests/checks/news-indicator.ts` (patrón del repo, `npx vite-node`, badge con `react-dom/server`). Es el único archivo fuera de `src/` junto con estos docs.
3. Nota principal: la fila trae solo `news_top_news_id` y no hay endpoint que lo resuelva → el screener no muestra el enlace. El badge ya acepta `topNews` y pinta un enlace aparte (`target=_blank rel=noopener noreferrer`), porque un `title` nativo no puede llevar enlaces. Follow-up: exponer título/URL.
4. Portafolio: el endpoint de posiciones no trae noticias. Hay un `news?` opcional (`NewsIndicatorInfo`: level, score, evidence, n_notes_30d, events_7d, top_news_id, date, los mismos nombres de `news_indicator_service.IndicatorView`) y el badge compacto se pinta solo si viene. Follow-up de backend. El tracker no comparte el componente de fila: no se tocó.
5. El screener no tiene un «selector de orden» aparte: se ordena haciendo clic en la cabecera. Las columnas `Noticias` (news_score) y `Evidencia` (news_evidence) son ordenables.
6. Alertas: `CATEGORY_LABELS` estaba escrito a mano, así que hubo que agregar `noticias`. Los campos siguen llegando de `/alerts/fields`.
7. Accesibilidad: el tooltip es el `title` nativo del chip, que se puede enfocar (`tabIndex=0`). Su texto aparece al pasar el mouse; con teclado el lector de pantalla lee el `aria-label` («Noticias: <Nivel>»).

**Cómo verlo**
1. Levantar el backend de integración en :8000 apuntando al PG sembrado.
2. En el worktree del FE crear `.env.local` con `VITE_API_URL=http://localhost:8000/api/v1` (la base URL incluye `/api/v1`) y correr `npm run dev` → http://localhost:5173.
3. Screener: la pestaña Overview muestra la columna «Noticias» (la última); el preset «Noticias» muestra score, evidencia y notas de 30 d. Se ven los 4 badges: verde, rojo, gris relleno y gris punteado «Sin cobertura». Pasar el mouse muestra el tooltip.
4. Filtro: + Add filter → Noticias → «Nivel de noticias» → bajista → Apply (deja solo B). Ordenar: clic en la cabecera «Noticias» dos veces para ir a desc (A primero).
5. Builder: Additional rules → categoría News → «News level» → alcista. Pedir el backtest sin `NEWS_INDICATOR_HISTORY_FROM` muestra el mensaje del linter tal cual. «News score» también está en el selector de ranking.
6. Alertas: Nueva alerta → Categoría «Noticias». Crear las tres: «Noticias: flujo alcista» / se activa; «Noticias: score» / mayor o igual que / 30; «Noticias: evento «Emisión de acciones…»» / se activa.

**Riesgos para el PR**
- La taxonomía duplicada puede derivar del backend; correr el check con `NEWS_TAXONOMY_PY` en cada cambio de taxonomía.
- `news_*` también aparece como clave de ranking en el modal de rebalanceo desde el screener (usa los filtros de rango de `ADDITIONAL_FILTERS`). Son claves válidas de `FIELD_MAPPING`, pero conviene revisarlo.
- Los presets y screens guardados no cambian; un preset nuevo con filtros de noticias los guarda en `additionalFilters`, igual que el resto.
- El badge del portafolio queda inerte hasta el follow-up de backend.
