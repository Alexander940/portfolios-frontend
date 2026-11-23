import { test, expect, type Page } from '@playwright/test';

/**
 * E2E — compartir estrategias desde el builder (portfolios-backend#348).
 *
 * API route-mocked (nada real se comparte). Asserts:
 *  - dueño: alta de un viewer (POST …/shares con {email, permission}), cambio
 *    de rol (PATCH), quitar (DELETE); la lista del modal se actualiza sola;
 *  - 409 / 422: el `detail` del backend se ve dentro del modal y éste sigue abierto;
 *  - co_owner: el selector no ofrece co_owner y las filas co_owner no tienen controles;
 *  - «Shared with me»: dos elementos con su rol y el correo del dueño; con cero,
 *    la sección no existe en el DOM;
 *  - fila compartida como viewer: sin botón «Share»;
 *  - abrir una compartida carga el detalle con GET /strategies/{id}.
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

const OWN_ID = '33333333-3333-3333-3333-333333333333';
const SHARED_CO_ID = '44444444-4444-4444-4444-444444444444';
const SHARED_VIEW_ID = '55555555-5555-5555-5555-555555555555';

const SPEC = {
  general: { instrument_type: 'stocks', currency: 'USD', benchmark: 'SPY', performance_metric: 'total_return' },
  universe: { country: ['US'], rating: { min: 1 } },
  entry_exit: {
    mode: 'trade_state', min_er: 0.3, max_sm_atr_mult: 10, atr_spike_mult: 2,
    trail_atr_mult: 3, emergency_atr_mult: 4, exit_rating_long: -1, exit_rating_short: 1,
    use_trail_stop: false,
  },
  selection: { sort_by: 'rating', sort_order: 'desc', top_n: 25 },
  weighting: { method: 'equal' },
  rebalance: { cadence: 'monthly' },
  costs: { commission_bps: 5, slippage_bps: 8 },
  validation: { start: '2024-01-02', end: '2024-06-28', oos_split: 0.2, min_n_trades: 30 },
};

const OWN_ROW = {
  strategy_id: OWN_ID,
  name: 'Mi Momentum',
  description: null,
  latest_version: 1,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-02T00:00:00Z',
  spec: SPEC,
  template_slug: null,
  template_version: null,
};

const SHARED_CO = {
  ...OWN_ROW,
  strategy_id: SHARED_CO_ID,
  name: 'Value Compartida',
  permission: 'co_owner',
  owner_email: 'ana@example.com',
};

const SHARED_VIEW = {
  ...OWN_ROW,
  strategy_id: SHARED_VIEW_ID,
  name: 'Growth Ajena',
  permission: 'viewer',
  owner_email: 'luis@example.com',
};

interface ShareRow {
  share_id: string;
  strategy_id: string;
  shared_with_user_id: string;
  email: string;
  permission: 'viewer' | 'co_owner';
  created_at: string;
}

function share(strategyId: string, userId: string, email: string, permission: 'viewer' | 'co_owner'): ShareRow {
  return {
    share_id: `share-${userId}`,
    strategy_id: strategyId,
    shared_with_user_id: userId,
    email,
    permission,
    created_at: '2026-11-01T00:00:00Z',
  };
}

interface Recorded {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

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

interface MockOpts {
  sharedWithMe?: unknown[];
  /** Initial collaborators per strategy id. */
  shares?: Record<string, ShareRow[]>;
  /** Forced error response for POST …/shares. */
  createError?: { status: number; detail: string };
}

