import { test, expect, type Page } from '@playwright/test';

/**
 * E2E weighting sectorial (backend #124/#125, UI #126):
 * las opciones "Sector-balanced" aparecen en el modal de crear desde screener
 * y en el de rebalanceo, el método elegido viaja como `weighting_method` en
 * los requests, y el detalle del historial muestra la asignación sectorial
 * usada (`spec_used.sector_weights`). Backend mockeado por rutas.
 */

const PF_ID = '88888888-8888-8888-8888-888888888888';
const REB_ID = 'bbbbbbbb-1111-2222-3333-555555555555';

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
  name: 'Sector US',
  description: null,
  portfolio_type: 'model',
  currency: 'USD',
  initial_cash: 100000,
  is_default: false,
  is_public: false,
  weighting_method: 'sector_equal',
  screener_filters: null,
  last_rebalance_date: null,
  analysis_start_date: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  is_owner: true,
  permission: 'owner',
  owner_email: USER.email,
};

const SECTOR_WEIGHTS = { Technology: 60.0, Healthcare: 40.0 };

const DIFF_SUMMARY = {
  exits: 0, entries: 1, increases: 1, reductions: 0, unchanged: 0,
  turnover_pct: 22.4, prioritize_held: false, held_kept: 0,
  skipped: [], warnings: [],
};

const PREVIEW = {
  portfolio_id: PF_ID,
  as_of: '2026-07-24',
  weighting_method: 'sector_equal',
  total_value: '102000.00',
  cash_before: '150.00',
  cash_after: '90.00',
  turnover_pct: '22.40',
  pre_state: {
    totals: { total_value: 102000, cash: 150, invested: 101850 },
    holdings: [],
    sector_breakdown: [],
  },
  diff: [
    {
      symbol_id: 'sym-TTT', ticker: 'TTT', action: 'increase',
      quantity_before: 10, quantity_after: 60, delta: 50,
      price: '100.00', amount: '5000.00', rating: 2,
    },
    {
      symbol_id: 'sym-HHH', ticker: 'HHH', action: 'entry',
      quantity_before: 0, quantity_after: 40, delta: 40,
      price: '100.00', amount: '4000.00', rating: 3,
    },
  ],
  orders: [
    {
      symbol_id: 'sym-TTT', ticker: 'TTT', side: 'buy', quantity: 50,
      price: '100.00', total_amount: '5000.00',
    },
    {
      symbol_id: 'sym-HHH', ticker: 'HHH', side: 'buy', quantity: 40,
      price: '100.00', total_amount: '4000.00',
    },
  ],
  diff_summary: DIFF_SUMMARY,
  spec_used: { version: 2, filters: {}, ranking: null },
  sector_weights: SECTOR_WEIGHTS,
  skipped: [],
  warnings: [],
};

const HISTORY = {
  items: [
    {
      rebalance_id: REB_ID,
      rebalance_date: '2026-07-24',
      executed_at: '2026-07-24T14:05:00Z',
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
        symbol_id: 'sym-TTT', ticker: 'TTT', qty: 10, price: 100, value: 1000,
        weight_pct: 1, avg_cost: 90, unrealized_pnl: 100, sector: 'Technology',
      },
    ],
    sector_breakdown: [{ sector: 'Technology', value: 1000, weight_pct: 1 }],
  },
  spec_used: {
    version: 2,
    filters: {},
    ranking: null,
    weighting_method: 'sector_equal',
    prioritize_held: false,
    sector_weights: SECTOR_WEIGHTS,
  },
};

