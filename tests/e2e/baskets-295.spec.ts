import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * E2E issue #295 — página «Baskets»: lista (sistema + propios), crear desde
 * tickers, detalle con pesos/rating/«member since», duplicar, quitar miembros
 * y borrar. API mockeada por `page.route` contra el contrato real de #291
 * (`app/schemas/basket.py` / `app/routers/baskets.py` del backend).
 *
 * El matcher exige que el *pathname* EMPIECE por `/baskets` (o `/api/v1/baskets`,
 * según `VITE_API_URL`) — NO un glob `**\/baskets/**`, que también
 * interceptaría la navegación de la SPA (`/dashboard/baskets/…`) y los módulos
 * de Vite (`/src/features/baskets/…`).
 */

const USER = {
  user_id: '22222222-2222-2222-2222-222222222222',
  email: 'e2e@test.local',
  username: 'e2euser',
  first_name: 'E2E',
  last_name: 'User',
  subscription_tier: 'free',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const SP500_ID = '5b500000-0000-4000-8000-000000000500';
const MY_ID = 'a1a1a1a1-0000-4000-8000-0000000000a1';
const NEW_ID = 'b2b2b2b2-0000-4000-8000-0000000000b2';
const DUP_ID = 'c3c3c3c3-0000-4000-8000-0000000000c3';

const SID = {
  NVDA: '00000000-0000-4000-8000-00000000000a',
  AAPL: '00000000-0000-4000-8000-00000000000b',
  MSFT: '00000000-0000-4000-8000-00000000000c',
  AMD: '00000000-0000-4000-8000-00000000000d',
};

const SP500_ITEM = {
  basket_id: SP500_ID,
  slug: 'sp500',
  kind: 'index',
  name: 'S&P 500',
  description: 'S&P 500 constituents (FMP)',
  is_system: true,
  member_count: 503,
  weights_as_of: '2026-10-22',
  updated_at: '2026-10-22T06:00:00Z',
};

const MY_ITEM = {
  basket_id: MY_ID,
  slug: null,
  kind: 'user',
  name: 'Mis AI',
  description: 'AI hardware',
  is_system: false,
  member_count: 2,
  weights_as_of: null,
  updated_at: '2026-10-20T12:00:00Z',
};

const SP500_CHANGES = [
  { ticker: 'WBD', name: 'Warner Bros. Discovery', date: '2026-10-06', kind: 'left', reason: 'Acquired' },
  { ticker: 'TWLO', name: 'Twilio Inc.', date: '2026-10-06', kind: 'entered', reason: 'Market cap' },
  { ticker: 'XYZ1', name: 'Old Co 1', date: '2026-09-22', kind: 'left', reason: null },
  { ticker: 'NEW1', name: 'New Co 1', date: '2026-09-22', kind: 'entered', reason: null },
  { ticker: 'XYZ2', name: 'Old Co 2', date: '2026-08-01', kind: 'left', reason: null },
  { ticker: 'OLDEST', name: 'Sixth change', date: '2026-07-01', kind: 'entered', reason: null },
];

function member(
  ticker: keyof typeof SID,
  over: Partial<{ name: string; sector: string | null; weight: number | null; rating: number | null; price: number | null; valid_from: string; weight_as_of: string | null }>,
) {
  return {
    symbol_id: SID[ticker],
    ticker,
    name: `${ticker} Inc.`,
    sector: 'Technology',
    valid_from: '2015-01-02',
    weight: null,
    weight_as_of: null,
    rating: null,
    price: null,
    ...over,
  };
}

const SP500_DETAIL = {
  ...SP500_ITEM,
  members: [
    member('AAPL', { name: 'Apple Inc.', weight: 7.695329, weight_as_of: '2026-10-22', rating: -1, price: 262.24 }),
    member('MSFT', { name: 'Microsoft Corporation', sector: 'Software', weight: 5.858633, rating: 1, price: 517.03 }),
    member('NVDA', { name: 'NVIDIA Corporation', weight: 7.776316, rating: 3, price: 181.16, valid_from: '2001-11-30' }),
  ],
  recent_changes: SP500_CHANGES,
  unresolved_count: 0,
};

const MY_DETAIL = {
  ...MY_ITEM,
  members: [
    member('NVDA', { name: 'NVIDIA Corporation', rating: 3, price: 181.16, valid_from: '2026-10-20' }),
    member('AMD', { name: 'Advanced Micro Devices', rating: 2, price: 234.56, valid_from: '2026-10-20' }),
  ],
  recent_changes: [],
  unresolved_count: null,
};

const NEW_DETAIL = {
  ...MY_ITEM,
  basket_id: NEW_ID,
  name: 'E2E New',
  description: null,
  member_count: 3,
  members: [member('NVDA', {}), member('AMD', {}), member('AAPL', {})],
  recent_changes: [],
  unresolved_count: null,
};

const DUP_DETAIL = {
  ...SP500_DETAIL,
  basket_id: DUP_ID,
  slug: null,
  kind: 'user',
  is_system: false,
  name: 'S&P 500 copy',
  weights_as_of: null,
  recent_changes: [],
  unresolved_count: null,
};

async function seedAuth(page: Page): Promise<void> {
  await page.addInitScript(
    ([user, token]) => {
      localStorage.setItem('access_token', token as string);
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({ state: { user, isAuthenticated: true }, version: 0 }),
      );
    },
    [USER, 'fake-e2e-token'],
  );
  await page.route('**/auth/me', (route) => route.fulfill({ json: USER }));
}

