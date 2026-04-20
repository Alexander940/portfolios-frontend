# Features

Cada feature vive en `src/features/<name>/` y expone su API pública vía `index.ts`. Este documento describe **qué** hace cada feature implementada y **cómo** está compuesta por dentro. Las piezas transversales (routing, auth, estado) ya están cubiertas en sus propios archivos.

## Screener — `src/features/screener/`

### Qué resuelve

Permite filtrar miles de acciones por criterios combinables (mercado, sector, rating, métricas numéricas, flags booleanos), ordenar, paginar y elegir qué columnas ver. El estado de búsqueda se refleja en la URL para que cualquier búsqueda sea enlazable. Desde los resultados se puede crear un portafolio.

### Anatomía

```
screener/
├── components/
│   ├── Screener.tsx              # Orquestador principal
│   ├── PrimaryFilters.tsx        # Dropdowns: Mercado / Sector / Rating
│   ├── AdditionalFiltersMenu.tsx # Botón "Más filtros" + menú por categoría
│   ├── ActiveFilters.tsx         # Chips con filtros activos y botón "limpiar"
│   ├── FilterModal.tsx           # UI genérica para range / boolean / multiselect
│   ├── ColumnPresetTabs.tsx      # Tabs: Overview / Trend / Performance / Fundamentals / All
│   ├── ResultsTable.tsx          # Tabla con columnas según preset
│   ├── TablePagination.tsx       # Controles de paginación
│   └── SavePortfolioModal.tsx    # Crear portafolio desde los resultados
├── constants/
│   └── filterDefinitions.ts      # Definición de filtros, columnas y mapeo de ratings
├── hooks/
│   ├── useScreenerData.ts        # Fetch con debounce + AbortController
│   ├── useScreenerOptions.ts     # Carga las listas para los dropdowns
│   └── useScreenerUrlSync.ts     # URL ↔ store (bidireccional)
├── services/
│   └── screenerService.ts
├── stores/
│   └── screenerStore.ts
└── types/
    └── screener.types.ts
```

### Flujo de datos

```
URL querystring  ◀──────── useScreenerUrlSync ────────▶  useScreenerStore
                                                              │
                                                              ▼
                                                      getApiRequest()
                                                              │
                                                              ▼
                     useScreenerData (debounce 400ms + AbortController)
                                                              │
                                                              ▼
                                                    screenerService.screenStocks
                                                              │
                                                              ▼
                                                       ResultsTable + Pagination
```

- El componente raíz es `Screener.tsx`. Es un wrapper visual; no tiene lógica compleja: instancia los hooks y renderiza sub-componentes.
- `PrimaryFilters`, `AdditionalFiltersMenu`, `ActiveFilters`, `FilterModal` todos leen y escriben en `useScreenerStore`. No se pasan props entre ellos — el store es el punto de sincronización.
- `useScreenerUrlSync` corre en el mount: lee `URLSearchParams`, llama `store.hydrateFromUrl(params)`, y luego en cada cambio del store actualiza la URL con `navigate(..., { replace: true })`.
- `useScreenerData` suscribe al estado relevante del store, construye el request y fetchea. En cada cambio:
  1. Aborta el request anterior (AbortController).
  2. Espera 400ms (debounce).
  3. Lanza `screenerService.screenStocks(request, signal)`.
  4. Setea `data`, `totalCount`, `isLoading`, `error`.

### Definiciones de filtro — por qué un solo archivo

`constants/filterDefinitions.ts` concentra tres cosas acopladas que conviene mantener juntas:

1. **Filtros disponibles** — cada uno con `key`, `label`, `category` (Trend / Fundamentals / Performance / Others), `type` (`range | boolean | multiselect`), `apiKey`, `unit?`, `description?`.
2. **Presets de columnas** — qué columnas de `Stock` mostrar por preset, con formato de celda (porcentaje con signo, ratings como letra, liquidez en B/M, etc.).
3. **Mapeo de ratings** — letra ↔ código numérico, colores por rating.

Como el `FilterModal` es genérico y renderiza UI según `filter.type`, agregar un filtro nuevo se reduce a declararlo aquí; la tabla y el menú se actualizan solos.

### Column presets

- 5 presets: `overview`, `trend`, `performance`, `fundamentals`, `all`.
- `Ticker` y `Name` siempre pinned a la izquierda (sticky), independiente del preset.
- El preset seleccionado se persiste en `localStorage` (única pieza persistida del screener store).
- Implementado en `ColumnPresetTabs` + lógica de render en `ResultsTable`.

