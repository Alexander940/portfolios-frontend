import { test, expect, type Page } from '@playwright/test';

/**
 * E2E — modo solo lectura por rol, «Duplicate» y transferencia de propiedad en
 * el strategy builder (portfolios-backend#349).
 *
 * API route-mocked (nada real se transfiere ni se duplica). Asserts:
 *  - viewer: TODOS los controles del formulario (recorrido completo del DOM,
 *    no una lista de campos) están deshabilitados; «Run backtest» emite sólo
 *    POST …/backtest; cero PUT / DELETE / POST …/tracker / POST /strategies/
 *    en todo el test; aviso «Read-only — shared by <correo>»; ninguna copia
 *    local con el id ajeno;
 *  - co_owner: guardar emite PUT; «Delete», «Transfer ownership» y el tracker
 *    no existen en el DOM;
 *  - owner: las nueve filas de su columna;
 *  - Duplicate: POST …/duplicate, se abre la copia como dueño y la lista la
 *    incluye; 422 basket_not_found → mensaje y no navega;
 *  - Transfer: sin confirmar no sale nada; confirmado sale POST …/transfer con
 *    el correo y la estrategia pasa a «Shared with me» como co_owner; 409
 *    duplicate_name / basket_private se ven y el modal sigue abierto.
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
const COPY_ID = '66666666-6666-6666-6666-666666666666';

const SPEC = {
  general: { instrument_type: 'stocks', currency: 'USD', benchmark: 'SPY', performance_metric: 'total_return' },
  universe: { country: ['US'], rating: { min: 1 } },
  selection_filters: { rating: { min: 2 } },
  hold_filters: { rating: { min: -1 } },
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

type Row = {
  strategy_id: string;
  name: string;
  description: null;
  latest_version: number;
  created_at: string;
  updated_at: string;
  spec: typeof SPEC;
  template_slug: null;
  template_version: null;
  permission?: 'owner' | 'co_owner' | 'viewer';
  owner_email?: string;
};

const OWN_ROW: Row = {
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

const SHARED_CO: Row = {
  ...OWN_ROW,
  strategy_id: SHARED_CO_ID,
  name: 'Value Compartida',
  permission: 'co_owner',
  owner_email: 'ana@example.com',
};

const SHARED_VIEW: Row = {
  ...OWN_ROW,
  strategy_id: SHARED_VIEW_ID,
  name: 'Growth Ajena',
  permission: 'viewer',
  owner_email: 'luis@example.com',
};

const COPY_ROW: Row = { ...OWN_ROW, strategy_id: COPY_ID, name: 'Growth Ajena (copia)' };

const RESOLVE = {
  as_of: '2026-11-20',
  alpha_window: '12m',
  alpha_metric: 'alpha_12m',
  alpha_pit_safe: true,
  base_method: 'universe_marketcap',
  top_n: null,
  total_market_cap: 1e12,
  eligible_count: 300,
  coverage_pct: 0.95,
  sectors: [
    { sector: 'Technology', member_count: 120, alpha_coverage: 110, base_weight_pct: 60, alpha_vs_spy: 3.2 },
    { sector: 'Energy', member_count: 180, alpha_coverage: 170, base_weight_pct: 40, alpha_vs_spy: -1.1 },
  ],
};

const DONE_RESULT = {
  job_id: 'j1',
  status: 'done',
  error: null,
  result: {
    metrics: {
      total_return: 0.12, cagr: 0.25, volatility: 0.18, sharpe: 1.4, sortino: 1.9,
      calmar: 2.1, max_drawdown: -0.08, alpha: 0.01, beta: 1.02, n_trades: 42,
      n_rebalances: 6, is_sharpe: 1.5, oos_sharpe: 1.2,
      low_sample_trades: false, low_sample_universe: false,
    },
    coverage_pct: 0.98,
    fill_convention: 'next_open_net_of_costs',
    initial_cash: 100000,
    window_start: '2024-01-02',
    window_end: '2024-06-28',
    equity: [
      { date: '2024-01-02', total_value: 100000, cash: 0, invested: 100000, benchmark_value: 100, daily_return: 0, drawdown: 0 },
      { date: '2024-06-28', total_value: 112000, cash: 0, invested: 112000, benchmark_value: 108, daily_return: 0.001, drawdown: -0.01 },
    ],
    trades: [],
  },
};

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
  await page.route('**/alerts/events/**', (route) => route.fulfill({ json: { count: 0 } }));
}

interface MockOpts {
  own?: Row[];
  sharedWithMe?: Row[];
  duplicateError?: { status: number; detail: unknown };
  transferError?: { status: number; detail: unknown };
}

async function mockApi(page: Page, opts: MockOpts = {}): Promise<Recorded[]> {
  const calls: Recorded[] = [];
  let own = [...(opts.own ?? [OWN_ROW])];
  let shared = [...(opts.sharedWithMe ?? [])];
  const all = () => [...own, ...shared, COPY_ROW];

  await page.route('**/templates/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/templates/', (route) => route.fulfill({ json: [] }));
  await page.route('**/backtests/*', (route) => route.fulfill({ json: DONE_RESULT }));
  await page.route('**/strategies/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    let body: Record<string, unknown> | null = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = null;
    }
    calls.push({ method, path, body });

    if (path.endsWith('/strategies/shared-with-me')) {
      await route.fulfill({ json: { items: shared, total: shared.length, limit: 50, offset: 0 } });
      return;
    }
    if (path.endsWith('/strategies/resolve-universe')) {
      await route.fulfill({ json: RESOLVE });
      return;
    }
    if (/\/shares$/.test(path) && method === 'GET') {
      await route.fulfill({ json: { items: [], total: 0 } });
      return;
    }
    const dup = path.match(/\/strategies\/([0-9a-f-]{36})\/duplicate$/);
    if (dup && method === 'POST') {
      if (opts.duplicateError) {
        await route.fulfill({ status: opts.duplicateError.status, json: { detail: opts.duplicateError.detail } });
        return;
      }
      own = [COPY_ROW, ...own];
      await route.fulfill({
        status: 201,
        json: { strategy_id: COPY_ID, version: 1, content_hash: 'cafe'.repeat(16) },
      });
      return;
    }
    const tr = path.match(/\/strategies\/([0-9a-f-]{36})\/transfer$/);
    if (tr && method === 'POST') {
      if (opts.transferError) {
        await route.fulfill({ status: opts.transferError.status, json: { detail: opts.transferError.detail } });
        return;
      }
      const row = own.find((r) => r.strategy_id === tr[1])!;
      const email = (body as { email: string }).email;
      own = own.filter((r) => r.strategy_id !== tr[1]);
      shared = [...shared, { ...row, permission: 'co_owner', owner_email: email }];
      await route.fulfill({
        json: { ...row, version: 1, content_hash: 'beef'.repeat(16), permission: 'co_owner', owner_email: email },
      });
      return;
    }
    if (path.endsWith('/backtest') && method === 'POST') {
      await route.fulfill({ json: { job_id: 'j1', status: 'done', cached: false } });
      return;
    }
    const detail = path.match(/\/strategies\/([0-9a-f-]{36})$/);
    if (detail && method === 'GET') {
      const row = all().find((r) => r.strategy_id === detail[1])!;
      await route.fulfill({
        json: {
          ...row,
          version: 1,
          content_hash: 'beef'.repeat(16),
          permission: row.permission ?? 'owner',
          owner_email: row.owner_email ?? USER.email,
        },
      });
      return;
    }
    if (detail && method === 'PUT') {
      await route.fulfill({
        json: { strategy_id: detail[1], version: 2, content_hash: 'f00d'.repeat(16), spec_changed: true },
      });
      return;
    }
    if (method === 'GET' && /\/strategies\/?$/.test(path)) {
      await route.fulfill({ json: own });
      return;
    }
    await route.fulfill({ status: 500, json: { detail: `unexpected ${method} ${path}` } });
  });

  return calls;
}

