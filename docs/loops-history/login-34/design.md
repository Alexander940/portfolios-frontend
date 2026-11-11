# Inner Loop login-34: Rediseño de la página de login (copy honesto, estado «cuenta pendiente» y accesibilidad)

> **Status:** APPROVED 2026-11-10 — orden explícita del dueño en el chat («Crea un issue para cambiar la página de login. Diseña un loop para ese issue. Implementa el loop. Lanza un PR a main.»), con el diseño visual ya revisado y corregido por él en Claude Design (tres rondas de cambios: quitar Trend Rating/Runway del copy, quitar el subtítulo, página en inglés).

**Resuelve:** [#34](https://github.com/Alexander940/portfolios-frontend/issues/34) · Que el login diga la verdad (sin certificaciones inventadas, sin enlaces muertos, sin prometer «ya puedes entrar» a una cuenta que un administrador aún debe activar) y sea usable con teclado.

**Diseño de referencia:** https://claude.ai/artifact/L7HiaRGHb8wFELhdvdGHio (artboards *Login — desktop*, *Login — mobile*, *States and components*).

**Classification:** inner loop **de código (frontend)**, one-shot, en `../portfolios-frontend`. Sin dependencias de backend: el 401 «Account is not activated. Please contact an administrator.» ya existe (`app/routers/auth.py`).

**Trigger:** la orden del dueño de arriba.

**Executor:** el agente en el chat, en el worktree hermano `../portfolios-frontend-login-34` (rama `feat/login-34`, base `origin/master` 41e88f9). `node_modules` enlazado al checkout principal (sin `npm ci`).

## Alcance

| Qué | Dónde |
| --- | --- |
| Panel izquierdo honesto: eyebrow, titular, tres funciones reales, pie con «End-of-day market data · updated nightly». Sin mesh, tarjetas, SOC 2/ISO/MiFID ni «Markets open» | `src/pages/LoginArt.tsx` |
| Título «Sign in», subtítulo, alerta de registro reescrita, sin Privacy/Terms, pie «Private use · access by invitation» | `src/pages/LoginPage.tsx` |
| Labels «Email»/«Password», sin «Forgot?», toggle de contraseña tabulable con `aria-pressed`, alerta ámbar `role="status"` cuando el error es «cuenta no activada», `password` solo `min(1)`, nota de activación bajo «Create account» | `src/features/auth/components/LoginForm.tsx` |
| Mensaje de éxito del registro: «Account created. You'll be able to sign in once an administrator activates it. No need to register again.» | `src/features/auth/components/RegisterModal.tsx`, `src/features/auth/hooks/useAuth.ts` |
| Detección pura del 401 «not activated» → mensaje constante + `isAccountNotActivatedError(message)` | `src/lib/apiErrors.ts` |
| CSS: `.login-alert.pending`, lista de funciones del art pane, nota, contraste de grises pequeños (≥ 4,5:1), foco con el acento, toggle 36 px (44 px bajo 980 px), inputs 16 px en móvil; borrar CSS muerto (`.art-mesh`, `.art-card*`, `.art-event*`, `.art-status*`, `.art-footer`) | `src/index.css` (bloque LOGIN) |

## Objective (verifiable)

1. La página de login renderiza el copy del diseño en inglés, sin ningún `<button>`/`<a>` sin acción.
2. Un error cuyo mensaje sea el de «cuenta no activada» pinta la alerta ámbar (`role="status"`), no la roja (`role="alert"`).
3. El toggle de contraseña no tiene `tabIndex={-1}` y expone `aria-pressed`.
4. `RegisterModal` ya no afirma que se puede iniciar sesión.
5. Nada fuera del login cambia (`RegisterForm`, rutas, store de auth).

## Oracle (executable, standalone)

- `npm run build` verde (tsc + vite).
- `npx eslint` sobre los archivos tocados → 0 problemas (el `npm run lint` global tiene su propio baseline en archivos ajenos).
- Chequeo puro `npx vite-node tests/checks/login-34-not-activated.ts` (patrón `tests/checks/` del repo): `isAccountNotActivatedError` es verdadero para el mensaje mapeado del detail del backend, falso para «Incorrect email or password.» y para `null`; `transformAxiosError` de un 401 con ese detail devuelve el mensaje constante.
- `grep` negativo: `SOC 2`, `MiFID`, `Forgot`, `tabIndex={-1}`, `You can now sign in` no aparecen en `src/pages/Login*.tsx` ni en `src/features/auth/components/{LoginForm,RegisterModal}.tsx`.
- **Revisión visual del dueño** en el PR (escritorio ≥ 980 px y móvil).

## Exit criteria

Éxito = los cuatro oráculos automáticos verdes + PR abierto contra `master`. Fallo = 3 iteraciones del ciclo editar → build/eslint/check sin verde, o 60 min de reloj → detener, dejar la rama con el log y escalar al dueño con el diagnóstico.

## Memory

Esta carpeta — `design.md` + `run-2026-11-10.jsonl` (ítems: `art-pane`, `form`, `page`, `register-message`, `pending-detection`, `css`, `oracle`, `pr`). Write-ahead: línea `intent` antes de cada bloque de edición, `outcome` con el veredicto después.

## Human-in-the-loop

Revisión visual y merge del PR por el dueño; deploy a Vercel sigue el merge (fuera del loop).

## Irreversible actions

Ninguna. El PR no se mergea desde el loop.

## Kill switch

Interrumpir al agente; `git worktree remove ../portfolios-frontend-login-34 --force` y `git branch -D feat/login-34`.

## Fuera de alcance

Recuperación de contraseña, páginas legales, `RegisterForm`, notificación al usuario al activarse la cuenta, el spec e2e `tests/e2e/registration.spec.ts` (ya está rojo contra master: busca textos en español que la UI dejó de tener).

---

## Outcome — SUCCESS (2026-11-10, 1 iteración)

Implementado en la rama `feat/login-34` (base `origin/master` 41e88f9).

| Ítem | Veredicto | Dónde |
| --- | --- | --- |
| `pending-detection` | ok — 8/8 checks | `src/lib/apiErrors.ts`, `tests/checks/login-34-not-activated.ts` |
| `art-pane` | ok | `src/pages/LoginArt.tsx` |
| `form` | ok | `src/features/auth/components/LoginForm.tsx` |
| `page` | ok | `src/pages/LoginPage.tsx` |
| `register-message` | ok | `src/features/auth/components/RegisterModal.tsx`, `src/features/auth/hooks/useAuth.ts` |
| `css` | ok | `src/index.css` (bloque LOGIN) |

**Oráculos**: `npm run build` verde (16,4 s); `npx eslint` sobre los 7 archivos tocados → 0 problemas; `npx vite-node tests/checks/login-34-not-activated.ts` → `TODO VERDE` (8 ok); grep negativo (`SOC 2`, `MiFID`, `Forgot`, `tabIndex={-1}`, `You can now sign in`, `Privacy`, `Terms`) → 0 coincidencias en los cuatro archivos del login.

**Decisiones que conviene saber**

1. **El mensaje de «cuenta pendiente» se mapea una sola vez** en `apiErrors.ts` (`ERROR_MESSAGES.ACCOUNT_NOT_ACTIVATED`) y el formulario lo reconoce por igualdad con esa constante (`isAccountNotActivatedError`), no por regex sobre el texto del backend. Si el backend cambia el detail, se toca sólo `mapErrorDetail`.
2. **Sin correo de contacto en la alerta ámbar.** El diseño tenía «write to [contact email]» como placeholder; al no existir un correo real, la frase se omitió en vez de inventarlo.
3. **La marca vive en el panel izquierdo** a ≥ 981 px y en el panel del formulario bajo 980 px (`.login-brand` se oculta en ancho), para no mostrarla dos veces.
4. **Alertas con `role` distinto**: credenciales → `role="alert"`; pendiente y registro → `role="status"` (no interrumpen al lector de pantalla por algo que no es un error del usuario).
5. **El spec e2e `registration.spec.ts` no se tocó**: ya estaba rojo contra master (busca «Regístrate aquí» y «Crear cuenta» en español) y queda fuera de alcance.

**Pendiente**: revisión visual del dueño en el PR (escritorio y móvil) y merge; el deploy a Vercel sigue al merge.
