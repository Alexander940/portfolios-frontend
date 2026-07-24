import { test, expect, type Page } from '@playwright/test';

/**
 * E2E prioridad para posiciones actuales (backend #117–#119, UI):
 * el checkbox "Prioritize current holdings" del modal de rebalanceo viaja como
 * `prioritize_held` en el preview y en el confirm, el preview muestra el badge
 * "kept by priority" (held_kept), y el historial expone chip + línea del spec.
 * Backend mockeado por rutas.
 */

const PF_ID = '77777777-7777-7777-7777-777777777777';
const REB_ID = 'aaaaaaaa-1111-2222-3333-444444444444';

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

const PORTFOLIO = {
  portfolio_id: PF_ID,
  user_id: USER.user_id,
  name: 'Growth US',
  description: null,
  portfolio_type: 'model',
  currency: 'USD',
  initial_cash: 100000,
  is_default: false,
  is_public: false,
  weighting_method: 'equal',
  screener_filters: null, // sin spec guardado → el confirm pasa por saveSpec
  last_rebalance_date: null,
  analysis_start_date: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  is_owner: true,
  permission: 'owner',
  owner_email: USER.email,
};

const DIFF_SUMMARY = {
  exits: 1, entries: 1, increases: 0, reductions: 0, unchanged: 1,
  turnover_pct: 35.5, prioritize_held: true, held_kept: 1,
  skipped: [], warnings: [],
};

const PREVIEW = {
  portfolio_id: PF_ID,
  as_of: '2026-07-23',
  weighting_method: 'equal',
  total_value: '102000.00',
  cash_before: '150.00',
  cash_after: '80.00',
  turnover_pct: '35.50',
  pre_state: {
    totals: { total_value: 102000, cash: 150, invested: 101850 },
    holdings: [],
    sector_breakdown: [],
  },
  diff: [
    {
      symbol_id: 'sym-HHH', ticker: 'HHH', action: 'unchanged',
      quantity_before: 10, quantity_after: 10, delta: 0,
      price: '100.00', amount: '0.00', rating: 1,
    },
    {
      symbol_id: 'sym-AAA', ticker: 'AAA', action: 'entry',
      quantity_before: 0, quantity_after: 50, delta: 50,
      price: '200.00', amount: '10000.00', rating: 3,
    },
    {
      symbol_id: 'sym-OLD', ticker: 'OLD', action: 'exit',
      quantity_before: 40, quantity_after: 0, delta: -40,
      price: '250.00', amount: '10000.00', rating: null,
    },
  ],
  orders: [
    {
      symbol_id: 'sym-OLD', ticker: 'OLD', side: 'sell', quantity: 40,
      price: '250.00', total_amount: '10000.00',
    },
    {
      symbol_id: 'sym-AAA', ticker: 'AAA', side: 'buy', quantity: 50,
      price: '200.00', total_amount: '10000.00',
    },
  ],
  diff_summary: DIFF_SUMMARY,
  spec_used: { version: 2, filters: {}, ranking: null },
  skipped: [],
  warnings: [],
};

