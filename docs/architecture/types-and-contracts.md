# Types & Contracts

TypeScript está en modo `strict` con `verbatimModuleSyntax: true`. Los tipos viven en tres lugares, dependiendo de su alcance.

## Tipos globales — `src/types/index.ts`

Solo tipos que cruzan toda la aplicación:

```ts
// Contratos de error con el backend
interface ApiErrorResponse {
  detail: string;          // formato FastAPI-style
}

interface ApiError {
  message: string;         // mensaje ya traducido para mostrar al usuario
  status: number;          // HTTP status (0 si no hubo respuesta)
  detail?: string;         // detail crudo del backend, para debug
}

// Paginación genérica
interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// Usuario autenticado
interface User {
  id: number;
  username: string;
  email: string;
}

// Utilidad para estado de forms
type FormStatus = 'idle' | 'submitting' | 'success' | 'error';
```

**Regla:** no meter aquí tipos de dominio. Si un tipo es del screener, vive en `features/screener/types/`.

## Tipos de dominio — por feature

### `features/auth/types/auth.types.ts`

```ts
// Requests
interface LoginCredentials { email: string; password: string; rememberMe?: boolean; }
interface RegisterData { email: string; username: string; password: string; first_name?: string; last_name?: string; }

// Responses del backend
interface LoginApiResponse { access_token: string; token_type: string; }
interface RegisterApiResponse { user_id: number; email: string; username: string; first_name?: string; last_name?: string; subscription_tier: string; is_active: boolean; created_at: string; }
type CurrentUserResponse = User;

// Forma del store
interface AuthState { user, accessToken, isAuthenticated, isLoading, isInitialized, error }
interface AuthActions { login, register, logout, clearError, setUser, checkAuth, initialize }
type AuthStore = AuthState & AuthActions;
```

Nótese que los nombres de campo respetan el `snake_case` del backend cuando vienen de la red; se transforman a `camelCase` solo si la UI los maneja diferente (raro).

### `features/screener/types/screener.types.ts`

Es el archivo con más tipos propios. Los bloques principales:

```ts
// Filtros genéricos
interface RangeFilter { min?: number; max?: number; }
type FilterValue = RangeFilter | string[] | boolean | null;
type FilterType = 'range' | 'boolean' | 'multiselect';

interface FilterDefinition {
  key: string;                // id interno
  label: string;              // etiqueta UI
  category: 'Trend' | 'Fundamentals' | 'Performance' | 'Others';
  type: FilterType;
  apiKey: string;             // nombre del campo en el request al backend
  description?: string;
  unit?: string;
}

// Dominio
type RatingLetter = 'A' | 'B' | 'C' | 'D';
interface Stock { /* ~22 campos: ticker, name, rating, return_1m, pe_ratio, ... */ }

// Contrato con el backend
interface ScreenerRequest { /* todos los filtros opcionales + paginación */ }
interface ScreenerResponse { results: Stock[]; total_count: number; limit: number; offset: number; }
interface ScreenerOptions { countries: string[]; exchanges: string[]; sectors: string[]; }

// Tabla
interface TableColumn {
  key: keyof Stock;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: string;
  format?: (value: unknown) => string;
}
```

La coherencia entre `FilterDefinition.apiKey` y los campos de `ScreenerRequest` no está validada por el tipo — es un acoplamiento implícito que habría que mantener con cuidado si se agrega un filtro.

### Tipos de portfolio — `src/services/portfolioService.ts`

Actualmente están inline en el servicio (vive en `src/services/`, no en una feature). Si la feature `portfolio` crece, mover estos tipos a `features/portfolio/types/`:

```ts
interface PortfolioResponse { portfolio_id, name, description, portfolio_type, weighting_method, screener_filters, created_at, updated_at }
interface PortfolioFromScreenerCreate { name, description?, initial_cash?, weighting_method?, screener_filters }
interface PortfolioPositionDetail { position_id, ticker, quantity, weight_pct, unrealized_pnl_pct, current_rating, rating_changed }
type PositionSortField = 'weight' | 'pnl_pct' | 'ticker' | 'entry_date' | 'current_value';
type WeightingMethod = 'equal' | 'rating_weighted' | 'market_cap';
```

## Patrón de validación con Zod

Los forms definen un schema Zod primero, y derivan el tipo TypeScript con `z.infer`. Esto evita duplicar (schema vs interface) y garantiza que el runtime y el tipo no divergen:

```ts
const schema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof schema>;

const form = useForm<LoginFormValues>({ resolver: zodResolver(schema) });
```

Mensajes de error en inglés en los propios schemas. No se comparten schemas entre front y back (no hay monorepo); cada lado mantiene sus validaciones y se confía en el manejo de errores del backend para lo no cubierto aquí.

## `import type` y `verbatimModuleSyntax`

Con `verbatimModuleSyntax: true`, importar tipos requiere `import type`:

```ts
// ✅
import type { User } from '@/types';
import { login } from '@/features/auth';

// ❌  — el build falla
import { User } from '@/types';
```

Esto asegura que los tipos nunca se incluyen en el bundle en runtime (útil cuando un archivo solo exporta tipos y no debe generar un chunk).

## Reglas para agregar tipos

1. **¿Lo usa una sola feature?** → `features/<feature>/types/` y exportar desde el barrel.
2. **¿Lo usan varias features o el lib layer?** → `src/types/`.
3. **¿Es el shape de un form?** → derivarlo con `z.infer` del schema Zod; no escribir interfaces paralelas.
4. **¿Es un alias de union literal?** → preferir `type`, no `interface`.
5. **¿Es una respuesta del backend?** → nombrarlo con sufijo `Response` o `ApiResponse` y mantener los nombres de campo en el formato que envía el backend (usualmente `snake_case`).
6. **¿Extiende un tipo global?** → usar `interface X extends Y` en vez de `type X = Y & {...}` para herencia limpia.
