# UI & Design System

El proyecto construye su propio sistema de componentes sobre Tailwind CSS v4 y variables CSS. **No** se usa ninguna librería de componentes (shadcn, Material, Radix, etc.). Los primitivos viven en `src/components/ui/` y los estilos compartidos en `src/index.css`.

El sistema visual ("**Prime**") se portó desde un handoff de **Claude Cloud Design** (bundle HTML/CSS/JS): los tokens, las clases del app-shell, las tablas y el login están reproducidos 1:1 contra `styles.css` del bundle original, traducidos a TypeScript/React donde aplica.

## Tokens de diseño

Todos los tokens son variables CSS declaradas en `:root` dentro de `src/index.css` y consumidas desde clases utilitarias o CSS propio. Usan el espacio de color **OKLCH** para tener una escala perceptualmente uniforme.

### Paleta

| Token | Valor | Uso |
|-------|-------|-----|
| `--c-bg-deep` | `oklch(98.5% 0.003 260)` | Fondo base más profundo. |
| `--c-bg` | `#ffffff` | Fondo de tarjetas. |
| `--c-bg-soft` | `oklch(97.5% 0.004 260)` | Hover, fondos secundarios. |
| `--c-bg-softer` | `oklch(96% 0.005 260)` | Filas alternas en tablas. |
| `--c-border` | `oklch(91.5% 0.006 260)` | Borde por defecto. |
| `--c-border-strong` | `oklch(86% 0.008 260)` | Borde enfatizado. |
| `--c-text` | `oklch(22% 0.015 260)` | Texto primario. |
| `--c-text-soft` | `oklch(42% 0.012 260)` | Texto secundario. |
| `--c-text-dim` | `oklch(58% 0.010 260)` | Texto terciario / metadata. |
| `--c-accent` | `oklch(55% 0.18 265)` | Azul de acento (CTA, focus ring). |
| `--c-accent-soft` | `color-mix(in oklch, var(--c-accent) 12%, transparent)` | Fondo claro de acciones activas. |
| `--c-pos` | `oklch(55% 0.14 150)` | Verde positivo (retornos, ganancias). |
| `--c-neg` | `oklch(58% 0.17 28)` | Rojo negativo (pérdidas). |
| `--c-warn` | `oklch(68% 0.15 75)` | Amber para advertencias. |

### Radios, sombras y capas

| Token | Valor |
|-------|-------|
| `--radius` | `8px` |
| `--radius-sm` | `6px` |
| `--shadow-sm`, `--shadow`, `--shadow-lg` | Sombras suaves para cards y modales. |
| `--z-header` | `40` |
| `--z-mobile-menu` | `45` |
| `--z-modal-backdrop` | `50` |
| `--z-modal` | `51` |

### Tipografía

- `--font-sans`: `Inter` (con fallbacks al system stack).
- `--font-mono`: `JetBrains Mono`. Usada en tablas (`tabular-nums`) y datos numéricos.
- Las fuentes se precargan desde Google Fonts en `index.html` con `preconnect`.

### Tokens legados

Quedan por compatibilidad, actualmente no se usan en las vistas nuevas:

- `--color-primary`: `#1e3a5f`, `--color-primary-light`: `#2d5a8a`, `--color-primary-dark`: `#152a45` (azul oscuro).
- `--color-accent`: `#c9a227` (dorado).

Si se hace refactor del theming, eliminarlos cuando se verifique que no hay consumidores.

## App shell

El layout del dashboard (`layouts/DashboardLayout.tsx` + clase `.app-shell` en `index.css`) es un CSS grid de dos áreas:

```
┌──────────────┬──────────────────────────────────────────┐
│              │           Topbar  (52px)                 │
│   Sidebar    ├──────────────────────────┬───────────────┤
│   (216px)    │                          │               │
│              │   Main content           │ RelevantEvents│
│              │                          │  Rail (380px) │
│              │                          │ solo /analysis│
└──────────────┴──────────────────────────┴───────────────┘
```

- Grid template: `grid-template-columns: 216px 1fr` y `grid-template-rows: 52px 1fr`, con áreas `"sidebar topbar" / "sidebar main"`.
- El main interior es otro grid: `1fr` por defecto, `1fr 380px` cuando se aplica `.app-main.has-rail`.
- `html, body { overflow: hidden }`. El scroll vive en `.app-main-content` (y, cuando aplica, en `.app-main-rail`) — nunca en el documento.
- Bajo `980px` el rail no aparece y el grid colapsa a una sola columna (responsive principalmente atendido por el login; el dashboard asume desktop).
- **No hay** `position: sticky` ni menú móvil hamburguesa: la sidebar y el topbar son celdas fijas del grid, y `MobileMenu.tsx` se eliminó en este refactor.

## Componentes primitivos — `src/components/ui/`

Todos expuestos via barrel `src/components/ui/index.ts`.

### `Button`

`src/components/ui/Button.tsx`

Props: `variant: 'primary' | 'secondary' | 'ghost' | 'danger'`, `size: 'sm' | 'md' | 'lg'`, `leftIcon?`, `rightIcon?`, `isLoading?`.

Comportamiento:

- `isLoading` reemplaza el contenido por un `Loader2` (lucide) con spin y deshabilita el botón.
- Focus ring siempre visible con el color `--c-accent`.
- El variant `danger` se usa para destructive actions (hoy principalmente logout).

### `Input`

`src/components/ui/Input.tsx`

Props extendidas de `<input>`, más: `label`, `error?`, `leftIcon?`, `rightIcon?`, `showPasswordToggle?`.

Características:

