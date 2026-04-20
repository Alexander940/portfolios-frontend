# API Layer

Toda la comunicación con el backend pasa por un único cliente axios (`apiClient`) configurado en `src/lib/axios.ts`. Los servicios por dominio consumen ese cliente; nadie instancia axios directamente.

## Cliente HTTP — `src/lib/axios.ts`

### Configuración base

```ts
apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  timeout: import.meta.env.VITE_API_TIMEOUT ?? 30000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});
```

### Interceptor de request

- Inyecta `Authorization: Bearer <token>` si el callback `getAccessToken()` devuelve un valor.
- En desarrollo (`import.meta.env.DEV`) loguea `[API Request] METHOD URL`.

### Interceptor de response

- En desarrollo loguea `[API Response] METHOD URL STATUS`.
- Si el error es `401` **y había un token** en el request, llama `handleAuthError()` (registrado por el auth store → `logout()`). La condición "había token" evita que el 401 natural del login (credenciales incorrectas) dispare un logout.
- Siempre transforma el error axios en un `ApiError` tipado vía `transformAxiosError(err)` y lo re-lanza.

### Inyección de dependencias con callbacks

`lib/axios.ts` no importa el store de auth. En su lugar expone:

```ts
configureAxiosAuth({
  getToken: () => string | null,
  onAuthError: () => void,
});
```

El `authStore` (al cargarse) llama esta función y le pasa `() => useAuthStore.getState().accessToken ?? getTokenFromStorage()` y `() => useAuthStore.getState().logout()`. Así se evita el ciclo de dependencia `axios ↔ authStore`.

## Transformación de errores — `src/lib/apiErrors.ts`

`transformAxiosError(err)` normaliza cualquier error de axios a esta forma:

```ts
interface ApiError {
  message: string;   // Mensaje legible en inglés para mostrar al usuario
  status: number;    // HTTP status (0 si no hubo respuesta)
  detail?: string;   // detail crudo del backend, para debug
}
```

Reglas aplicadas:

| Situación | Resultado |
|-----------|-----------|
| Sin respuesta (`err.response === undefined`) | `NETWORK_ERROR` o `TIMEOUT` si `err.code === 'ECONNABORTED'`. |
| `401` | `UNAUTHORIZED` — "Correo electrónico o contraseña incorrectos" si no hay token; "Tu sesión ha expirado..." si había token. |
| `409` con `email` en el detail | `EMAIL_EXISTS`. |
| `409` con `username` en el detail | `USERNAME_EXISTS`. |
| `500..504` | `SERVER_ERROR` genérico. |
| Otros | Se intenta mapear `detail` con `mapErrorDetail()`; si no matchea, `UNKNOWN_ERROR`. |

El guard `isApiError(e)` verifica la forma `{ message, status }` para uso en `catch`.

## Catálogo de servicios

Cada servicio es un objeto/función que envuelve endpoints de un recurso. Todos devuelven el tipo de dominio ya parseado y dejan que axios re-lance el `ApiError`.

### `authService` — `src/features/auth/services/authService.ts`

| Método | Endpoint | Notas |
|--------|----------|-------|
| `login(credentials)` | `POST /auth/login` | `application/x-www-form-urlencoded`. Campo `username` contiene el email (convención OAuth2 password grant del backend). |
| `register(data)` | `POST /auth/register` | JSON. No autentica; el usuario debe hacer login después. |
| `getCurrentUser()` | `GET /auth/me` | Requiere token. Se usa tras login y durante `checkAuth()`. |

### `screenerService` — `src/features/screener/services/screenerService.ts`

| Método | Endpoint | Notas |
|--------|----------|-------|
| `screenStocks(filters, signal?)` | `POST /screener/` | Acepta `AbortSignal` para cancelación. Antes de enviar, limpia campos vacíos/`null` del body. |
| `getOptions()` | `GET /screener/options` | Devuelve countries, exchanges, sectors disponibles. |

### `portfolioService` — `src/services/portfolioService.ts`

Vive en `src/services/` (no dentro de una feature) porque lo usan tanto `features/portfolio` como `features/screener` (el botón "Save as Portfolio").

| Método | Endpoint | Notas |
|--------|----------|-------|
| `listPortfolios(limit, offset, signal?)` | `GET /portfolios/` | Paginado. |
| `getPortfolio(portfolioId, signal?)` | `GET /portfolios/{id}` | Metadata del portafolio. |
| `listPortfolioPositions(portfolioId, params, signal?)` | `GET /portfolios/{id}/positions` | Params: `sort_by`, `sort_order`, `limit`, `offset`. |
| `createPortfolioFromScreener(payload, signal?)` | `POST /portfolios/from-screener` | Crea un portafolio a partir de filtros y opciones (initial_cash, weighting_method). |

### `symbolService` — `src/services/symbolService.ts`

- Autocompletado de tickers usado por el `SymbolModal` en la topbar. Expone búsqueda y probablemente fetch de datos básicos del símbolo.

## Cómo propagan errores los servicios

1. El servicio ejecuta `apiClient.request(...)`.
2. Si axios rechaza, el interceptor de response lo transforma en `ApiError` y lo re-lanza.
3. El servicio NO lo atrapa — deja que burbujee.
4. El caller (store o hook) hace `try/catch`:
   - Pone `isLoading = false`.
   - Setea `error = err.message` en el store.
   - Opcionalmente rethrow para que el componente reaccione.
5. El componente lee `error` desde el store y lo muestra.

## Cancelación de requests

Tres casos la usan:

- **`useScreenerData()`**: al cambiar filtros rápido, cancela la request anterior antes de lanzar la nueva.
- **Vista de detalle de portfolio**: al navegar entre portafolios o desmontar, aborta el fetch pendiente.
- **Búsqueda por símbolo en la topbar**: al teclear rápido, cancela sugerencias anteriores.

El patrón es:

```ts
const controller = new AbortController();
service.method(args, controller.signal);
// en el cleanup:
controller.abort();
```

Axios propaga `AbortSignal`; el error resultante tiene `err.name === 'CanceledError'` y se ignora en `catch`.

## Logging

Solo en dev (`import.meta.env.DEV`). No hay Sentry, Datadog RUM u otro sink en producción. Si se integra, el lugar natural es el interceptor de response con una rama para errores ≥ 500.

## Convenciones al agregar un endpoint

1. Crear o extender el servicio que corresponda (por dominio).
2. Tipar el request y la respuesta con interfaces en `<feature>/types/` o `src/types/`.
3. Devolver el tipo directamente — no envolver en `Result`/`Either`, no tragar errores.
4. Si el request puede ser largo o abortable, aceptar `signal?: AbortSignal`.
5. No meter lógica de mapeo complejo dentro del servicio; si el backend devuelve una forma hostil, normalizar en una función aparte (`adapters/` o similar) y que el servicio la llame.
