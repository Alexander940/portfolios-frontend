# Overview

## Propósito

`portfolios-frontend` es la interfaz web de una aplicación de gestión de portafolios de inversión. El backend al que consume expone una API REST en `VITE_API_URL` (por defecto `https://api.portfolios.dynamicadvisors.co/api/v1`) y la SPA ofrece:

- **Autenticación** con JWT y opción de "recordarme".
- **Screener de acciones** con filtros complejos, ordenamiento, paginación, presets de columnas y URL state sync.
- **Análisis de portafolios**: listado de portafolios del usuario y vista de detalle con sus posiciones.
- **Flujo "Save as Portfolio"**: convertir los resultados de un screening en un portafolio persistido.
- Varias páginas placeholder para secciones futuras (alerts, markets, strategy builder, rank, etc.).

La UI está en **inglés** y usa un sistema de diseño propio (tema "Prime", basado en un handoff de Claude Cloud Design) implementado con variables CSS — sin librerías de componentes externas.

## Principios arquitectónicos

1. **Feature-sliced design.** Cada dominio (auth, screener, portfolio) es un módulo autocontenido en `src/features/<feature>/` con sus propios `components/`, `hooks/`, `services/`, `stores/`, `types/` y `index.ts` como barrel export. Ver [project-structure.md](./project-structure.md).
2. **Estado global mínimo.** Solo vive en Zustand lo que es realmente global o atraviesa rutas (auth, screener, modal). El estado local de UI se maneja con `useState` dentro del componente. No hay React Context para estado.
3. **Capa de infraestructura desacoplada.** `src/lib/axios.ts` expone `configureAxiosAuth(callbacks)` y el `authStore` se inyecta ahí; el cliente HTTP no conoce a Zustand.
4. **Validación dual con Zod.** Los formularios definen un schema Zod que sirve tanto para la validación en runtime como para derivar el tipo TypeScript (`z.infer`). Ver [types-and-contracts.md](./types-and-contracts.md).
5. **URL como fuente de verdad para búsquedas.** El screener sincroniza filtros/orden/paginación a query string para que cada búsqueda sea enlazable. Ver [features.md](./features.md#screener).
6. **Lazy loading de páginas.** Todas las páginas del dashboard se cargan con `React.lazy` + `Suspense` para reducir el bundle inicial. Ver [routing.md](./routing.md).

## Mapa mental de alto nivel

```
┌──────────────────────────────────────────────────────────────────┐
│                           App.tsx                                │
│                      (RouterProvider)                            │
└──────────────────────────────────────────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
        ┌──────────────┐             ┌────────────────────────────────────┐
        │  /login      │             │  /dashboard/*                      │
        │ PublicRoute  │             │ ProtectedRoute                     │
        │ LoginPage    │             │ DashboardLayout                    │
        │ + LoginArt   │             │   ├─ Sidebar  (216px)              │
        │ (split pane) │             │   ├─ Topbar   (52px)               │
        └──────────────┘             │   └─ <Outlet/> [+ rail si /analysis]│
                                     └──────────────────┬─────────────────┘
                                                        │
                               ┌──────────────┬─────────┴──────┐
                               ▼              ▼                ▼
                        OverviewPage    ScreeningPage   PortfolioAnalysisPage
                                          │                    │
                                          ▼                    ▼
                                   features/screener   features/portfolio
```

El layout dashboard es un grid `app-shell` con sidebar persistente a la izquierda + topbar arriba. Solo `/dashboard/analysis` (lista) muestra el rail derecho `RelevantEventsRail` — el `DashboardLayout` lo activa vía `useLocation()`.

```
┌───────────────────┐   inyecta callbacks    ┌───────────────────┐
│   useAuthStore    │ ─────────────────────▶ │   lib/axios.ts    │
│   (Zustand)       │   getToken / onAuthErr │   (apiClient)     │
└─────────▲─────────┘                        └─────────┬─────────┘
          │                                            │ Bearer <token>
          │ login / logout                             ▼
          │                                   ┌───────────────────┐
          │                                   │   Backend REST    │
          │                                   │  VITE_API_URL     │
          │                                   └─────────┬─────────┘
          │              401                            │
          └─────────────────────────────────────────────┘
```

## Decisiones clave

| Decisión | Razón |
|---------|-------|
| Zustand en vez de Redux | Boilerplate mínimo, integración directa con hooks, middleware `persist` nativo. |
| React Router v7 | Lazy loading con dynamic imports, nested routes, preservación de `location.state.from` para redirect post-login. |
| Tailwind CSS v4 sin config file | La v4 permite definir tokens en `@theme` dentro de CSS; el proyecto usa variables CSS directas (OKLCH) en `src/index.css`. |
| Tokens JWT en Web Storage | `localStorage` cuando "remember me" está activo, `sessionStorage` cuando no. Se acepta el trade-off de XSS a cambio de persistencia en SPA. Ver [authentication.md](./authentication.md). |
| Sin unit tests, solo Playwright E2E | Suite E2E en `tests/e2e/` con `@playwright/test`. No hay `*.test.ts` en `src/` al momento de escribir este doc. |
| Mensajes en inglés y mapeados desde detalles del backend | `lib/apiErrors.ts` traduce `detail` del backend a mensajes user-friendly. |
| Tema "Prime" desde Claude Cloud Design | El sistema visual se exportó como un bundle HTML/CSS/JS y se portó a `index.css` con los tokens `--c-*` OKLCH. Ver [ui-design-system.md](./ui-design-system.md). |

## Estado actual (snapshot 2026-04-20)

- **Producción-ready:** auth, screener, portfolio analysis (lista + detalle + save-as-portfolio).
- **Placeholders:** AlertsPage, MarketsPage, RankPage, StrategyBuilderPage, StrategyTrackerPage.
- **No implementado aún:** recuperación de contraseña (`/forgot-password` referenciado en `LoginForm` sin ruta), menú móvil integrado, error boundaries, analytics, i18n runtime.