- Label flotante implementado con el selector `peer` de Tailwind.
- Si `type="password"` y `showPasswordToggle`, renderiza un icono `Eye/EyeOff` que conmuta la visibilidad.
- Estado de error: borde rojo, icono de alerta, mensaje debajo; ARIA: `aria-invalid`, `aria-describedby`.
- Focus ring azul con `--c-accent`.

### `Checkbox`

Minimal, con label y estilo coherente con `Input`. Usado en "Remember me" y filtros booleanos.

### `Modal`

`src/components/ui/Modal.tsx`

Props: `isOpen`, `onClose`, `title`, `children`, `size?`, `closeOnBackdropClick?`.

Implementación:

- Renderizado con `createPortal` a `document.body`.
- Backdrop + panel con animación de entrada.
- Trap de foco vía `useFocusTrap` (`src/hooks/useFocusTrap.ts`):
  - Guarda el elemento enfocado antes de abrir.
  - Enfoca el primer elemento focusable del modal.
  - Intercepta `Tab` y `Shift+Tab` para no salir del modal.
  - Al cerrar, restaura el foco previo.
- `Escape` cierra el modal.
- Bloquea scroll del body mientras está abierto.
- ARIA: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` apuntando al título.

### `MultiSelect`

Dropdown de selección múltiple con chips. Lo usan los filtros del screener (sectores, exchanges). Restilizado en el refactor del Prime: el label es 11px uppercase + tracked + `--c-text-dim` (mismo recipe que `.stat-label` y `.nav-label`); el botón trigger usa `--c-border` / `--c-bg`; las opciones del dropdown y el search interno usan tokens del tema. La API del componente (props + comportamiento) no cambió.

## Componentes compartidos fuera de `ui/`

- **`components/navigation/`** — `Sidebar`, `Topbar`, `SearchBar`. La configuración de items del sidebar vive en `src/config/navigation.ts` como `NAV_SECTIONS` (agrupadas en "Workspace" y "Research"). El antiguo `Header.tsx` + `MobileMenu.tsx` + `NavLink.tsx` se eliminaron al migrar al app-shell con sidebar persistente.
- **`components/symbol/SymbolModal.tsx`** — modal reutilizable de búsqueda de ticker + preview de precio. Lanzado desde la `SearchBar` del topbar.

## Tablas

Estilos centralizados en `src/index.css` bajo clases `.table-*`:

- Headers pequeños (font-size 11px, uppercase).
- Celdas con `font-mono` y `tabular-nums` para alineación vertical de dígitos.
- Soporte de columnas sortables (cursor pointer + indicador de dirección).
- Filas hover + click → navegación (usado en portfolios list y screener results).
- Sticky headers cuando la tabla tiene scroll interno.
- Columnas pinned a la izquierda (`Ticker`, `Name` en el screener).

## Stat cards / KPI

Clase `.stat-card` en `index.css`: grid uniforme, número grande en la parte superior, delta con color `--c-pos` / `--c-neg`. Se usa en `OverviewPage` y `PortfolioStatCards`.

## Formularios

Convención común para todos los forms:

- `react-hook-form` + Zod resolver.
- Errores globales del server → banner arriba del form (rojo con icono).
- Errores por campo → debajo del input, en rojo.
- Estado `isSubmitting` deshabilita todo el form y muestra `isLoading` en el botón.

## Login

El login es una pantalla de dos paneles aparte del app-shell del dashboard:

- `src/pages/LoginPage.tsx` — wrap con clase `.login-app` (grid `1.05fr 1fr`, colapsa a una columna bajo 980px).
- `src/pages/LoginArt.tsx` — panel decorativo izquierdo: gradient mesh oscuro + grid sutil + dos glass cards flotantes (animadas con `meshFloat`, `floatA`, `floatB`). Es 100% presentacional; no toca datos reales.
- `src/features/auth/components/LoginForm.tsx` — formulario derecho con tokens del Prime: brand mark "P", fields con label compacta (`.login-field-head label` 12px / 500), input grande (`.login-input` 14px, padding 11×14), eye toggle en password, "Forgot?" inline al lado del label, checkbox "Keep me signed in", CTA dark full-width (`.login-cta`), footer con link al `RegisterModal`.

Toda la lógica (validación Zod, `useAuth()`, `RegisterModal`) se mantuvo intacta en este refactor — solo cambió la presentación.

## Responsive

- Mobile-first con utilidades Tailwind (`sm:`, `md:`, `lg:`) en componentes legacy; el shell del dashboard asume desktop.
- `LoginPage` colapsa a una sola columna bajo `980px` (esconde el panel decorativo).
- Modales limitan su ancho con `max-w-*` y agregan padding interior responsive.
- **No hay menú móvil hamburguesa**: el `MobileMenu` se eliminó al adoptar la sidebar persistente. Si más adelante se atiende mobile en el dashboard, habrá que volver a introducir un patrón equivalente.

## Convenciones al crear componentes nuevos

1. Si es agnóstico de dominio, ponerlo en `src/components/ui/` y exportarlo desde el barrel.
2. Si es un compuesto específico del dashboard, ponerlo en `src/components/<area>/`.
3. Si sólo lo usa una feature, vivir en `features/<feature>/components/`.
4. Usar las variables CSS (`--c-*`) en vez de hardcodear colores hex — garantiza consistencia y permite theming futuro.
5. Todo componente interactivo debe tener `:focus-visible` con el accent ring (no eliminar outline).
6. Accesibilidad mínima: roles ARIA en compuestos (`dialog`, `listbox`, `tablist`), asociar labels a inputs, soporte teclado (`Escape` cierra modales, `Enter/Space` activa botones, flechas en listas).
