# Inner Loop issue-22: barras de distribución sectorial en "Save as Portfolio"

> **Status:** APPROVED 2026-07-28 — aprobación del plan por el dueño (orden global de la cadena backend 127-129 + este loop FE; el contrato del endpoint queda congelado por el design de portfolios-backend#127)

**Resuelve:** [#22](https://github.com/Alexander940/portfolios-frontend/issues/22) · Preview de la distribución de market-cap share por sector del universo filtrado en el modal "Save as Portfolio", consumiendo `POST /screener/sector-distribution` (portfolios-backend#127). Decisiones de producto: solo market-cap share (no conteo como dato principal); barras horizontales CSS (patrón `RebalanceDetailModal`), no donut.

**Classification:** inner loop **de código frontend** (repo `portfolios-frontend`). Branch `feat/sector-distribution-preview-22` desde `origin/master` (2f0d9f5). **Protocolo cumplido: `git fetch origin` antes de tocar nada** (lección prioritize-held-ui) — sin colisiones.

**Trigger:** cadena backend 127-129 en verde (contrato congelado; el deploy lo hace el dueño al mergear).

**Executor:** agente in-chat.

**Objective (verifiable):**
1. Tipos `SectorDistributionRow` / `SectorDistributionResponse` + `getSectorDistribution` en el service del screener (pipeline `cleanFilters(toApiPercentFilters(...))`, como el export).
2. `src/lib/sectorColors.ts` extraído de `SectorComposition.tsx` (que pasa a importarlo).
3. `SectorDistributionPreview.tsx` con estados loading/error/data; el error **nunca bloquea la creación**.
4. Integrado en `SavePortfolioModal` (gate `isOpen && !noResults`); sin refetch al cambiar `weighting_method`.
5. E2E: barras con mock del endpoint + resiliencia (500 → fallback muted y el POST de creación sigue funcionando). Regla de mocks heredada del 126: `**/alerts/events/**`, NUNCA `**/alerts/**`.

**Oracle (executable, standalone):** `npm run build` (tsc estricto) + `npx playwright test tests/e2e/sector-weighting-126.spec.ts` — verdes.

**Exit criteria:** éxito = build + e2e verdes + rama lista. Fallo = 3 iteraciones → detener y escalar.

**Memory:** esta carpeta — `design.md` + `run-<fecha>.jsonl` (ítems: `tipos-service`, `sector-colors`, `componente`, `integracion-modal`, `e2e`).

**Human-in-the-loop:** design aprobado vía plan; review + merge por el dueño (Vercel auto-deploya master; requiere el backend deployado para funcionar en prod).

**Irreversible actions:** ninguna.

**Kill switch:** interrumpir al agente; descartar la rama.

## Outcome — SUCCESS (2026-07-28, 1 iteración)

Rama `feat/sector-distribution-preview-22` desde origin/master (2f0d9f5, fetch
previo sin colisiones). Tipos + `getSectorDistribution` (pipeline del export),
`src/lib/sectorColors.ts` extraído (SectorComposition refactorizado a
importarlo), `SectorDistributionPreview` con skeleton/error-muted/barras
integrado en `SavePortfolioModal` (gate `isOpen && !noResults`, sin refetch al
cambiar de método). **Oracle: `npm run build` verde; e2e 5/5 (3 regresión #126
+ 2 nuevos: barras con mock y resiliencia 500 sin bloquear la creación).**
Nota: el lint global ya fallaba en master (6 errores en archivos ajenos); los
archivos tocados pasan eslint limpios.
