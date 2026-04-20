# Authentication

La feature completa vive en `src/features/auth/`. Toda la lógica está en **tres piezas**: un store Zustand (`useAuthStore`), un hook para los componentes (`useAuth`), y un servicio HTTP (`authService`). Axios conoce el store sólo vía callbacks inyectados.

## Contrato con el backend

| Endpoint | Método | Body | Respuesta |
|---------|--------|------|-----------|
| `/auth/login` | POST | `application/x-www-form-urlencoded` con `username` (email) + `password` | `{ access_token, token_type }` |
| `/auth/register` | POST | JSON `{ email, username, password, first_name?, last_name? }` | `RegisterApiResponse` (datos del usuario creado; no devuelve token) |
| `/auth/me` | GET | — (requiere `Authorization: Bearer`) | `{ id, username, email }` |

Tipos completos en `src/features/auth/types/auth.types.ts`.

## Almacenamiento del token

El proyecto soporta "Remember me":

| Remember me | Storage | Persistencia |
|-------------|---------|-------------|
| `true` | `localStorage` | Sobrevive al cierre del navegador. |
| `false` | `sessionStorage` | Se pierde al cerrar la pestaña. |

La lógica vive en helpers del propio `authStore.ts`:

- `saveTokenToStorage(token, rememberMe)` — escribe en el storage elegido y **limpia el otro** para evitar estados inconsistentes.
- `getTokenFromStorage()` — intenta primero `localStorage`, luego `sessionStorage`. Así un token que haya quedado de una sesión "recordada" previa se sigue leyendo correctamente.
- `clearTokenFromStorage()` — limpia ambos y además borra la clave `auth-storage` (la del middleware `persist`).

> **Trade-off conocido.** Guardar JWT en Web Storage es vulnerable a XSS. Se acepta a cambio de simplicidad y persistencia en una SPA sin cookies server-side. Ver `decisions/` si se revierte.

## El store — `useAuthStore`

Archivo: `src/features/auth/stores/authStore.ts`.

### Estado

```ts
{
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;  // true una vez que checkAuth() corrió
  error: string | null;
}
```

### Acciones

- `login(credentials)` — llama `authService.login`, guarda token, luego llama `getCurrentUser()` para hidratar `user`. Lanza en error.
- `register(data)` — llama `authService.register`. No auto-loguea.
- `logout()` — limpia storage, resetea el estado.
- `checkAuth()` — si hay token en storage, intenta `getCurrentUser()`. Si el servidor devuelve 401, limpia todo.
- `initialize()` — wrapper de `checkAuth()` que al terminar setea `isInitialized = true`.
- `setUser(user)`, `clearError()`.

### Persistencia

Se usa el middleware `persist` de Zustand **sólo para `user` + `isAuthenticated`** (vía `partialize`):

```ts
partialize: (state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
})
```

El `accessToken` **no** se persiste por este middleware — vive en los helpers de storage descritos arriba. Motivo: "remember me" decide a qué storage va el token y no aplica igual al resto del estado.

### Integración con axios

Al cargarse el módulo `authStore.ts`, se ejecuta:

```ts
configureAxiosAuth({
  getToken: () => useAuthStore.getState().accessToken ?? getTokenFromStorage(),
  onAuthError: () => useAuthStore.getState().logout(),
});
```

Esto inyecta dos callbacks en `lib/axios.ts` sin que éste tenga que importar el store. El interceptor de request usa `getToken()` para añadir `Authorization`, y el de response llama `onAuthError()` cuando hay un 401.

## El hook — `useAuth`

Archivo: `src/features/auth/hooks/useAuth.ts`. Envuelve el store y añade navegación:

- `login(credentials)` — tras éxito redirige a `location.state.from.pathname` si existe, o a `/dashboard`.
- `register(data)` — tras éxito redirige a `/login` y setea un `successMessage` en `useModalStore`.
- `logout()` — redirige a `/login`.
- Sus valores devueltos (`user`, `isAuthenticated`, `isLoading`, `isInitialized`, `error`, acciones) son lo único que los componentes consumen.

Adicionalmente, un `useEffect` llama `initialize()` en el mount del hook. Para asegurar que esto corra al arrancar la app, `useAuth()` se instancia en un componente alto en el árbol.