const API_PATH = /^(\/api\/v1)?\/baskets(\/|$)/;

type Handler = (route: Route, method: string, path: string) => Promise<boolean> | boolean;

/** Default baskets API; `extra` runs first and returns true when it handled the request. */
async function mockBaskets(page: Page, extra?: Handler): Promise<void> {
  await page.route((url) => API_PATH.test(url.pathname), async (route) => {
    const req = route.request();
    const method = req.method();
    const path = new URL(req.url()).pathname.replace(/^\/api\/v1/, '').replace(/\/$/, '');
    if (method === 'OPTIONS') {
      // Preflight CORS (la API vive en otro origen y lleva Authorization).
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
          'access-control-allow-headers': '*',
        },
      });
    }
    if (extra && (await extra(route, method, path))) return;
    if (method === 'GET' && path === '/baskets') return route.fulfill({ json: [SP500_ITEM, MY_ITEM] });
    if (method === 'GET' && path === `/baskets/${SP500_ID}`) return route.fulfill({ json: SP500_DETAIL });
    if (method === 'GET' && path === `/baskets/${MY_ID}`) return route.fulfill({ json: MY_DETAIL });
    if (method === 'GET' && path === `/baskets/${NEW_ID}`) return route.fulfill({ json: NEW_DETAIL });
    if (method === 'GET' && path === `/baskets/${DUP_ID}`) return route.fulfill({ json: DUP_DETAIL });
    return route.fulfill({ status: 404, json: { detail: 'Basket not found' } });
  });
}

async function rowTickers(page: Page): Promise<string[]> {
  return page.getByTestId('basket-member-row').locator('td:first-child').allInnerTexts();
}

