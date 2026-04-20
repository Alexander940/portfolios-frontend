# Architecture — Portfolios Frontend

Este directorio documenta la arquitectura de `portfolios-frontend`, una SPA React + TypeScript + Vite para la gestión y análisis de portafolios de inversión.

La documentación está dividida por aspectos para que cada archivo pueda leerse de forma independiente. Empieza por `overview.md` si es tu primera vez; el resto puede consultarse por tema.

## Índice

| # | Archivo | Contenido |
|---|---------|-----------|
| 1 | [overview.md](./overview.md) | Propósito del proyecto, diagrama conceptual y resumen de decisiones clave. |
| 2 | [tech-stack.md](./tech-stack.md) | Versiones y rol de cada dependencia, configuración de Vite, TypeScript, ESLint, Tailwind v4. |
| 3 | [project-structure.md](./project-structure.md) | Árbol de carpetas, convenciones de feature-sliced design, barrel exports y alias `@/`. |
| 4 | [routing.md](./routing.md) | Definición de rutas, guardas (`ProtectedRoute` / `PublicRoute`), lazy loading y layout anidado. |
| 5 | [authentication.md](./authentication.md) | Flujos de login / registro / logout, manejo de JWT con "remember me", recuperación de sesión y respuestas 401. |
| 6 | [state-management.md](./state-management.md) | Stores de Zustand (`authStore`, `modalStore`, `screenerStore`), persistencia y patrón de inyección a axios. |
| 7 | [api-layer.md](./api-layer.md) | Cliente axios, interceptores, transformación de errores y catálogo de servicios (auth, screener, portfolio, symbol). |
| 8 | [features.md](./features.md) | Módulos funcionales: auth, screener (filtros, URL sync, column presets) y portfolio (lista/detalle, save-as-portfolio). |
| 9 | [ui-design-system.md](./ui-design-system.md) | Tokens de diseño (OKLCH), layout del app-shell, componentes primitivos (`Button`, `Input`, `Modal`, etc.) y convenciones de estilo. |
| 10 | [types-and-contracts.md](./types-and-contracts.md) | Organización de tipos globales y de dominio; patrón de validación con Zod. |
| 11 | [build-and-deployment.md](./build-and-deployment.md) | Scripts npm, variables de entorno, despliegue en Vercel y pruebas E2E con Playwright. |
| 12 | [patterns-and-conventions.md](./patterns-and-conventions.md) | Patrones transversales: feature-sliced, URL state sync, request cancellation, focus trap, manejo de errores. |

## Cómo mantener esta documentación

- Cuando cambie la forma de autenticación, routing, estructura de features o el stack, actualiza el archivo correspondiente en el mismo PR que introduce el cambio.
- Si agregas una nueva feature importante (por ejemplo, alerts, markets, strategy builder), añade una sección en `features.md` o crea un archivo nuevo y regístralo en este índice.
- Las decisiones con trade-off explícito deberían ir como ADR en `docs/decisions/` y enlazarse desde aquí.