const writes = (calls: Recorded[]) =>
  calls.filter(
    (c) =>
      c.method === 'PUT' ||
      c.method === 'DELETE' ||
      c.method === 'PATCH' ||
      (c.method === 'POST' && /\/tracker$/.test(c.path)) ||
      (c.method === 'POST' && /\/strategies\/?$/.test(c.path)) ||
      (c.method === 'POST' && /\/(shares|transfer)$/.test(c.path)),
  );

const sharedSection = (page: Page) => page.getByRole('region', { name: 'Shared with me' });
const ownCard = (page: Page, name: string) =>
  page.locator('.sb-list').first().locator('.sb-card:not(.shared)', { hasText: name });

/** Every interactive control inside the builder form + summary card, except
 *  the CTA column (Run / Cancel). Returns [total, enabled descriptions]. */
async function enabledControls(page: Page): Promise<{ total: number; enabled: string[] }> {
  return page.evaluate(() => {
    const root = document.querySelector('.sb-build-grid');
    if (!root) return { total: -1, enabled: ['no .sb-build-grid'] };
    const els = Array.from(
      root.querySelectorAll<HTMLElement>(
        'input, select, textarea, button, [role="button"], [role="switch"], [role="checkbox"], [role="radio"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.closest('.sb-cta-col'));
    const enabled = els
      .filter((el) => !el.matches(':disabled') && el.getAttribute('aria-disabled') !== 'true')
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}|${(el.textContent ?? '').trim().slice(0, 30)}`);
    return { total: els.length, enabled };
  });
}

test.describe('Builder — solo lectura, Duplicate y transferencia (#349)', () => {
  test('viewer: formulario entero deshabilitado, Run sin PUT, ninguna escritura', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockApi(page, { sharedWithMe: [SHARED_VIEW] });

    await page.goto('/dashboard/builder');
    await sharedSection(page).locator('.sb-card', { hasText: 'Growth Ajena' }).click();
    await expect(page.locator('.page-title')).toHaveText('Growth Ajena');

    // aviso
    await expect(page.getByTestId('sb-readonly-banner')).toHaveText(/Read-only — shared by luis@example\.com/);

    // abre el subpanel de permanencia (la cabecera sigue siendo navegación)
    // y espera a la tabla de sectores para que sus inputs estén en el DOM.
    await expect(page.locator('.sb-build-grid').getByText('Technology').first()).toBeVisible();

    const { total, enabled } = await enabledControls(page);
    expect(total).toBeGreaterThan(30);
    expect(enabled).toEqual([]);

    // CTA: sólo Run + Cancel; nada de guardar
    await expect(page.getByRole('button', { name: 'Save & backtest' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save draft' })).toHaveCount(0);
    // cabecera: Duplicate sí; Share, Delete, Transfer, tracker no
    await expect(page.getByTestId('sb-duplicate')).toBeVisible();
    await expect(page.getByTestId('sb-share')).toHaveCount(0);
    await expect(page.getByTestId('sb-tracker-link')).toHaveCount(0);
    await expect(page.getByText('Transfer ownership')).toHaveCount(0);
    await expect(page.locator('button[title="Delete"]')).toHaveCount(0);

    // resolve-universe lleva el strategy_id de la estrategia abierta
    const resolve = calls.find((c) => c.path.endsWith('/resolve-universe'));
    expect(resolve?.body?.strategy_id).toBe(SHARED_VIEW_ID);

    await page.getByRole('button', { name: 'Run backtest' }).click();
    await expect
      .poll(() => calls.some((c) => c.method === 'POST' && c.path.endsWith(`/strategies/${SHARED_VIEW_ID}/backtest`)))
      .toBe(true);
    await expect(page.getByRole('button', { name: 'Edit' }).first()).toBeVisible();

    // volver a editar desde resultados: sigue en solo lectura
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await expect(page.getByTestId('sb-readonly-banner')).toBeVisible();
    expect((await enabledControls(page)).enabled).toEqual([]);

    // de vuelta a la lista: ninguna copia local con el id ajeno
    await page.getByRole('button', { name: 'Strategies' }).click();
    await expect(sharedSection(page)).toBeVisible();
    await expect(ownCard(page, 'Growth Ajena')).toHaveCount(0);
    const stored = await page.evaluate(() => localStorage.getItem('sb-strategies') ?? '');
    expect(stored).not.toContain(SHARED_VIEW_ID);

    expect(writes(calls)).toEqual([]);
  });

  test('co_owner: guardar emite PUT; sin Delete, Transfer ni tracker', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockApi(page, { sharedWithMe: [SHARED_CO] });

    await page.goto('/dashboard/builder');
    const row = sharedSection(page).locator('.sb-card', { hasText: 'Value Compartida' });
    await expect(row.locator('button[title="Delete"]')).toHaveCount(0);
    await expect(row.locator('button[title="Duplicate"]')).toHaveCount(1);
    await row.click();

    await expect(page.locator('.page-title')).toHaveText('Value Compartida');
    await expect(page.getByTestId('sb-readonly-banner')).toHaveCount(0);
    await expect(page.getByPlaceholder('Strategy name')).toBeEnabled();
    await expect(page.getByTestId('sb-tracker-link')).toHaveCount(0);
    await expect(page.locator('button[title="Delete"]')).toHaveCount(0);

    // Share (co_owner) sin la sección de transferencia
    await page.getByTestId('sb-share').click();
    const dlg = page.getByRole('dialog', { name: 'Share strategy' });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText('Transfer ownership')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);

    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect
      .poll(() => calls.find((c) => c.method === 'PUT' && c.path.endsWith(`/strategies/${SHARED_CO_ID}`)))
      .toBeTruthy();
    expect(calls.filter((c) => c.method === 'DELETE' || /\/(tracker|transfer)$/.test(c.path))).toEqual([]);
  });

  test('owner: las nueve filas de su columna', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockApi(page);

    await page.goto('/dashboard/builder');
    const card = ownCard(page, 'Mi Momentum');
    // Delete / Share / Duplicate en la fila propia
    await expect(card.locator('button[title="Delete"]')).toHaveCount(1);
    await expect(card.locator('button[title="Share"]')).toHaveCount(1);
    await expect(card.locator('button[title="Duplicate"]')).toHaveCount(1);

    // Share → Transfer ownership presente
    await card.locator('button[title="Share"]').click();
    const dlg = page.getByRole('dialog', { name: 'Share strategy' });
    await expect(dlg.getByText('Transfer ownership')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);

    await card.locator('button[title="Edit"]').click();
    await expect(page.locator('.page-title')).toHaveText('Mi Momentum');
    // campos editables, sin aviso, tracker + Duplicate + Share en la cabecera
    await expect(page.getByTestId('sb-readonly-banner')).toHaveCount(0);
    await expect(page.locator('.sb-build-grid').getByText('Technology').first()).toBeVisible();
    const { enabled } = await enabledControls(page);
    expect(enabled.length).toBeGreaterThan(30);
    await expect(page.getByTestId('sb-tracker-link')).toHaveAttribute('href', `/dashboard/strategy/${OWN_ID}`);
    await expect(page.getByTestId('sb-duplicate')).toBeVisible();
    await expect(page.getByTestId('sb-share')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible();

    const resolve = calls.find((c) => c.path.endsWith('/resolve-universe'));
    expect(resolve?.body?.strategy_id).toBe(OWN_ID);

    // guardar al ejecutar → PUT, luego POST …/backtest
    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect
      .poll(() => calls.some((c) => c.method === 'POST' && c.path.endsWith(`/strategies/${OWN_ID}/backtest`)))
      .toBe(true);
    expect(calls.some((c) => c.method === 'PUT' && c.path.endsWith(`/strategies/${OWN_ID}`))).toBe(true);
  });

  test('Duplicate: POST …/duplicate, abre la copia como dueño y la lista la incluye', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockApi(page, { sharedWithMe: [SHARED_VIEW] });

    await page.goto('/dashboard/builder');
    await sharedSection(page)
      .locator('.sb-card', { hasText: 'Growth Ajena' })
      .locator('button[title="Duplicate"]')
      .click();

    await expect
      .poll(() => calls.find((c) => c.method === 'POST' && c.path.endsWith(`/strategies/${SHARED_VIEW_ID}/duplicate`)))
      .toBeTruthy();
    await expect(page.locator('.page-title')).toHaveText('Growth Ajena (copia)');
    await expect(page.getByTestId('sb-readonly-banner')).toHaveCount(0);
    await expect(page.getByPlaceholder('Strategy name')).toBeEnabled();
    await expect(page.getByTestId('sb-tracker-link')).toHaveAttribute('href', `/dashboard/strategy/${COPY_ID}`);

    await page.getByRole('button', { name: 'Strategies' }).click();
    await expect(ownCard(page, 'Growth Ajena (copia)')).toBeVisible();
  });

  test('Duplicate: 422 basket_not_found muestra un mensaje y no navega', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockApi(page, {
      sharedWithMe: [SHARED_VIEW],
      duplicateError: { status: 422, detail: { code: 'basket_not_found', basket_id: '77777777-7777-7777-7777-777777777777' } },
    });

    await page.goto('/dashboard/builder');
    await sharedSection(page)
      .locator('.sb-card', { hasText: 'Growth Ajena' })
      .locator('button[title="Duplicate"]')
      .click();

    await expect(page.getByTestId('sb-action-error')).toContainText(/basket/i);
    await expect(page.locator('.page-title')).toHaveText('Strategy Builder');
    expect(calls.some((c) => c.method === 'GET' && c.path.endsWith(`/strategies/${COPY_ID}`))).toBe(false);
  });

  test('Transfer: confirmación explícita; después la estrategia está en Shared with me como co_owner', async ({
    page,
  }) => {
    await seedAuth(page);
    const calls = await mockApi(page);
    const transfers = () => calls.filter((c) => /\/transfer$/.test(c.path));

    await page.goto('/dashboard/builder');
    await ownCard(page, 'Mi Momentum').locator('button[title="Share"]').click();
    const dlg = page.getByRole('dialog', { name: 'Share strategy' });
    await dlg.getByLabel('Transfer to').fill('nuevo@example.com');
    await dlg.getByRole('button', { name: 'Transfer…' }).click();

    // segundo paso: nombra la estrategia y el destino; nada enviado aún
    const confirm = dlg.getByTestId('sb-transfer-confirm');
    await expect(confirm).toContainText('Mi Momentum');
    await expect(confirm).toContainText('nuevo@example.com');
    expect(transfers()).toEqual([]);
    await dlg.getByRole('button', { name: 'Back' }).click();
    await expect(confirm).toHaveCount(0);
    expect(transfers()).toEqual([]);

    await dlg.getByRole('button', { name: 'Transfer…' }).click();
    await dlg.getByRole('button', { name: 'Confirm transfer' }).click();
    await expect.poll(() => transfers().length).toBe(1);
    expect(transfers()[0].method).toBe('POST');
    expect(transfers()[0].path.endsWith(`/strategies/${OWN_ID}/transfer`)).toBe(true);
    expect(transfers()[0].body).toEqual({ email: 'nuevo@example.com' });

    await expect(dlg).toHaveCount(0);
    const moved = sharedSection(page).locator('.sb-card', { hasText: 'Mi Momentum' });
    await expect(moved).toContainText('Co-owner');
    await expect(moved).toContainText('shared by nuevo@example.com');
    await expect(ownCard(page, 'Mi Momentum')).toHaveCount(0);
  });

  for (const err of [
    {
      name: 'duplicate_name',
      detail: { code: 'duplicate_name', message: 'nuevo@example.com already has a strategy named "Mi Momentum"' },
      shown: 'already has a strategy named',
    },
    {
      name: 'basket_private',
      detail: {
        code: 'basket_private',
        basket_id: '77777777-7777-7777-7777-777777777777',
        message: 'The strategy uses a private basket; it cannot be transferred',
      },
      shown: 'private basket',
    },
  ]) {
    test(`Transfer: 409 ${err.name} se muestra y el modal sigue abierto`, async ({ page }) => {
      await seedAuth(page);
      await mockApi(page, { transferError: { status: 409, detail: err.detail } });

      await page.goto('/dashboard/builder');
      await ownCard(page, 'Mi Momentum').locator('button[title="Share"]').click();
      const dlg = page.getByRole('dialog', { name: 'Share strategy' });
      await dlg.getByLabel('Transfer to').fill('nuevo@example.com');
      await dlg.getByRole('button', { name: 'Transfer…' }).click();
      await dlg.getByRole('button', { name: 'Confirm transfer' }).click();

      await expect(dlg.getByText(err.shown)).toBeVisible();
      await expect(dlg).toBeVisible();
      await expect(ownCard(page, 'Mi Momentum')).toHaveCount(1);
    });
  }
});