async function mockApi(page: Page, opts: MockOpts = {}): Promise<Recorded[]> {
  const calls: Recorded[] = [];
  const shares: Record<string, ShareRow[]> = JSON.parse(JSON.stringify(opts.shares ?? {}));
  const shared = opts.sharedWithMe ?? [];

  await page.route('**/templates/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/templates/', (route) => route.fulfill({ json: [] }));
  await page.route('**/strategies/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    let body: Record<string, unknown> | null = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = null;
    }
    calls.push({ method, path, body });

    if (path.endsWith('/strategies/shared-with-me')) {
      await route.fulfill({
        json: { items: shared, total: shared.length, limit: 50, offset: 0 },
      });
      return;
    }

    const m = path.match(/\/strategies\/([^/]+)\/shares(?:\/([^/]+))?$/);
    if (m) {
      const sid = m[1];
      const uid = m[2];
      const list = (shares[sid] ??= []);
      if (method === 'GET') {
        await route.fulfill({ json: { items: list, total: list.length } });
        return;
      }
      if (method === 'POST') {
        if (opts.createError) {
          await route.fulfill({
            status: opts.createError.status,
            json: { detail: opts.createError.detail },
          });
          return;
        }
        const b = body as { email: string; permission: 'viewer' | 'co_owner' };
        const created = share(sid, `u-${list.length + 1}`, b.email, b.permission);
        list.push(created);
        await route.fulfill({ status: 201, json: created });
        return;
      }
      if (method === 'PATCH' && uid) {
        const row = list.find((s) => s.shared_with_user_id === uid);
        if (row) row.permission = (body as { permission: 'viewer' | 'co_owner' }).permission;
        await route.fulfill({ json: row });
        return;
      }
      if (method === 'DELETE' && uid) {
        shares[sid] = list.filter((s) => s.shared_with_user_id !== uid);
        await route.fulfill({ status: 204, body: '' });
        return;
      }
    }

    const detail = path.match(/\/strategies\/([0-9a-f-]{36})$/);
    if (detail && method === 'GET') {
      const row = [OWN_ROW, SHARED_CO, SHARED_VIEW].find((r) => r.strategy_id === detail[1]);
      await route.fulfill({
        json: {
          ...row,
          version: 1,
          content_hash: 'beef'.repeat(16),
          permission: (row as { permission?: string }).permission ?? 'owner',
          owner_email: (row as { owner_email?: string }).owner_email ?? USER.email,
        },
      });
      return;
    }

    await route.fulfill({ json: [OWN_ROW] });
  });

  return calls;
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Share strategy' });