const STOCK = (t: string, sector: string) => ({
  symbol_id: `sym-${t}`,
  ticker: t,
  name: `${t} Inc`,
  country: 'US',
  exchange: 'NASDAQ',
  sector,
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
  // (patrón: SOLO /alerts/events/** — nunca **/alerts/** porque intercepta
  // los módulos de Vite de src/features/alerts).
  await page.route('**/alerts/events/**', (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
}

interface Captured {
  previews: Record<string, unknown>[];
  applies: Record<string, unknown>[];
  creates: Record<string, unknown>[];
}

async function mockApi(page: Page): Promise<Captured> {
  const captured: Captured = { previews: [], applies: [], creates: [] };

  await page.route('**/screener/options*', (route) =>
    route.fulfill({
      json: {
        countries: ['US'],
        exchanges: ['NASDAQ'],
        sectors: ['Technology', 'Healthcare'],
      },
    }),
  );
  await page.route('**/screener/presets/**', (route) =>
    route.fulfill({ json: { items: [], total: 0, limit: 50, offset: 0 } }),
  );
  await page.route('**/screener/', (route) =>
    route.fulfill({
      json: {
        results: [STOCK('TTT', 'Technology'), STOCK('HHH', 'Healthcare')],
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

    if (path.endsWith('/portfolios/from-screener') && method === 'POST') {
      captured.creates.push(route.request().postDataJSON());
      return route.fulfill({
        json: { portfolio: PORTFOLIO, positions_count: 2, skipped: [] },
      });
    }
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
          n_sells: 0,
          n_buys: 2,
          cash_after: '90.00',
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

test.describe('Weighting sectorial (#124/#125/#126, UI)', () => {
  test('crear desde screener con Sector-balanced · Equal envía sector_equal', async ({
    page,
  }) => {
    await seedAuth(page);
    const captured = await mockApi(page);

    await page.goto('/dashboard/screening');
    await page.getByRole('button', { name: 'Save as Portfolio' }).click();

    await page.getByLabel('Portfolio name').fill('Sector US');
    await page.getByText('Sector-balanced · Equal', { exact: true }).click();
    await page.getByRole('button', { name: 'Create Portfolio', exact: true }).click();

    await expect
      .poll(() => captured.creates.length, { timeout: 5000 })
      .toBe(1);
    expect(
      (captured.creates[0] as Record<string, unknown>).weighting_method,
    ).toBe('sector_equal');
  });

  test('rebalanceo: la opción sectorial viaja en preview y confirm', async ({
    page,
  }) => {
    await seedAuth(page);
    const captured = await mockApi(page);

    await page.goto('/dashboard/screening');
    const openBtn = page.getByRole('button', { name: 'Rebalance Portfolio' });
    await expect(openBtn).toBeEnabled();
    await openBtn.click();

    await page.locator('#rebalance-target').selectOption(PF_ID);
    await page.getByText('Sector-balanced · Inverse Volatility').click();
    await page.getByRole('button', { name: 'Preview Rebalance' }).click();

    await expect
      .poll(() => captured.previews.length, { timeout: 5000 })
      .toBe(1);
    expect(
      (captured.previews[0] as Record<string, unknown>).weighting_method,
    ).toBe('sector_inverse_atr_calm');

    // Confirm: sin spec guardado → paso saveSpec; rebalancear sin guardar.
    await page.getByRole('button', { name: 'Confirm Rebalance' }).click();
    await page
      .getByRole('button', { name: 'Rebalance without saving' })
      .click();

    await expect(page).toHaveURL(new RegExp(`/dashboard/analysis/${PF_ID}`));
    expect(captured.applies).toHaveLength(1);
  });

  test('historial: el detalle muestra método sectorial y la asignación usada', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockApi(page);

    await page.goto(`/dashboard/analysis/${PF_ID}`);
    await page.getByRole('tab', { name: /Rebalance/i }).click();

    // Abrir el detalle (la fila entera es clickeable).
    await page.getByText('22.4%').first().click();

    await expect(
      page.getByText('Weighting: Sector-balanced · Equal'),
    ).toBeVisible();
    const block = page.getByTestId('rebalance-sector-weights');
    await expect(block).toBeVisible();
    await expect(block).toContainText('Technology');
    await expect(block).toContainText('60.0%');
    await expect(block).toContainText('Healthcare');
    await expect(block).toContainText('40.0%');
  });
});