const HISTORY = {
  items: [
    {
      rebalance_id: REB_ID,
      rebalance_date: '2026-07-23',
      executed_at: '2026-07-23T14:05:00Z',
      executed_by_email: USER.email,
      diff_summary: DIFF_SUMMARY,
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

const DETAIL = {
  ...HISTORY.items[0],
  portfolio_id: PF_ID,
  pre_state: {
    totals: { total_value: 102000, cash: 150, invested: 101850 },
    holdings: [
      {
        symbol_id: 'sym-HHH', ticker: 'HHH', qty: 10, price: 100, value: 1000,
        weight_pct: 1, avg_cost: 90, unrealized_pnl: 100, sector: 'Technology',
      },
    ],
    sector_breakdown: [{ sector: 'Technology', value: 1000, weight_pct: 1 }],
  },
  spec_used: {
    version: 2,
    filters: {},
    ranking: { sort_by: 'rating', sort_order: 'desc', top_n: 10 },
    weighting_method: 'equal',
    prioritize_held: true,
  },
};

const STOCK = (t: string) => ({
  symbol_id: `sym-${t}`,
  ticker: t,
  name: `${t} Inc`,
  country: 'US',
  exchange: 'NASDAQ',
  sector: 'Technology',
  rating: 2,
});

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
  // La campana del layout consulta unread-count; sin mock, un backend local
  // vivo respondería 401 y deslogue
  // (patrón: SOLO /alerts/events/** — nunca **/alerts/** porque intercepta
  // los módulos de Vite de src/features/alerts).
  await page.route('**/alerts/events/**', (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
}

interface Captured {
  previews: Record<string, unknown>[];
  applies: Record<string, unknown>[];
}

async function mockApi(page: Page): Promise<Captured> {
  const captured: Captured = { previews: [], applies: [] };

  await page.route('**/screener/options*', (route) =>
    route.fulfill({
      json: { countries: ['US'], exchanges: ['NASDAQ'], sectors: ['Technology'] },
    }),
  );
  await page.route('**/screener/presets/**', (route) =>
    route.fulfill({ json: { items: [], total: 0, limit: 50, offset: 0 } }),
  );
  await page.route('**/screener/', (route) =>
    route.fulfill({
      json: {
        results: [STOCK('AAA'), STOCK('HHH')],
        total_count: 2,
        limit: 50,
        offset: 0,
      },
    }),
  );

  await page.route('**/portfolios/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path.endsWith('/rebalance/preview') && method === 'POST') {
      captured.previews.push(route.request().postDataJSON());
      return route.fulfill({ json: PREVIEW });
    }
    if (path.endsWith('/rebalance') && method === 'POST') {
      captured.applies.push(route.request().postDataJSON());
      return route.fulfill({
        json: {
          portfolio_id: PF_ID,
          as_of: PREVIEW.as_of,
          n_sells: 1,
          n_buys: 1,
          cash_after: '80.00',
          positions_count: 2,
        },
      });
    }
    if (path.endsWith(`/rebalances/${REB_ID}`)) {
      return route.fulfill({ json: DETAIL });
    }
    if (/\/rebalances$/.test(path)) {
      return route.fulfill({ json: HISTORY });
    }
    if (path.endsWith('/shared-with-me')) {
      return route.fulfill({ json: { items: [], total: 0, limit: 100, offset: 0 } });
    }
    if (path.endsWith('/positions')) {
      return route.fulfill({ json: { items: [], total: 0, limit: 200, offset: 0 } });
    }
    if (path.endsWith('/performance/curve')) {
      return route.fulfill({
        json: {
          portfolio_id: PF_ID, benchmark: 'SPY', return_basis: 'total_return',
          base_mode: 'index_100', base: 100, benchmark_available: false,
          start_date: null, end_date: null, points: [],
        },
      });
    }
    if (path.endsWith(`/portfolios/${PF_ID}`)) {
      return route.fulfill({ json: PORTFOLIO });
    }
    if (path.endsWith('/portfolios/')) {
      return route.fulfill({
        json: { items: [PORTFOLIO], total: 1, limit: 100, offset: 0 },
      });
    }
    return route.fulfill({ status: 404, json: { detail: 'Not mocked' } });
  });

  return captured;
}

test.describe('Prioridad para posiciones actuales (#117-#119, UI)', () => {
  test('el checkbox viaja en preview y confirm; el preview muestra kept by priority', async ({
    page,
  }) => {
    await seedAuth(page);
    const captured = await mockApi(page);

    await page.goto('/dashboard/screening');
    const openBtn = page.getByRole('button', { name: 'Rebalance Portfolio' });
    await expect(openBtn).toBeEnabled();
    await openBtn.click();

    await page.locator('#rebalance-target').selectOption(PF_ID);
    await page.getByTestId('rebalance-prioritize-held').check();
    await page.getByRole('button', { name: 'Preview Rebalance' }).click();

    // Badge de protegidas en el resumen del preview.
    await expect(page.getByTestId('rebalance-held-kept')).toContainText(
      '1 kept by priority',
    );
    expect(captured.previews).toHaveLength(1);
    expect(
      (captured.previews[0] as Record<string, unknown>).prioritize_held,
    ).toBe(true);

    // Confirm: sin spec guardado → paso saveSpec; rebalancear sin guardar.
    await page.getByRole('button', { name: 'Confirm Rebalance' }).click();
    await page
      .getByRole('button', { name: 'Rebalance without saving' })
      .click();

    await expect(page).toHaveURL(new RegExp(`/dashboard/analysis/${PF_ID}`));
    expect(captured.applies).toHaveLength(1);
    const apply = captured.applies[0] as Record<string, unknown>;
    expect(apply.prioritize_held).toBe(true);
    expect(apply.update_saved_spec).toBe(false);
    expect(apply.as_of).toBe(PREVIEW.as_of);
  });

  test('apagado por defecto: el request lleva prioritize_held=false', async ({
    page,
  }) => {
    await seedAuth(page);
    const captured = await mockApi(page);

    await page.goto('/dashboard/screening');
    await page.getByRole('button', { name: 'Rebalance Portfolio' }).click();
    await page.locator('#rebalance-target').selectOption(PF_ID);
    await page.getByRole('button', { name: 'Preview Rebalance' }).click();

    await expect
      .poll(() => captured.previews.length, { timeout: 5000 })
      .toBe(1);
    expect(
      (captured.previews[0] as Record<string, unknown>).prioritize_held,
    ).toBe(false);
  });

  test('historial: chip "kept" en la fila y línea del spec en el detalle', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockApi(page);

    await page.goto(`/dashboard/analysis/${PF_ID}`);
    await page.getByRole('tab', { name: /Rebalance/i }).click();

    const chip = page.getByTestId('rebalance-priority-chip');
    await expect(chip).toContainText('1 kept');

    // Abrir el detalle → la línea del spec audita la prioridad.
    await page.getByText('Growth US').first().waitFor();
    await chip.click(); // la fila entera es clickeable
    await expect(
      page.getByText('Prioritized current holdings'),
    ).toBeVisible();
  });
});