test.describe('Baskets (#295)', () => {
  test('oráculo 1 — lista: tarjeta del sistema con conteo, fecha de pesos y últimos 5 cambios; propio en My baskets', async ({ page }) => {
    await seedAuth(page);
    await mockBaskets(page);
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Baskets' }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/baskets$/);

    const sys = page.getByTestId('system-basket-card');
    await expect(sys).toHaveCount(1);
    await expect(sys).toContainText('S&P 500');
    await expect(sys).toContainText('503');
    await expect(sys).toContainText('2026-10-22');
    await expect(sys).toContainText('▼ WBD');
    await expect(sys).toContainText('▲ TWLO');
    // sólo los últimos 5 cambios en la tarjeta
    await expect(sys.getByTestId('recent-change')).toHaveCount(5);
    await expect(sys).not.toContainText('OLDEST');

    const mine = page.getByTestId('my-baskets');
    await expect(mine.getByRole('heading', { name: 'My baskets' })).toBeVisible();
    await expect(mine.getByTestId('user-basket-card')).toHaveCount(1);
    await expect(mine).toContainText('Mis AI');
    await expect(page.getByRole('button', { name: 'New basket' })).toBeVisible();
  });

  test('lista vacía y error', async ({ page }) => {
    await seedAuth(page);
    let fail = false;
    await mockBaskets(page, (route, method, path) => {
      if (method === 'GET' && path === '/baskets') {
        if (fail) void route.fulfill({ status: 500, json: { detail: 'boom' } });
        else void route.fulfill({ json: [] });
        return true;
      }
      return false;
    });
    await page.goto('/dashboard/baskets');
    await expect(page.getByText('No baskets yet')).toBeVisible();
    fail = true;
    await page.reload();
    await expect(page.getByTestId('baskets-error')).toBeVisible();
  });

  test('oráculo 2 — crear: tickers tal cual, resumen resolved/skipped y navegación; 409 inline', async ({ page }) => {
    await seedAuth(page);
    const bodies: Array<Record<string, unknown>> = [];
    let conflict = false;
    await mockBaskets(page, async (route, method, path) => {
      if (method === 'POST' && path === '/baskets') {
        bodies.push(route.request().postDataJSON());
        if (conflict) {
          await route.fulfill({ status: 409, json: { detail: 'Ya tenés un basket con ese nombre' } });
        } else {
          await route.fulfill({
            status: 201,
            json: { basket: NEW_DETAIL, resolved: 3, skipped: [{ ticker: 'XXXX', reason: 'not_found' }] },
          });
        }
        return true;
      }
      return false;
    });
    await page.goto('/dashboard/baskets');
    await page.getByRole('button', { name: 'New basket' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('E2E New');
    await dialog.getByLabel('Tickers').fill('nvda, AMD\nbrk.b XXXX');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(dialog.getByTestId('create-result')).toHaveText('3 added · 1 skipped (XXXX: not found)');
    expect(bodies[0]).toMatchObject({ name: 'E2E New', tickers: ['nvda', 'AMD', 'brk.b', 'XXXX'] });

    await dialog.getByRole('button', { name: 'Open basket' }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/baskets/${NEW_ID}$`));
    await expect(page.getByRole('heading', { name: 'E2E New' })).toBeVisible();

    // 409 → error inline, el modal queda abierto
    conflict = true;
    await page.goto('/dashboard/baskets');
    await page.getByRole('button', { name: 'New basket' }).click();
    await dialog.getByLabel('Name').fill('Mis AI');
    await dialog.getByLabel('Tickers').fill('NVDA');
    await dialog.getByRole('button', { name: 'Create' }).click();
    await expect(dialog.getByTestId('create-error')).toHaveText('You already have a basket with that name');
    await expect(dialog.getByTestId('create-result')).toHaveCount(0);
  });

  test('oráculo 3 — detalle del sistema: pesos, rating, member since, orden, filtro, edición bloqueada, duplicar', async ({ page }) => {
    await seedAuth(page);
    const dupBodies: Array<Record<string, unknown>> = [];
    await mockBaskets(page, async (route, method, path) => {
      if (method === 'POST' && path === `/baskets/${SP500_ID}/duplicate`) {
        dupBodies.push(route.request().postDataJSON());
        await route.fulfill({ status: 201, json: DUP_DETAIL });
        return true;
      }
      return false;
    });
    await page.goto(`/dashboard/baskets/${SP500_ID}`);
    await expect(page.getByRole('heading', { name: 'S&P 500' })).toBeVisible();

    const table = page.getByTestId('basket-members-table');
    for (const h of ['Ticker', 'Name', 'Sector', 'Weight %', 'Rating', 'Member since', 'Price']) {
      await expect(table.getByRole('columnheader', { name: h })).toBeVisible();
    }
    // orden por defecto: peso descendente
    expect(await rowTickers(page)).toEqual(['NVDA', 'AAPL', 'MSFT']);
    const nvda = page.getByTestId('basket-member-row').filter({ hasText: 'NVDA' });
    await expect(nvda).toContainText('7.78 %');
    await expect(nvda).toContainText('+3');
    await expect(nvda).toContainText('2001-11-30');
    await expect(nvda).toContainText('$181.16');

    // ordenar por Weight invierte el orden
    await table.getByRole('columnheader', { name: 'Weight %' }).getByRole('button').click();
    expect(await rowTickers(page)).toEqual(['MSFT', 'AAPL', 'NVDA']);

    // filtro por sector reduce filas
    await page.getByLabel('Sector').selectOption('Software');
    expect(await rowTickers(page)).toEqual(['MSFT']);
    await page.getByLabel('Sector').selectOption('');
    // búsqueda en memoria
    await page.getByPlaceholder('Search ticker or name').fill('apple');
    expect(await rowTickers(page)).toEqual(['AAPL']);
    await page.getByPlaceholder('Search ticker or name').fill('');

    // sistema: edición deshabilitada con tooltip, sin Remove por fila
    for (const name of ['Rename', 'Add tickers', 'Delete']) {
      const btn = page.getByRole('button', { name, exact: true });
      await expect(btn).toBeDisabled();
      await expect(btn).toHaveAttribute('title', 'Duplicate it to edit');
    }
    await expect(page.getByRole('button', { name: /^Remove/ })).toHaveCount(0);

    // historial completo plegable
    await page.getByText('Recent changes (6)').click();
    await expect(page.getByTestId('changes-full')).toContainText('OLDEST');

    // duplicar → POST …/duplicate y navegación al nuevo id
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Name')).toHaveValue('S&P 500 copy');
    await dialog.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/baskets/${DUP_ID}$`));
    expect(dupBodies[0]).toEqual({ name: 'S&P 500 copy' });
    await expect(page.getByRole('heading', { name: 'S&P 500 copy' })).toBeVisible();
  });

  test('oráculo 4a — propio: Remove optimista; 500 → la fila vuelve y toast de error', async ({ page }) => {
    await seedAuth(page);
    const deletes: string[] = [];
    let failNext = false;
    await mockBaskets(page, async (route, method, path) => {
      if (method === 'DELETE' && path.startsWith(`/baskets/${MY_ID}/members/`)) {
        deletes.push(path);
        if (failNext) await route.fulfill({ status: 500, json: { detail: 'boom' } });
        else await route.fulfill({ status: 204, body: '' });
        return true;
      }
      return false;
    });
    await page.goto(`/dashboard/baskets/${MY_ID}`);
    await expect(page.getByRole('heading', { name: 'Mis AI' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rename', exact: true })).toBeEnabled();
    expect((await rowTickers(page)).sort()).toEqual(['AMD', 'NVDA']);

    await page.getByRole('button', { name: 'Remove NVDA' }).click();
    await expect(page.getByTestId('basket-member-row').filter({ hasText: 'NVDA' })).toHaveCount(0);
    expect(deletes).toEqual([`/baskets/${MY_ID}/members/${SID.NVDA}`]);

    failNext = true;
    await page.getByRole('button', { name: 'Remove AMD' }).click();
    await expect(page.getByTestId('toast')).toContainText('AMD');
    await expect(page.getByTestId('basket-member-row').filter({ hasText: 'AMD' })).toHaveCount(1);
    expect(deletes).toHaveLength(2);
  });

  test('oráculo 4b — propio: Delete con 409 → modal con el nombre de la estrategia', async ({ page }) => {
    await seedAuth(page);
    let deleteCalls = 0;
    await mockBaskets(page, async (route, method, path) => {
      if (method === 'DELETE' && path === `/baskets/${MY_ID}`) {
        deleteCalls += 1;
        await route.fulfill({
          status: 409,
          json: { detail: { code: 'basket_in_use', strategies: ['AI Momentum'] } },
        });
        return true;
      }
      return false;
    });
    await page.goto(`/dashboard/baskets/${MY_ID}`);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Mis AI');
    await dialog.getByRole('button', { name: 'Delete basket' }).click();
    await expect(page.getByTestId('basket-in-use')).toContainText(
      'Used by strategy AI Momentum — deactivate its tracker first',
    );
    expect(deleteCalls).toBe(1);
    await expect(page).toHaveURL(new RegExp(`/dashboard/baskets/${MY_ID}$`));
  });
});