test.describe('Builder — compartir estrategias (#348)', () => {
  test('dueño: alta de viewer (POST), cambio de rol (PATCH) y quitar (DELETE) sin recargar', async ({
    page,
  }) => {
    await seedAuth(page);
    const calls = await mockApi(page, {
      shares: { [OWN_ID]: [share(OWN_ID, 'u-a', 'alice@example.com', 'viewer')] },
    });
    page.on('dialog', (d) => void d.accept());

    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: 'Mi Momentum' }).locator('button[title="Share"]').click();

    const dlg = dialog(page);
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText('alice@example.com')).toBeVisible();

    // alta de un viewer
    await dlg.getByLabel('Email').fill('bob@example.com');
    await dlg.getByRole('button', { name: 'Invite' }).click();
    await expect(dlg.getByText('bob@example.com')).toBeVisible();
    const post = calls.find((c) => c.method === 'POST' && c.path.endsWith(`/strategies/${OWN_ID}/shares`));
    expect(post?.body).toEqual({ email: 'bob@example.com', permission: 'viewer' });

    // cambio de rol → PATCH
    await dlg.getByLabel('Role for alice@example.com').selectOption('co_owner');
    await expect
      .poll(() => calls.find((c) => c.method === 'PATCH'))
      .toBeTruthy();
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.path.endsWith(`/strategies/${OWN_ID}/shares/u-a`)).toBe(true);
    expect(patch?.body).toEqual({ permission: 'co_owner' });
    await expect(dlg.getByLabel('Role for alice@example.com')).toHaveValue('co_owner');

    // quitar → DELETE
    await dlg.getByRole('button', { name: 'Remove alice@example.com' }).click();
    await expect(dlg.getByText('alice@example.com')).toHaveCount(0);
    const del = calls.find((c) => c.method === 'DELETE');
    expect(del?.path.endsWith(`/strategies/${OWN_ID}/shares/u-a`)).toBe(true);
    // la lista del modal se actualizó en el sitio: un único GET de shares
    expect(calls.filter((c) => c.method === 'GET' && c.path.endsWith('/shares'))).toHaveLength(1);
  });

  for (const err of [
    { status: 409, detail: 'Already shared with that user' },
    { status: 422, detail: 'No registered user with that email' },
  ]) {
    test(`${err.status}: el detail se ve dentro del modal y el modal sigue abierto`, async ({ page }) => {
      await seedAuth(page);
      await mockApi(page, { createError: err });

      await page.goto('/dashboard/builder');
      await page.locator('.sb-card', { hasText: 'Mi Momentum' }).locator('button[title="Share"]').click();
      const dlg = dialog(page);
      await dlg.getByLabel('Email').fill('dup@example.com');
      await dlg.getByRole('button', { name: 'Invite' }).click();

      await expect(dlg.getByText(err.detail)).toBeVisible();
      await expect(dlg).toBeVisible();
    });
  }

  test('co_owner: sin opción co_owner al invitar y filas co_owner sin controles', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, {
      sharedWithMe: [SHARED_CO],
      shares: {
        [SHARED_CO_ID]: [
          share(SHARED_CO_ID, 'u-co', 'carla@example.com', 'co_owner'),
          share(SHARED_CO_ID, 'u-vw', 'victor@example.com', 'viewer'),
        ],
      },
    });

    await page.goto('/dashboard/builder');
    const section = page.getByRole('region', { name: 'Shared with me' });
    await section.locator('.sb-card', { hasText: 'Value Compartida' }).locator('button[title="Share"]').click();

    const dlg = dialog(page);
    await expect(dlg.getByText('carla@example.com')).toBeVisible();
    // el selector de rol sólo ofrece Viewer
    await expect(dlg.getByRole('button', { name: 'Viewer', exact: true })).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Co-owner', exact: true })).toHaveCount(0);
    // fila co_owner: ni select ni quitar
    await expect(dlg.getByLabel('Role for carla@example.com')).toHaveCount(0);
    await expect(dlg.getByRole('button', { name: 'Remove carla@example.com' })).toHaveCount(0);
    // fila viewer: se puede quitar, pero no cambiar de rol
    await expect(dlg.getByRole('button', { name: 'Remove victor@example.com' })).toBeVisible();
    await expect(dlg.getByLabel('Role for victor@example.com')).toHaveCount(0);
  });

  test('shared-with-me con dos elementos: rol y correo del dueño; viewer sin botón Share', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockApi(page, { sharedWithMe: [SHARED_CO, SHARED_VIEW] });

    await page.goto('/dashboard/builder');
    const section = page.getByRole('region', { name: 'Shared with me' });
    await expect(section).toBeVisible();

    const co = section.locator('.sb-card', { hasText: 'Value Compartida' });
    await expect(co).toContainText('Co-owner');
    await expect(co).toContainText('shared by ana@example.com');
    await expect(co.locator('button[title="Share"]')).toHaveCount(1);

    const vw = section.locator('.sb-card', { hasText: 'Growth Ajena' });
    await expect(vw).toContainText('Viewer');
    await expect(vw).toContainText('shared by luis@example.com');
    await expect(vw.locator('button[title="Share"]')).toHaveCount(0);

    // la propia sigue en su sitio, con su Share
    await expect(
      page.locator('.sb-card', { hasText: 'Mi Momentum' }).locator('button[title="Share"]'),
    ).toHaveCount(1);
  });

  test('shared-with-me vacío: la sección no existe en el DOM', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockApi(page, { sharedWithMe: [] });

    await page.goto('/dashboard/builder');
    await expect(page.locator('.sb-card', { hasText: 'Mi Momentum' })).toBeVisible();
    await expect.poll(() => calls.some((c) => c.path.endsWith('/shared-with-me'))).toBe(true);
    await expect(page.getByRole('region', { name: 'Shared with me' })).toHaveCount(0);
    await expect(page.getByText('Shared with me')).toHaveCount(0);
  });

  test('abrir una compartida carga el detalle con GET /strategies/{id}', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockApi(page, { sharedWithMe: [SHARED_VIEW] });

    await page.goto('/dashboard/builder');
    await page
      .getByRole('region', { name: 'Shared with me' })
      .locator('.sb-card', { hasText: 'Growth Ajena' })
      .click();

    await expect
      .poll(() =>
        calls.some((c) => c.method === 'GET' && c.path.endsWith(`/strategies/${SHARED_VIEW_ID}`)),
      )
      .toBe(true);
    await expect(page.locator('.page-title')).toHaveText('Growth Ajena');
  });
});
