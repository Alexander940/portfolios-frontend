# Inner Loop prioritize-held-ui: opción de prioridad para posiciones actuales en la UI de rebalanceo

> **Status:** APPROVED 2026-07-24 — orden directa del dueño ("haz el trabajo completo en el repo del frontend"), ejecutado in-chat.

**Resuelve:** la cara UI de backend#117–#119 (`prioritize_held`, ya en prod) sobre la UI de rebalanceo de backend#113–#115.

**Contexto importante (lección de coordinación):** dos sesiones implementaron
la UI de rebalanceo (US5–US7) EN PARALELO el mismo día. Otra sesión pusheó su
implementación completa a `origin/master` (commits `2ef9c19..82ee89f`)
mientras esta sesión desarrollaba la propia sobre un checkout desactualizado
— **sin `git fetch` previo**, error que el board multi-chat del backend evita
pero el repo FE no cubre. Al detectar el conflicto en el push, se descartó la
implementación duplicada (queda como referencia en la rama local
`feat/rebalance-ui-113-115`; la remota se eliminó) y se integró SOLO el delta
que a origin le faltaba: la prioridad, que era el pedido original del dueño.

**Regla para el futuro: `git fetch origin && git status -sb` ANTES de
implementar en este repo.**

**Entregado (rama `feat/prioritize-held-ui-117`, sobre origin/master):**
- `portfolioService.ts`: `prioritize_held` en `RebalanceRequest`,
  `prioritize_held`/`held_kept` en `RebalanceDiffSummary`, key de auditoría en
  `RebalanceSpecUsed`.
- `RebalancePortfolioModal.tsx`: checkbox "Prioritize current holdings"
  (setup), flag en `buildRequest()` (viaja en preview y confirm), badge
  "N kept by priority" en el resumen del preview.
- `PortfolioRebalancesTab.tsx`: chip "N kept" en la fila del historial.
- `RebalanceDetailModal.tsx`: "Prioritized current holdings" en la línea del
  spec auditado.
- E2E `rebalance-117-prioritize-held.spec.ts` (3 tests): flag en ambos
  requests + badge, default false, chip + línea de spec en el historial.

## Outcome — SUCCESS (2026-07-24)

Oráculos: build tsc+vite ✅; e2e nuevos **3/3 verdes**; lint sin errores
nuevos (6 pre-existentes de master, ninguno en archivos tocados). Hallazgos
de entorno para futuros e2e:

1. **Campana de alertas**: `NotificationsBell` (layout) consulta
   `/alerts/events/unread-count`; con backend local vivo y token fake → 401 →
   logout de la sesión sembrada. Mockear SIEMPRE `**/alerts/events/**` — y
   NUNCA `**/alerts/**`, porque ese patrón intercepta los módulos de Vite de
   `src/features/alerts/*` y rompe la carga de la app entera.
2. **La suite e2e completa está rota en local** también en master (~46
   fallos, flaky) — pre-existente; los specs anteriores a la campana no la
   mockean. Pendiente de saneo global.
