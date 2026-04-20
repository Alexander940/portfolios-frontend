# Patterns & Conventions

Este archivo recoge patrones transversales del proyecto — cosas que aparecen en varias features y que conviene describir en un solo lugar para no repetirlas.

## 1. Feature-sliced design

Ver [project-structure.md](./project-structure.md). Regla clave: **se importa desde el barrel**, no desde paths internos. Si necesitas algo que no está exportado en `features/<x>/index.ts`, o expórtalo o reconsidera si pertenece a esa feature.

Cross-feature imports están prohibidos. Si dos features necesitan lo mismo, mover la pieza a `src/lib/`, `src/services/` o `src/types/`. Ejemplo real: `portfolioService` vive en `src/services/` porque lo usan `features/portfolio` (lista/detalle) y `features/screener` (botón "Save as Portfolio").

## 2. URL state sync

**Problema que resuelve:** los filtros del screener son parte del estado del usuario. Perderlos al recargar o al compartir un link es una mala experiencia.

**Solución:** el screener store se espeja en `?query=string` mediante `useScreenerUrlSync()`. Ver [state-management.md](./state-management.md#usescreenerstore).

Cuándo usar este patrón en features nuevas:

- El estado es **complejo pero derivable** (filtros, ordenamientos, paginación).
- El estado debe ser **compartible** (links, bookmarks).
- El estado **no es sensible** (tokens, datos privados NO van a la URL).

Cuándo no usarlo:

- Estado transitorio de UI (modales abiertos, dropdowns expandidos).
- Estado por sesión (mensajes flash, formularios a medio llenar).

## 3. Request cancellation

Todos los fetches que pueden ser disparados en ráfaga (filtros que cambian rápido, navegación entre detalles) usan `AbortController`:

```ts
useEffect(() => {
  const controller = new AbortController();
  portfolioService.getPortfolio(id, controller.signal)
    .then(setPortfolio)
    .catch(err => { if (err.name !== 'CanceledError') setError(err.message); });
  return () => controller.abort();
}, [id]);
```

Axios propaga `signal` automáticamente; el error resultante tiene `err.name === 'CanceledError'` y se ignora en el catch. Sin esto, el response más lento pisa al más nuevo (race condition clásica).

Uso actual: `useScreenerData`, vista de detalle de portfolio, búsqueda de símbolos en la topbar.

## 4. Debounce antes del fetch

`useScreenerData` espera 400ms entre el último cambio y el fetch. Usar este patrón siempre que el input sea de alta frecuencia (teclado, sliders). Complementario al patrón anterior — debounce reduce requests; cancellation garantiza que el response correcto gane.

## 5. Inyección de dependencias para desacoplar capas

Ejemplo canónico: `lib/axios.ts` no conoce `useAuthStore`, aunque necesite leer el token y reaccionar a 401. El store se inyecta al cargarse:

```ts
// authStore.ts — al cargar el módulo
configureAxiosAuth({
  getToken: () => useAuthStore.getState().accessToken ?? getTokenFromStorage(),
  onAuthError: () => useAuthStore.getState().logout(),
});
```

Beneficios: no hay ciclo de dependencias, `axios.ts` es testeable con mocks, el store puede cambiar su estructura interna sin tocar `lib/`.

Usar este patrón cuando una capa de infraestructura necesita callbacks de una capa de dominio.

## 6. Validación con Zod + derivación de tipos

Schema → tipo con `z.infer`. Un solo origen de verdad para la forma y los mensajes. Ver [types-and-contracts.md](./types-and-contracts.md#patrón-de-validación-con-zod).

## 7. Manejo de errores server-side

Flujo estándar:

```
service lanza ApiError
  └─▶ store catch → set({ error: err.message, isLoading: false })
        └─▶ componente lee store.error → lo muestra
```

No envolvemos errores en `Result<T, E>` ni en `Either`. Dejamos que el `throw` llegue al store, que sí lo traduce a estado UI. Los componentes no hacen `try/catch` directamente a menos que necesiten limpieza extra.

Mensajes al usuario ya vienen en inglés desde `transformAxiosError` (ver [api-layer.md](./api-layer.md#transformación-de-errores--srclibapierrorsts)).

## 8. Foco y accesibilidad en modales

`useFocusTrap` (`src/hooks/useFocusTrap.ts`) hace cuatro cosas:

1. Recuerda el elemento que tenía foco antes de abrir.
2. Enfoca el primer elemento focusable del modal.
3. Intercepta `Tab` / `Shift+Tab` para que el foco no escape.
4. Al cerrar, restaura el foco al elemento original.

Cualquier componente con experiencia modal (dialog, drawer, popover con overlay) debe usarlo o replicar su comportamiento.

## 9. Layout grid en vez de flex para estructuras mayores

El app-shell (sidebar + topbar + main + rail) se implementa con CSS Grid, no flex. Razón: las tres dimensiones (dos columnas + una fila) se declaran en un solo `grid-template`, lo cual es más robusto que anidar flexboxes. Ver `.app-shell` en `src/index.css`.

Usar flex para layouts **dentro** de una celda; grid para el armazón general.

## 10. CSS variables en vez de clases utilitarias puras

El sistema de diseño descansa en `--c-*`, `--radius`, etc. Los componentes aplican Tailwind donde conviene (tamaños, espaciado, flex), pero usan `var(--c-accent)` para colores que tienen semántica (positivo/negativo/accent).

Ventaja: cambiar el tema a dark mode o a variantes de cliente se hace redefiniendo variables en `:root`, no tocando clases por toda la base de código. Desventaja: menos autocompletado / DX de Tailwind puro. Se acepta el trade-off.

## 11. Lazy loading de rutas

Regla: toda página bajo `/dashboard/*` se importa con `React.lazy` + `Suspense`. Ver [routing.md](./routing.md#lazy-loading). Esto mantiene pequeño el bundle inicial (importante porque la landing autenticada tiene mucha UI).

## 12. Snake_case del backend, camelCase en TS cuando conviene

Los tipos de response conservan `snake_case` (`access_token`, `portfolio_id`, `return_1m`). No hay una capa de mapeo sistemática. Solo se renombra cuando un campo se consume en muchos lugares y el `snake_case` estorba en la UI.

Si esto cambia (cliente prefiere camelCase en todo el código), crear adaptadores en cada servicio y convertir allí, **no** en los componentes.

## 13. Nada de prop drilling profundo — usar el store

Si dos componentes hermanos o lejanos comparten estado, preferir un Zustand store (ámbito feature) antes que pasar props a través de 3+ niveles. Ejemplo: `PrimaryFilters`, `ActiveFilters`, `ResultsTable` se comunican vía `useScreenerStore`, no vía props.

## 14. Barrels (`index.ts`) obligatorios

Cada feature y cada carpeta de componentes reutilizables exporta su API por un `index.ts`. Esto permite refactorizar la estructura interna sin romper consumidores. No poner `export * from './…'` ciego — listar explícitamente qué se exporta.

## 15. UI en inglés

Toda la copy user-facing está en inglés (login, errores, formularios, placeholders, dashboard). El proyecto se tradujo del español al inglés en una pasada — incluida la validación Zod (`'Email is required'`, `'Enter a valid email'`, etc.) y los mensajes de `lib/apiErrors.ts`. Los `console.log` y el código (variables, comentarios) ya estaban en inglés. Si más adelante se necesita i18n runtime, hay que externalizar los strings — hoy están hardcoded.

## 16. Antipatrones identificados (evitar)

- **Guardar datos sensibles en Zustand `persist`.** Usar storage manual si lo que persiste depende de lógica adicional (ejemplo: token con "remember me"). Ver [authentication.md](./authentication.md#almacenamiento-del-token).
- **Confiar en `isAuthenticated` persistido sin verificar token.** Llevó al bug que arregla `bb588f7`. Solución: `checkAuth()` siempre valida contra el servidor al arrancar.
- **Fetch sin cancellation en componentes que se desmontan rápido.** Produce warnings de "state update on unmounted" y race conditions. Usar AbortController siempre.
- **Mezclar estilos inline con tokens CSS.** Si usas `style={{ color: '#1e3a5f' }}` en vez de `var(--color-primary)`, pierdes la posibilidad de temas futuros.
