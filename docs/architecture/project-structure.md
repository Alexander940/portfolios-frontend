# Project Structure

## Árbol de `src/`

```
src/
├── App.tsx                    # <RouterProvider router={router} />
├── main.tsx                   # ReactDOM.createRoot + <App />
├── index.css                  # @import tailwindcss + tokens + layout del app-shell
├── vite-env.d.ts
│
├── assets/                    # Estáticos (actualmente vacío)
│
├── components/
│   ├── navigation/            # Sidebar, Topbar, SearchBar
│   ├── symbol/                # SymbolModal (autocomplete + chart de ticker)
│   └── ui/                    # Primitivos reutilizables: Button, Input, Checkbox, Modal, MultiSelect
│
├── config/
│   └── navigation.ts          # NAV_SECTIONS / NAV_ITEMS para el sidebar
│
├── features/                  # Módulos de dominio (feature-sliced design)
│   ├── auth/
│   │   ├── components/        # LoginForm, RegisterForm, RegisterModal
│   │   ├── hooks/             # useAuth
│   │   ├── services/          # authService (login, register, getCurrentUser)
│   │   ├── stores/            # useAuthStore, useModalStore
│   │   ├── types/             # auth.types.ts
│   │   └── index.ts           # barrel
│   ├── portfolio/
│   │   ├── components/        # Portfolio, PortfolioHeader, PortfoliosTable,
│   │   │                      # PortfolioPositionsTable, PortfolioStatCards,
│   │   │                      # RelevantEventsRail
│   │   └── index.ts
│   └── screener/
│       ├── components/        # Screener, PrimaryFilters, AdditionalFiltersMenu,
│       │                      # ActiveFilters, FilterModal, ResultsTable,
│       │                      # ColumnPresetTabs, SavePortfolioModal, TablePagination
│       ├── constants/         # filterDefinitions.ts (filtros, columnas, ratings)
│       ├── hooks/             # useScreenerData, useScreenerOptions, useScreenerUrlSync
│       ├── services/          # screenerService
│       ├── stores/            # useScreenerStore
│       ├── types/             # screener.types.ts
│       └── index.ts
│
├── hooks/                     # Hooks transversales
│   └── useFocusTrap.ts
│
├── layouts/
│   └── DashboardLayout.tsx    # app-shell: sidebar + topbar + content [+ rail]
│
├── lib/                       # Infraestructura transversal
│   ├── axios.ts               # apiClient + interceptores + configureAxiosAuth
│   └── apiErrors.ts           # transformAxiosError + mensajes en inglés
│
├── pages/                     # Thin wrappers sobre features; cada ruta → una página
│   ├── LoginPage.tsx
│   ├── LoginArt.tsx           # Panel decorativo izquierdo del login (gradient + glass cards)
│   └── dashboard/
│       ├── OverviewPage.tsx
│       ├── PortfolioAnalysisPage.tsx
│       ├── ScreeningPage.tsx
│       ├── AlertsPage.tsx           # placeholder
│       ├── MarketsPage.tsx          # placeholder
│       ├── RankPage.tsx             # placeholder
│       ├── StrategyBuilderPage.tsx  # placeholder
│       └── StrategyTrackerPage.tsx  # placeholder
│
├── routes/
│   ├── router.tsx             # createBrowserRouter + lazy imports
│   ├── ProtectedRoute.tsx
│   └── PublicRoute.tsx
│
├── services/                  # Servicios cross-feature (no viven en una feature)
│   ├── portfolioService.ts    # CRUD + positions + from-screener
│   └── symbolService.ts       # Autocomplete de tickers
│
└── types/
    └── index.ts               # ApiError, PaginationMeta, User, FormStatus
```

## Árbol de la raíz

```
portfolios-frontend/
├── public/                    # Estáticos servidos tal cual (vite.svg)
├── src/                       # (ver arriba)
├── tests/
│   └── e2e/                   # Playwright tests
├── Tools/
│   ├── scripts/
│   └── prompts/
├── docs/
│   ├── architecture/          # (este directorio)
│   ├── decisions/
│   └── runbooks/
├── dist/                      # Output del build (gitignored)
├── .env.example
├── eslint.config.js
├── index.html
├── package.json
├── playwright.config.ts
├── tsconfig.json              # project references
├── tsconfig.app.json
├── tsconfig.node.json
├── vercel.json                # rewrite SPA a /index.html
└── vite.config.ts
```

## Feature-sliced design — convenciones

Cada feature en `src/features/<feature>/` sigue esta forma:

```
<feature>/
├── components/
├── hooks/
├── services/
├── stores/
├── types/
├── constants/     # opcional (ejemplo: screener)
└── index.ts       # barrel con la API pública
```

**Reglas:**

1. **Solo se importa desde el barrel**. Un consumidor externo hace `import { useAuth } from '@/features/auth'`, nunca `from '@/features/auth/hooks/useAuth'`. Dentro de la feature sí se puede importar por ruta absoluta.
2. **Sin imports cruzados entre features**. Si `portfolio` necesita algo de `screener`, ese algo debería subir a `src/services/` o a `src/types/`. Ejemplo actual: `portfolioService` vive en `src/services/` porque lo consumen tanto el screener (save-as-portfolio) como la feature portfolio.
3. **El barrel es el contrato.** Cambios dentro de una feature que no alteren su `index.ts` no deben romper consumidores.

## Carpetas fuera de `features/`

- **`components/ui/`** — primitivos agnósticos de dominio (`Button`, `Input`, `Modal`, etc.). Cualquier feature puede usarlos.
- **`components/navigation/`, `components/symbol/`** — componentes compartidos específicos (sidebar, modal de símbolo) que se usan en varias pantallas.
- **`layouts/`** — estructuras de página completas (`DashboardLayout`).
- **`lib/`** — infraestructura (axios, error handling). No conoce dominios.
- **`services/`** (top-level) — servicios de API que cruzan features.
- **`types/`** — solo tipos realmente globales (`ApiError`, `PaginationMeta`, `User`). Los tipos de dominio viven en la feature.
- **`hooks/`** — hooks transversales (`useFocusTrap`). Hooks de dominio viven en la feature.
- **`config/`** — constantes de la app (navegación del sidebar).

## Alias `@/`

Configurado en `vite.config.ts` y `tsconfig.app.json`:

```ts
// vite.config.ts
resolve: { alias: { '@': path.resolve(__dirname, './src') } }

// tsconfig.app.json
"paths": { "@/*": ["./src/*"] }
```

Siempre usar `@/` en vez de paths relativos profundos (`../../../`). Permite mover archivos sin romper imports.
