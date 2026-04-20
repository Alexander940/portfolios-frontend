# Build & Deployment

## Scripts

Definidos en `package.json`:

```bash
npm run dev          # Vite dev server (HMR, por defecto :5173)
npm run build        # tsc -b  &&  vite build  → dist/
npm run lint         # eslint .
npm run preview      # Sirve dist/ localmente para probar el build
npm run test:e2e     # playwright test (headless)
npm run test:e2e:ui  # playwright test --ui (runner interactivo)
```

`npm run build` ejecuta primero `tsc -b` sobre las project references. **Un error de tipos rompe el build.** No hay opción de "build tipo suelto" a propósito.

## Variables de entorno

`.env.example`:

```
VITE_API_URL=https://api.portfolios.dynamicadvisors.co/api/v1
VITE_API_TIMEOUT=30000
```

Reglas:

- Solo las variables con prefijo `VITE_` se exponen al bundle. Cualquier otra queda en el server (irrelevante aquí, es SPA).
- Se leen con `import.meta.env.VITE_*`. El único consumidor hoy es `src/lib/axios.ts`.
- Los archivos `.env`, `.env.local`, `.env.production`, `.env.development` son ignorados por git (excepto `.env.example`).
- En Vercel, las env vars se configuran en el dashboard del proyecto.

## Output del build

- Carpeta de salida: `dist/` (gitignored).
- Vite hace code splitting automático — cada `React.lazy(...)` genera su propio chunk.
- Los assets (fuentes vía Google Fonts) no son empaquetados; se sirven desde CDN vía `preconnect` en `index.html`.
- No hay service worker ni PWA manifest.

## Despliegue en Vercel

Configuración en `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

Esto convierte cualquier URL en una entrega de `/index.html`, que es lo que React Router necesita para manejar deep links en una SPA. Sin esta regla, recargar `/dashboard/analysis/abc-123` devolvería 404.

Vercel detecta automáticamente el proyecto Vite (framework preset) y ejecuta `npm run build`, sirviendo `dist/`. No hay API routes ni funciones serverless.

## Pruebas E2E con Playwright

Configuración en `playwright.config.ts`:

- Carpeta de tests: `tests/e2e/`.
- Solo Chromium (no se corre contra Firefox/WebKit).
- `baseURL: http://localhost:5173`.
- `webServer` levanta `npm run dev` automáticamente antes de correr los tests (si no está ya corriendo).
- En CI: `retries: 2`, `workers: 1`. Local: sin retries, paralelo.
- Reportes HTML.

**Estado actual**: la infraestructura está lista pero no hay `.spec.ts` en `tests/e2e/` al momento de escribir este doc. Cuando se agreguen tests, priorizar:

1. Smoke: login válido → landing en `/dashboard` → logout.
2. Registro: form válido → redirect a `/login` con success message.
3. Screener: aplicar un filtro → verificar URL → verificar resultados.
4. Portfolio: abrir lista → click en fila → ver posiciones.

## CI/CD

No hay workflow de GitHub Actions ni otro sistema de CI en el repo. Vercel actúa como CI de despliegue pero no corre lint ni E2E antes de publicar. Si se quiere un gate, añadir un workflow en `.github/workflows/ci.yml` con:

1. `npm ci`
2. `npm run lint`
3. `npm run build`
4. `npx playwright install --with-deps && npm run test:e2e`

Y activar "Ignore Build Step" en Vercel atado al status check.

## Resumen de ambientes

| Ambiente | Base URL | Uso |
|----------|---------|-----|
| Local dev | `http://localhost:5173` + backend local o remoto vía `.env.local` | Desarrollo día a día. |
| Preview (Vercel) | `*.vercel.app` generado por cada PR | QA manual antes de merge. |
| Producción (Vercel) | Dominio configurado en Vercel (probablemente `app.portfolios.dynamicadvisors.co`) | Usuarios finales. |
