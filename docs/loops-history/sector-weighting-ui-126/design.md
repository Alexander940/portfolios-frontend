# Inner Loop sector-weighting-ui-126: UI del weighting sectorial (crear/rebalancear + historial)

> **Status:** APPROVED 2026-07-25 — aprobación explícita del dueño (orden global de los 3 loops; el contrato backend queda congelado por los designs 124/125)

**Resuelve:** [portfolios-backend#126](https://github.com/Alexander940/portfolios-backend/issues/126) · Grupo "Sector-balanced" en los modals de crear desde screener y rebalancear; método y breakdown sectorial visibles en el historial de rebalanceos.

**Classification:** inner loop **de código frontend** (repo `portfolios-frontend`). Branch `feat/sector-weighting-ui-126` desde `origin/master`. **Protocolo obligatorio: `git fetch origin` ANTES de tocar nada** (lección prioritize-held-ui: una sesión paralela ya había implementado en origin).

**Trigger:** backend #124 + #125 mergeados y desplegados (o contrato congelado por el dueño).

**Decisión de producto (parte de esta aprobación):**
- El selector de weighting de `SavePortfolioModal` y `RebalancePortfolioModal` gana un grupo "Sector-balanced" con las 4 opciones (`sector_equal`, `sector_rating_weighted`, `sector_inverse_atr_calm`, `sector_market_cap`), cada una con descripción corta (base sectorial por market-cap del universo filtrado + reparto intra-sector).
- `RebalanceDetailModal` muestra método + breakdown `sector_weights` del `spec_used`; `PortfolioRebalancesTab` y `PortfolioHeader` muestran la etiqueta del método.
- Tipos en `src/services/portfolioService.ts` (`WeightingMethod`, `RebalanceSpecUsed.sector_weights`).

**Objective (verifiable):**
1. Las 4 opciones visibles y funcionales en ambos modals; el request lleva el método elegido.
2. Detalle de rebalanceo con método + breakdown sectorial.
3. e2e Playwright: crear desde screener con un `sector_*` + rebalanceo preview→confirm mostrando el método. Regla de mocks: `**/alerts/events/**`, NUNCA `**/alerts/**`.

**Oracle (executable, standalone):** `npm run build` (tsc estricto) + `npx playwright test` de los e2e del feature — verdes.

**Exit criteria:** éxito = build + e2e verdes + rama lista. Fallo = 3 iteraciones → detener y escalar.

**Memory:** esta carpeta — `design.md` + `run-<fecha>.jsonl` (ítems: `tipos`, `modals`, `historial`, `e2e`).

**Human-in-the-loop:** aprobar este design; review + merge por el dueño (Vercel auto-deploya master).

**Irreversible actions:** ninguna.

**Kill switch:** interrumpir al agente; descartar la rama.

## Outcome — SUCCESS (2026-07-25, 2 iteraciones)

Rama `feat/sector-weighting-ui-126` desde origin/master (9779b6f, fetch previo
sin colisiones). 4 opciones "Sector-balanced · …" en ambos modals; tipos con
`sector_weights` en preview y spec_used; bloque "Sector allocation used" en el
detalle del historial. **Oracle: `npm run build` verde; e2e 3/3 verdes
(iteración 2 tras fijar un selector ambiguo) + regresión rebalance-117 3/3.**
Merge por el dueño (Vercel auto-deploya master).
