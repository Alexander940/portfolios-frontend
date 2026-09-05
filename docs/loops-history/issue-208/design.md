# Inner Loop issue-208: Frontend — página del compuesto: insignia, pestaña «Mangas» y rebalanceo `use_saved`

> **Status:** APPROVED 2026-09-05 — orden explícita del dueño («Comienza con la implementación de los loops… con agentes de Opus 5, tú solo trabaja como orquestador»). Executor confirmado: subagente Opus 5 por historia en worktree hermano, coordinado desde el chat orquestador.

**Resuelve:** [#208](https://github.com/Alexander940/portfolios-backend/issues/208) · Operar el compuesto con las mismas pantallas que los demás portafolios: verlo como compuesto, entender sus mangas y rebalancearlo sin que el modal exija filtros de screener.

**Classification:** inner loop **de código (frontend)**, one-shot, en `../portfolios-frontend`. **Depende de #203, #204 y #205** (contratos fijados en sus design docs).

**Trigger:** aprobación de este design; #203/#204/#205 mergeados para el cierre.

**Executor:** agente in-chat en worktree hermano del FE — `git -C ../portfolios-frontend worktree add ../portfolios-frontend-fe-208 -b feat/fe-208 origin/master` → `board.sh start fe-208`.

## Alcance

- **Parser del spec**: `parseCreationSpec` (`portfolioService.ts:533`) reconoce `version: 3` y expone `kind` y `rules`; `CREATION_SPEC_VERSION` sigue en 2 (v3 es otro `kind`).
- **Insignia «Compuesto»** en `PortfolioHeader.tsx` y en `PortfoliosTable.tsx`.
- **Pestaña «Mangas»** en `Portfolio.tsx` (junto a Overview/Positions/Events/Rebalances): tabla desde `GET /sleeves` (#203) con asignación, versión pineada/última (marca `outdated`), peso objetivo, peso actual aproximado, cobertura, `as_of`; exposición sectorial agregada; nota visible «atribución proporcional al último target» (D3). Acciones: «Cambiar asignaciones» (editor de la lista completa → `PUT /sleeves`) y «Actualizar a la última versión» por manga (`PATCH … rebase_to_latest`).
- **Rebalanceo**: `RebalancePortfolioModal.tsx` (feature screener) detecta compuesto y abre en modo `use_saved` sin la sección de filtros ni de weighting; el preview muestra, además del plan de hoy, el riel de mangas con `resolved` y warnings (campo `sleeves` del preview, #204); confirmar como hoy.
- **Historial** (`PortfolioRebalancesTab.tsx` / `RebalanceDetailModal.tsx`): cuando `spec_used.version === 3`, mostrar las mangas usadas en vez de filtros.

## Objective (verifiable)

1. Parser v3 + insignia.
2. Pestaña Mangas con las dos acciones.
3. Modal de rebalanceo en modo compuesto; historial con mangas.
4. Un portafolio v1/v2 **no cambia** de aspecto ni de flujo.

## Oracle (executable, standalone)

- `npm run lint` + `npm run build` verdes; tests existentes verdes.
- Test unitario de `parseCreationSpec` con un payload v3 (y regresión de v1/v2).
- Test de la validación del editor de asignaciones: Σ ≠ 100 → bloqueado; conjunto de estrategias inmutable en v1.
- El modal de rebalanceo en compuesto **no envía** `filters` (assert sobre el body en un test de servicio o mock de fetch).
- **Revisión visual del dueño** de la pestaña Mangas y del preview compuesto.

## Exit criteria

Éxito = lint + build + tests verdes + revisión visual. Fallo = 3 iteraciones → detener y escalar.

## Memory

Esta carpeta — `design.md` + `run-<fecha>.jsonl` (ítems: `spec-v3-parser`, `badge`, `sleeves-tab`, `sleeves-actions`, `rebalance-modal`, `history`, `visual-review`).

## Human-in-the-loop

Aprobación de este design; revisión visual; merge y deploy a Vercel por el dueño.

## Irreversible actions

Ninguna.

## Kill switch

Interrumpir al agente; descartar rama/worktree del FE.

## Fuera de alcance

Backtest compuesto (#209), mark intradía por manga, edición del conjunto de mangas.

---

## Outcome — SUCCESS (2026-09-05, 1 iteración)

Implementado en el FE, rama `feat/fe-208` (base `feat/composite-fe` 7bc855a).

**Qué entró**

| Alcance | Dónde |
| --- | --- |
| Servicio de mangas + builders del rebalanceo compuesto | `src/services/portfolioService.ts` (bloque «Composite sleeves») |
| Insignia «Compuesto» | `CompositeBadge.tsx` + `PortfolioHeader.tsx` + `PortfoliosTable.tsx` |
| Pestaña «Mangas» | `SleevesTab.tsx`, cableada en `Portfolio.tsx` |
| Acciones de la mezcla | `EditSleeveAllocationsModal.tsx` (`PUT`) + rebase por manga (`PATCH`) |
| Rebalanceo `use_saved` | `RebalancePortfolioModal.tsx` + guarda del redirect en `Screener.tsx` |
| Historial v3 | `RebalanceDetailModal.tsx` (`SpecSleevesTable`) |
| Regla pura de asignaciones | `features/portfolio/lib/sleeves.ts` (`checkAllocationPercents`, `fractionsToPercents`) |

**Oráculos**

- `npm run build` verde (53 s).
- `npx eslint` sobre los 12 archivos tocados → 0 problemas. El `npm run lint`
  global sigue en su baseline: 6 errores + 1 warning, todos en archivos ajenos.
- Chequeo de funciones puras (bundle esbuild + `node`): **9 checks OK** — el
  body del rebalanceo compuesto es exactamente `{ use_saved: true }` (sin
  `filters`/`ranking`/`weighting_params`/`weighting_method`/`prioritize_held`),
  el confirm agrega `as_of` + `update_saved_spec: false`, y la validación del
  editor bloquea Σ ≠ 100 %, faltantes, ≤ 0 y > 100 sin cambiar los mensajes que
  ya usaba el modal de creación (#207).
- Sin runner de tests unitarios en el repo (solo Playwright, que no se corrió):
  los tests del oracle original del design quedan cubiertos por el chequeo puro
  de arriba. **No se agregaron dependencias.**

**Decisiones que conviene saber**

1. **Contratos de #204/#205 asumidos, centralizados en un solo bloque.** Todo lo
   que el FE da por cierto de esos dos loops vive en el bloque «Composite
   sleeves» de `portfolioService.ts`: si algo cambia al mergearlos, se reconcilia
   ahí. Lo asumido: `PATCH` body `{rebase_to_latest:true}` y `PUT` body
   `{sleeves:[{strategy_id, allocation}]}` respondiendo ambos con el shape de
   `GET /sleeves`; el preview compuesto devolviendo `sleeves` = shape de #203 +
   `resolved`; y `spec_used` v3 con `kind`/`rules`/`sleeves`, cuyos campos se
   leen **todos opcionales** (el historial es inmutable y puede predatar
   cualquier schema; sin `name` la tabla degrada a un id corto).
2. **El botón «Rebalance» del compuesto sigue pasando por el screener** (misma
   ruta que hoy), pero el redirect ya no precarga filtros ni ranking y el modal
   se abre en modo compuesto, sin exigir resultados del screener.
3. **La insignia de ponderación se omite en el header de un compuesto**: se
   guarda con `weighting_method = "manual"` y diría literalmente «manual».
4. **El rebase pide confirmación inline**: en v1 no se puede re-pinear a una
   versión arbitraria, así que adoptar la última no se deshace desde la UI.
5. Un portafolio v1/v2 no cambia: todo lo nuevo cuelga de `isCompositePortfolio`.

**Pendiente**: revisión visual del dueño (pestaña «Mangas», editor de
asignaciones, preview compuesto con el riel de mangas e historial v3) y el
merge/deploy a Vercel, con #203/#204/#205 mergeados en el backend.
