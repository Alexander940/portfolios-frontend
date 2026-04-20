# Tech Stack & Tooling

## Runtime y librerías principales

Versiones tomadas de `package.json`.

| Paquete | Versión | Rol |
|---------|---------|-----|
| `react` / `react-dom` | 19.2.0 | Framework UI. React 19 habilita el nuevo JSX transform y optimizaciones del compilador. |
| `react-router-dom` | 7.13.0 | Routing declarativo con nested routes, lazy loading y preservación de `location.state`. |
| `zustand` | 5.0.10 | State management global. Se usa con middleware `persist` en `authStore` (ver [state-management.md](./state-management.md)). |
| `axios` | 1.13.4 | Cliente HTTP con interceptores para inyección de token y manejo de 401. |
| `react-hook-form` | 7.71.1 | Gestión de formularios con re-render mínimo. |
| `@hookform/resolvers` | 5.2.2 | Adapter para integrar Zod con react-hook-form. |
| `zod` | 4.3.6 | Validación de schemas y derivación de tipos. |
| `lucide-react` | 0.563.0 | Iconografía. |
| `recharts` | 3.8.1 | Presente en `dependencies` pero sin uso actual en `src/` — reservado para visualizaciones futuras. |

## Build y dev tooling

| Paquete | Versión | Rol |
|---------|---------|-----|
| `vite` | 7.2.4 | Bundler + dev server con HMR. |
| `@vitejs/plugin-react` | 5.1.1 | Fast Refresh para React. |
| `@tailwindcss/vite` | 4.1.18 | Plugin oficial de Tailwind v4 para Vite. |
| `tailwindcss` | 4.1.18 | Utility CSS. Sin `tailwind.config.js`; la configuración vive en `src/index.css`. |
| `typescript` | 5.9.3 | Strict mode, `verbatimModuleSyntax`, target ES2022. |
| `eslint` | 9.39.1 | Flat config (`eslint.config.js`). |
| `typescript-eslint` | 8.46.4 | Reglas TS sobre ESLint. |
| `eslint-plugin-react-hooks` / `eslint-plugin-react-refresh` | — | Chequeos específicos de hooks y HMR. |
| `@playwright/test` | 1.58.0 | E2E tests en `tests/e2e/`. |

## Configuración de Vite — `vite.config.ts`

```ts
// vite.config.ts:1-14
plugins: [react(), tailwindcss()]
resolve.alias: { '@': path.resolve(__dirname, './src') }
```

- Plugin de React para Fast Refresh.
- Plugin de Tailwind v4 (carga el CSS directamente; sin PostCSS manual).
- Alias `@/` → `src/` disponible tanto en imports de TS como de CSS.

## Configuración de TypeScript

El proyecto usa **project references** con tres archivos:

- `tsconfig.json` — root, solo referencia `app` y `node`.
- `tsconfig.app.json` — aplicado al código en `src/`:
  - `target: ES2022`, `jsx: react-jsx`, `moduleResolution: bundler`.
  - `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true`.
  - `verbatimModuleSyntax: true` — obliga a usar `import type` explícito para tipos.
  - `paths: { "@/*": ["./src/*"] }`.
- `tsconfig.node.json` — para `vite.config.ts` y otros scripts de build; target ES2023.

El script `npm run build` ejecuta `tsc -b && vite build`, por lo que un error de tipos rompe el build.

## Configuración de ESLint — `eslint.config.js`

- Flat config (formato ESLint 9+).
- Extiende: `@eslint/js` recommended, `typescript-eslint` recommended, `react-hooks` flat config, `react-refresh` vite config.
- Ignora `dist/`.
- No tiene reglas type-aware activadas; si se quiere endurecer, habilitar el preset `recommendedTypeChecked` de `typescript-eslint`.

## Tailwind CSS v4

Sin `tailwind.config.js`. La configuración vive en `src/index.css`:

- `@import "tailwindcss"` — único import necesario en v4.
- Las variables CSS (tokens de color, radius, shadow, z-index, fuentes) se declaran en `:root` y se consumen tanto desde clases utilitarias como desde CSS custom (ver [ui-design-system.md](./ui-design-system.md)).
- El espacio de color usado es **OKLCH** (`oklch(55% 0.18 265)`), más uniforme perceptualmente que HSL.

## Variables de entorno

Definidas en `.env.example`:

```
VITE_API_URL=https://api.portfolios.dynamicadvisors.co/api/v1
VITE_API_TIMEOUT=30000
```

Se leen con `import.meta.env.VITE_*` exclusivamente en `src/lib/axios.ts`. Todo lo que no tenga prefijo `VITE_` no es expuesto al bundle por Vite.

## Scripts npm

```bash
npm run dev          # Vite dev server con HMR
npm run build        # tsc -b && vite build
npm run lint         # eslint .
npm run preview      # Sirve el build de producción localmente
npm run test:e2e     # playwright test
npm run test:e2e:ui  # playwright test --ui (runner interactivo)
```

## Fuentes

Se cargan desde Google Fonts en `index.html` con `preconnect`:

- **Inter** — sans serif principal.
- **JetBrains Mono** — tablas, números tabulares (OKLCH `tabular-nums`).
