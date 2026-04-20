# Routing

## Librería

`react-router-dom` v7 con `createBrowserRouter` + `RouterProvider`. Todo el árbol vive en `src/routes/router.tsx`.

## Tabla de rutas

| Path | Componente | Guard | Notas |
|------|-----------|-------|-------|
| `/` | `<Navigate to="/dashboard" />` | — | Redirect base. |
| `/login` | `LoginPage` | `PublicRoute` | Redirige a `/dashboard` si el usuario ya está autenticado. |
| `/dashboard` | `DashboardLayout` + `OverviewPage` (index) | `ProtectedRoute` | Layout con sidebar + topbar; `OverviewPage` es el hijo `index`. |
| `/dashboard/alerts` | `AlertsPage` | `ProtectedRoute` | Placeholder. |
| `/dashboard/strategy` | `StrategyTrackerPage` | `ProtectedRoute` | Placeholder. |
| `/dashboard/markets` | `MarketsPage` | `ProtectedRoute` | Placeholder. |
| `/dashboard/screening` | `ScreeningPage` | `ProtectedRoute` | Envuelve `features/screener`. |
| `/dashboard/analysis` | `PortfolioAnalysisPage` | `ProtectedRoute` | Vista lista de portafolios. |
| `/dashboard/analysis/:portfolioId` | `PortfolioAnalysisPage` | `ProtectedRoute` | Vista detalle — el mismo componente lee `useParams()` y cambia de modo. |
| `/dashboard/rank` | `RankPage` | `ProtectedRoute` | Placeholder. |
| `/dashboard/builder` | `StrategyBuilderPage` | `ProtectedRoute` | Placeholder. |
| `*` | `<Navigate to="/dashboard" />` | — | Catch-all 404. |

## Guards

### `ProtectedRoute` (`src/routes/ProtectedRoute.tsx`)

- Lee `isAuthenticated` desde `useAuthStore`.
- Si es `false`, renderiza `<Navigate to="/login" state={{ from: location }} replace />`.
- El `state.from` se consume después en `useAuth.login()` para regresar al usuario a la ruta que originalmente intentó visitar.

### `PublicRoute` (`src/routes/PublicRoute.tsx`)

- Espejo de `ProtectedRoute`: si `isAuthenticated === true`, redirige a `/dashboard`.
- Envuelve únicamente `/login`.

Ambos guards son componentes que envuelven el `element` en `router.tsx`. No hay loaders/actions de React Router v7 — la app no usa data routing.

## Inicialización de sesión y carrera contra las rutas

`useAuth()` en `main.tsx`/la capa superior llama a `initialize()` dentro de un `useEffect`, el cual dispara `checkAuth()`. Mientras `isInitialized === false`, el valor de `isAuthenticated` puede ser `false` todavía, así que una navegación temprana hacia `/dashboard/*` podría caer primero en `/login` y luego devolverse.

El proyecto acepta este flash porque `checkAuth()` es casi instantáneo (solo lee storage) y solo hace un request si hay token. Si se vuelve un problema, se añadiría un splash que espere a `isInitialized === true`.

## Lazy loading

Todas las páginas del dashboard se declaran con `React.lazy(() => import(...))` y se envuelven con `<Suspense fallback={<PageLoader />}>`. Ejemplo:

```tsx
const ScreeningPage = lazy(() => import('@/pages/dashboard/ScreeningPage'));
```

Efectos:

- Bundle inicial solo trae `LoginPage` + `DashboardLayout` + `OverviewPage`.
- Cada página extra se descarga bajo demanda al navegar.
- El `PageLoader` es un spinner (`Loader2` de lucide) centrado.

## Layout anidado

`DashboardLayout` declara `<Outlet />` donde se inyectan las páginas hijo. El layout incluye:

- `Sidebar` con `NAV_SECTIONS` de `src/config/navigation.ts`.
- `Topbar` con búsqueda (`SearchBar`), botón "+ New portfolio", indicador "As of …", campana de alertas y menú de usuario (avatar con dropdown que contiene "Sign out").
- `<main>` con la página actual.
- Panel derecho `RelevantEventsRail` (`has-rail` en la grid `app-shell`). **Solo se renderiza cuando `useLocation().pathname === '/dashboard/analysis'`** — no es un slot genérico disponible para cualquier ruta. Si en el futuro otra vista necesita rail propio, hay que extender la lógica del layout.

## Deep links y refresh

El proyecto se despliega como SPA pura. `vercel.json` redirige todas las rutas a `/index.html`, lo que permite recargar `/dashboard/analysis/abc-123` sin 404. Ver [build-and-deployment.md](./build-and-deployment.md).
