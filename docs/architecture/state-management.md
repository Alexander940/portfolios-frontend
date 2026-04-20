# State Management

El proyecto usa **Zustand 5** como única librería de estado global. No hay Redux, no hay React Context; el estado que no cruza componentes vive como `useState` local.

## Stores existentes

| Store | Archivo | Scope | Persist |
|-------|---------|-------|---------|
| `useAuthStore` | `src/features/auth/stores/authStore.ts` | Usuario, token, flags de sesión | Sí — user + isAuthenticated a `localStorage` |
| `useModalStore` | `src/features/auth/stores/modalStore.ts` | Modal activo y mensajes post-registro | No |
| `useScreenerStore` | `src/features/screener/stores/screenerStore.ts` | Filtros, orden, paginación, preset de columnas del screener | Parcial — `columnPreset` a `localStorage` |

## `useAuthStore`

Profundizado en [authentication.md](./authentication.md). Notas específicas de state management:

- Usa el middleware `persist(config, { name, storage, partialize })`.
- `partialize` guarda **solo** `user` e `isAuthenticated`. El `accessToken` se persiste aparte en `localStorage`/`sessionStorage` dependiendo de "remember me".
- Al cargarse el módulo ejecuta `configureAxiosAuth(...)` — inyecta en `lib/axios.ts` las funciones para leer el token y reaccionar a 401. Esto rompe el acoplamiento circular que tendría si `axios.ts` importara el store.

## `useModalStore`

Estructura minimal:

```ts
{
  activeModal: string | null;      // ID del modal abierto (ej. "register")
  successMessage: string | null;   // Mensaje post-registro para LoginPage

  openModal(modalId): void;
  closeModal(): void;
  setSuccessMessage(msg): void;
  clearSuccessMessage(): void;
}
```

Vive dentro de `features/auth` porque hoy solo lo usan `LoginPage`, `LoginForm` y `RegisterModal`. Si aparecen modales de otros dominios, considerar moverlo a `src/stores/` o dar a cada feature su propio modal store.

## `useScreenerStore`

Es el más rico de los tres. Coordina toda la UI del screener y es la única fuente de verdad para lo que se envía al backend.

### Estado

```ts
{
  // Filtros primarios (dropdowns en la barra superior)
  exchanges: string[];
  sectors: string[];
  ratings: RatingLetter[];

  // Filtros adicionales (definidos en filterDefinitions.ts)
  // Pueden ser de tipo range | boolean | multiselect
  additionalFilters: Record<string, FilterValue>;

  // Ordenamiento
  sortBy: keyof Stock | null;
  sortOrder: 'asc' | 'desc';

  // Paginación
  page: number;
  pageSize: number;

  // UI del modal de filtro individual
  activeFilterKey: string | null;

  // Preset de columnas (persistido)
  columnPreset: 'overview' | 'trend' | 'performance' | 'fundamentals' | 'all';
}
```

### Acciones — patrones importantes

1. **Cambio de filtro resetea a página 1.**  
   Todos los `setExchanges / setSectors / setRatings / setAdditionalFilter / removeAdditionalFilter / clearAllFilters` llaman `set({ ..., page: 1 })`. Sin esto, cambiar un filtro mientras estás en la página 4 daría una vista vacía.

2. **Ordenamiento con toggle tri-estado.**  
   `toggleSort(column)`: si es columna nueva → `asc`. Si ya era `asc` → `desc`. Si ya era `desc` → `null` (remueve el orden).

3. **`getApiRequest()` es una proyección.**  
   Genera el `ScreenerRequest` a enviar al backend combinando los filtros primarios, los adicionales serializados y la paginación. Esto deja el store libre de conocer detalles del protocolo y concentra el mapping en un solo lugar.

4. **`hydrateFromUrl(params)`** es su inversa.  
   Parsea `URLSearchParams` y restaura el estado. Lo consume `useScreenerUrlSync()` al montar el screener con una URL con query string.

5. **Solo el preset de columnas se persiste.**  
   Los filtros no se guardan en `localStorage` a propósito — viven en la URL, que ya es persistente y compartible. Ver [patterns-and-conventions.md](./patterns-and-conventions.md#url-state-sync).

### Integración con hooks

- `useScreenerData()` se suscribe al store, llama `getApiRequest()`, y hace fetch con debounce + AbortController.
- `useScreenerUrlSync()` hace bidireccional: al montar, si la URL trae query string, hidrata el store; **si la URL no trae params, llama `clearAllFilters()`** para resetear cualquier estado en memoria que sobreviviera a una visita anterior (el store es un singleton de módulo, no se desmonta al cambiar de ruta). En cada cambio posterior del store actualiza el query string con `navigate(..., { replace: true })`.
- `useScreenerOptions()` no depende del store: solo carga los valores posibles de exchanges/sectors para los dropdowns.

## Por qué Zustand y no otra cosa

| Alternativa | Por qué no se eligió |
|-------------|---------------------|
| Redux Toolkit | Boilerplate innecesario para 3 stores. |
| React Context | Re-renders excesivos en consumidores; no trae selector/persist. |
| Jotai/Recoil | Modelo atómico no encaja bien con el estado coherente del screener (filtros + orden + página deben cambiar juntos). |
| React Query | Cubre server state pero no local UI state; podría integrarse a futuro para caché del screener, hoy `useScreenerData` hace fetch manual. |

## Convenciones al agregar un nuevo store

1. Colocarlo en `src/features/<feature>/stores/` si es de un dominio, o en `src/stores/` si es transversal.
2. Exportarlo desde el barrel de la feature como `useXxxStore`.
3. Declarar el tipo `XxxState & XxxActions` explícitamente y tipar el creador: `create<XxxStore>()((set, get) => ({ ... }))`.
4. Si necesita persistencia, usar `persist` + `partialize` — **no guardar datos sensibles** (tokens) ahí; usar storage manual.
5. Evitar llamadas de red directamente desde las acciones del store si la misma feature ya tiene un service; las acciones del store deben orquestar, no hacer trabajo de red.
6. Si otro módulo necesita escuchar cambios del store, preferir `useXxxStore(state => state.field)` con selector antes que consumir todo el estado.