### Save as Portfolio

`SavePortfolioModal` abre un formulario (Zod + RHF) que pide:

- `name` (requerido)
- `description?`
- `initial_cash?` (defaults a un valor del backend)
- `weighting_method` (`equal | rating_weighted | market_cap`)

Al enviar llama `portfolioService.createPortfolioFromScreener({ ...form, screener_filters })`, donde `screener_filters` sale de `store.getApiRequest()`. En éxito, navega a `/dashboard/analysis/:portfolioId`.

No existe límite de acciones en el modal (el commit `4592341` lo removió explícitamente).

## Portfolio Analysis — `src/features/portfolio/`

### Qué resuelve

Listar los portafolios del usuario y, al hacer click en uno, ver su detalle con posiciones ordenables.

### Anatomía

```
portfolio/
├── components/
│   ├── Portfolio.tsx               # Router list vs detail según useParams()
│   ├── PortfolioHeader.tsx         # Nombre, descripción, stats rápidos del detalle
│   ├── PortfoliosTable.tsx         # Lista clickeable (vista list)
│   ├── PortfolioPositionsTable.tsx # Posiciones con sort (vista detalle)
│   ├── PortfolioStatCards.tsx      # Cards con métricas del portafolio
│   └── RelevantEventsRail.tsx      # Panel derecho (app-shell has-rail)
└── index.ts
```

No hay `hooks/`, `services/`, `stores/` ni `types/` propios — la feature usa:

- `src/services/portfolioService.ts` para los fetches.
- `useState` local para `portfolios`, `selectedPortfolio`, `positions`, `isLoading`, `error`.

### Dos modos: lista y detalle

`Portfolio.tsx` es el switch. Lee `useParams<{ portfolioId?: string }>()`:

- **Sin `portfolioId`**: modo lista.
  - Fetch `listPortfolios()` al montar.
  - Renderiza `PortfoliosTable` con filas clickeables que hacen `navigate('/dashboard/analysis/:portfolioId')`.
  - Activa la clase `has-rail` en el layout para mostrar `RelevantEventsRail` a la derecha.
  - Antes del commit `3802855` la ruta `/dashboard/analysis` hacía auto-redirect al primer portafolio; ahora siempre muestra lista.

- **Con `portfolioId`**: modo detalle.
  - Fetch en paralelo: `getPortfolio(id)` + `listPortfolioPositions(id, { sort_by, sort_order })`.
  - Renderiza `PortfolioHeader` + `PortfolioStatCards` + `PortfolioPositionsTable`.
  - Botón "Volver" regresa a `/dashboard/analysis`.
  - Si `getPortfolio` responde 404, redirige a la lista.

### Cancelación en la navegación entre portafolios

Al cambiar `portfolioId` (o desmontar), el `useEffect` aborta los requests previos. Sin esto, cambiar rápido entre portafolios generaba race conditions donde el response más lento pisaba al más nuevo.

### Orden de posiciones

El backend acepta `sort_by ∈ { weight, pnl_pct, ticker, entry_date, current_value }` y `sort_order ∈ { asc, desc }`. La tabla lo controla con un click en el header de columna; el estado vive en `useState` local del componente raíz y se pasa como prop.

## Auth — `src/features/auth/`

Cubierto exhaustivamente en [authentication.md](./authentication.md). Piezas:

- **Components**: `LoginForm`, `RegisterForm`, `RegisterModal`.
- **Hook**: `useAuth` (navegación + store).
- **Service**: `authService` (login, register, getCurrentUser).
- **Stores**: `useAuthStore`, `useModalStore`.
- **Types**: `auth.types.ts`.

## Pages placeholder

Las siguientes páginas existen pero son stubs:

- `AlertsPage` — gestión de alertas.
- `MarketsPage` — vista de mercados.
- `RankPage` — rankings de activos.
- `StrategyBuilderPage` — constructor de estrategias.
- `StrategyTrackerPage` — seguimiento de estrategias.

Cuando alguna se implemente, documentarla aquí.

## Componentes compartidos entre features

Viven fuera de `features/`:

- `components/ui/` — primitivos (`Button`, `Input`, `Checkbox`, `Modal`, `MultiSelect`). Ver [ui-design-system.md](./ui-design-system.md).
- `components/navigation/` — `Sidebar`, `Topbar`, `SearchBar`.
- `components/symbol/SymbolModal.tsx` — modal de autocompletado de tickers + chart, lanzado desde la topbar. Consume `symbolService`.
- `layouts/DashboardLayout.tsx` — el app-shell.