## Flujos end-to-end

### Login

```
LoginForm ──submit──▶ useAuth.login()
                     │
                     └─▶ useAuthStore.login()
                          │
                          ├─▶ authService.login()   ── POST /auth/login (form-urlencoded)
                          │    └─ returns { access_token }
                          │
                          ├─▶ saveTokenToStorage(token, rememberMe)
                          ├─▶ set({ accessToken, isLoading: false })
                          │
                          └─▶ authService.getCurrentUser() ── GET /auth/me
                               └─ returns User
                          └─▶ set({ user, isAuthenticated: true })

useAuth.login ──▶ navigate(from?.pathname ?? '/dashboard')
```

### Registro

```
RegisterForm ──submit──▶ useAuth.register()
                         │
                         └─▶ useAuthStore.register()
                              └─▶ authService.register() ── POST /auth/register (JSON)

useAuth.register ──▶ useModalStore.setSuccessMessage('Cuenta creada...')
                ──▶ navigate('/login')
```

`LoginPage` detecta el `successMessage`, lo muestra como alert verde y lo limpia a los 5 segundos.

### Recuperación de sesión al arrancar

```
app mount ──▶ useAuth() ──useEffect──▶ useAuthStore.initialize()
                                            │
                                            └─▶ checkAuth()
                                                 │
                                                 ├─ no token → isAuthenticated = false
                                                 │
                                                 └─ token → getCurrentUser()
                                                            ├─ 200 → set user, isAuthenticated = true
                                                            └─ 401 → clearTokenFromStorage(), isAuthenticated = false
```

### 401 en request protegido

```
apiClient.request ──▶ 401
                      │
                      └─▶ response interceptor:
                           ├─ si había token → onAuthError() ≡ useAuthStore.logout()
                           │                    └─ limpia storage + resetea store
                           └─ siempre → rethrow transformAxiosError(err) como ApiError
```

Esto es lo que arregla el commit `bb588f7` (*"fix stale isAuthenticated after token loss (401 on protected endpoints)"*): el store persistía `isAuthenticated: true` en `localStorage` y al recargar con un token expirado la app confiaba en ese booleano. Ahora `clearTokenFromStorage()` también borra la clave `auth-storage` del `persist`.

## Validación de formularios (Zod)

Ambos formularios usan `react-hook-form` + `@hookform/resolvers/zod`:

- **Login** (`LoginForm.tsx`): `email` (formato email), `password` (≥6 chars).
- **Registro** (`RegisterForm.tsx`): `email`, `username` (3–100), `password` (≥8), `first_name?`, `last_name?`.

Los mensajes de error se muestran inline con el input (ver `Input` en [ui-design-system.md](./ui-design-system.md)) y los errores globales (login incorrecto, email duplicado) como banner rojo encima del form.

## Mensajes de error en inglés

`lib/apiErrors.ts` traduce el `detail` que devuelve el backend a un mensaje user-friendly en inglés:

- `401` sin token → "Incorrect email or password.".
- `409` con `email already registered` → "This email is already registered.".
- `401` con token presente → "Your session has expired. Please sign in again.".

El store guarda este mensaje en `error` y los forms lo muestran sin transformación adicional.

## Modal store

`useModalStore` (`src/features/auth/stores/modalStore.ts`) controla:

- `activeModal: string | null` — ID del modal abierto (por ejemplo `"register"`).
- `successMessage: string | null` — mensaje post-registro que muestra `LoginPage`.

Vive dentro de `features/auth` porque el único consumidor actual es el flujo de auth (Login ↔ Register). Si se reutiliza para modales genéricos, mover a `src/stores/` o a una feature propia.

## Lo que falta

- `/forgot-password` — referenciado como link en `LoginForm` pero sin ruta registrada en `router.tsx`.
- Refresh tokens — el flujo actual sólo tiene `access_token`; si el backend eventualmente emite refresh, habrá que añadir lógica en el interceptor para reintentar el request original.
- Cierre de sesión multipestaña — si una pestaña hace logout, otras no se enteran hasta hacer request (y recibir 401). Se podría resolver con `window.addEventListener('storage', ...)`.
