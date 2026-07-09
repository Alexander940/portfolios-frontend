import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #4 — index view: tracker list + summary + untracked group.
 *
 * backend#50 (GET /trackers) is NOT deployed yet; this spec mocks the
 * documented contract, which is the agreed oracle for the frontend.
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

const TRACKER_ST1 = {
  tracker_id: 't1',
  strategy_id: 'st-1',
  strategy_version_id: 'v1',
  portfolio_id: 'p1',
  status: 'active',
  initial_cash: '100000.00',
  started_at: '2026-01-02',
  last_rebalance_date: '2026-07-01',
  next_rebalance_date: '2026-07-15',
  last_evaluated_date: '2026-07-08',
  force_rebalance: false,
  notifications_enabled: true,
  last_error: null,
  created_at: '2026-01-02T00:00:00Z',
};

// st-1/st-2 trackeadas; st-3/st-4 sin tracker.
// Summary esperado: 2 trackers, $162,345.67 combinado,
// P&L total $10,845.67, P&L día -$250.10.
const LIST = {
  data_as_of: '2026-07-08',
  items: [
    {
      tracked: true,
      tracker_id: 't1',
      strategy_id: 'st-1',
      strategy_name: 'Momentum Global',
      version: 2,
      status: 'active',
      next_rebalance_date: '2026-07-15',
      last_rebalance_date: '2026-07-01',
      total_value: '112345.67',
      cash: '512.34',
      pnl_total: '12345.67',
      pnl_total_pct: '12.35',
      pnl_day: '-250.10',
      pnl_day_pct: '-0.22',
      holdings_count: 14,
      sparkline: ['100', '101', '103', '102', '106'],
    },
    {
      tracked: true,
      tracker_id: 't2',
      strategy_id: 'st-2',
      strategy_name: 'Value US',
      version: 1,
      status: 'error',
      next_rebalance_date: null,
      last_rebalance_date: '2026-06-20',
      total_value: '50000.00',
      cash: '100.00',
      pnl_total: '-1500.00',
      pnl_total_pct: '-2.91',
      pnl_day: '0',
      pnl_day_pct: '0',
      holdings_count: 9,
      sparkline: ['100', '99', '97', '98', '96'],
    },
    { tracked: false, strategy_id: 'st-3', strategy_name: 'Dividendos LATAM' },
    { tracked: false, strategy_id: 'st-4', strategy_name: 'Small Caps' },
  ],
};

const PREVIEW_ST3 = {
  data_as_of: '2026-07-08',
  warnings: [],
  eligible_count: 1,
  coverage_pct: '0.9',
  cash_pct: '0.01',
  sector_breakdown: [],
  holdings: [
    {
      symbol_id: 's1',
      ticker: 'KO',
      name: 'Coca-Cola',
      sector: 'Consumer Defensive',
      rating: 2,
      score: '1.10',
      price: '60.00',
      weight_pct: '100',
      shares: 1666,
      est_value: '99960',
      weight_realized_pct: '99.96',
    },
  ],
};

const EMPTY_CURVE = {
  portfolio_id: 'p1',
  benchmark: 'SPY',
  return_basis: 'total_return',
  base_mode: 'index_100',
  base: 100,
  benchmark_available: false,
  start_date: null,
  end_date: null,
  points: [],
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

interface MockOptions {
  list?: Record<string, unknown>;
  /** Arranca fallando con 500; el test apaga el flag antes de Reintentar. */
  failInitially?: boolean;
}

interface MockHandle {
  trackers: number;
  fail: boolean;
}

async function mockApi(page: Page, opts: MockOptions = {}): Promise<MockHandle> {
  const handle: MockHandle = { trackers: 0, fail: opts.failInitially ?? false };

  await page.route('**/trackers', async (route) => {
    handle.trackers += 1;
    if (handle.fail) {
      await route.fulfill({ status: 500, json: { detail: 'Internal error' } });
      return;
    }
    await route.fulfill({ json: opts.list ?? LIST });
  });

  // Stubs del detalle (para las navegaciones): st-1 con tracker, st-3 sin.
  await page.route('**/portfolios/*/positions*', (route) =>
    route.fulfill({ json: { items: [], total: 0, limit: 200, offset: 0 } }),
  );
  await page.route('**/portfolios/*/performance/curve*', (route) =>
    route.fulfill({ json: EMPTY_CURVE }),
  );
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/tracker') && route.request().method() === 'GET') {
      if (url.pathname.includes('/st-1/')) {
        await route.fulfill({ json: TRACKER_ST1 });
      } else {
        await route.fulfill({ status: 404, json: { detail: 'Tracker not found' } });
      }
      return;
    }
    if (url.pathname.endsWith('/tracker/drift')) {
      await route.fulfill({
        json: { entries: [], exits: [], weight_drift: [], warnings: [] },
      });
      return;
    }
    if (url.pathname.endsWith('/tracker/events')) {
      await route.fulfill({ json: { events: [], total: 0, limit: 10, offset: 0 } });
      return;
    }
    if (url.pathname.endsWith('/holdings')) {
      await route.fulfill({ json: PREVIEW_ST3 });
      return;
    }
    await route.fulfill({ status: 404, json: { detail: 'Not mocked' } });
  });

  return handle;
}

const INDEX_URL = '/dashboard/strategy';

test.describe('Vista índice (#4)', () => {
  test('UNA llamada renderiza summary, trackers y grupo sin-tracker', async ({ page }) => {
    await seedAuth(page);
    const handle = await mockApi(page);
    await page.goto(INDEX_URL);

    // Summary de 4 celdas agregado client-side
    const summary = page.getByTestId('index-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('2'); // nº trackers
    await expect(summary).toContainText('$162,345.67');
    await expect(summary).toContainText('$10,845.67');
    await expect(summary).toContainText('-$250.10');

    // Badge global de frescura
    await expect(page.getByTestId('tracker-asof')).toContainText('Datos al cierre de');

    // Filas: badges de status + sparkline + próximo rebalanceo
    const row1 = page.getByTestId('tracker-row-st-1');
    await expect(row1).toContainText('Momentum Global');
    await expect(row1.getByTestId('tracker-status-badge')).toHaveText('Activo');
    await expect(row1.getByTestId('tracker-sparkline')).toBeVisible();
    await expect(row1).toContainText('Jul 15, 2026');
    await expect(row1).toContainText('+12.3%');

    const row2 = page.getByTestId('tracker-row-st-2');
    await expect(row2.getByTestId('tracker-status-badge')).toHaveText('Error');
    await expect(row2.locator('td.neg')).toHaveCount(1); // P&L total en rojo

    // Grupo sin tracker con CTA
    const untracked = page.getByTestId('untracked-group');
    await expect(untracked).toContainText('Dividendos LATAM');
    await expect(untracked).toContainText('Small Caps');
    await expect(
      untracked.getByRole('button', { name: 'Activar tracker' }),
    ).toHaveCount(2);

    // Una sola llamada (x2 por StrictMode en dev)
    expect(handle.trackers).toBeLessThanOrEqual(2);
  });

  test('click en una fila navega al detalle por strategy_id', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto(INDEX_URL);

    await page.getByTestId('tracker-row-st-1').click();

    await expect(page).toHaveURL(/\/dashboard\/strategy\/st-1$/);
    await expect(page.getByTestId('tracker-header')).toBeVisible();
  });

  test('CTA "Activar tracker" lleva al flujo de activación de esa estrategia', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto(INDEX_URL);

    await page
      .getByTestId('untracked-group')
      .getByRole('button', { name: 'Activar tracker' })
      .first()
      .click();

    await expect(page).toHaveURL(/\/dashboard\/strategy\/st-3$/);
    await expect(page.getByTestId('activation-flow')).toBeVisible();
  });

  test('estados: error con Reintentar y empty', async ({ page }) => {
    await seedAuth(page);
    const handle = await mockApi(page, { failInitially: true });
    await page.goto(INDEX_URL);

    const errorBox = page.getByTestId('index-error');
    await expect(errorBox).toBeVisible();

    // El backend "se recupera" y el usuario reintenta
    handle.fail = false;
    await errorBox.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.getByTestId('index-summary')).toBeVisible();
  });

  test('empty state cuando no hay estrategias', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, { list: { items: [], data_as_of: null } });
    await page.goto(INDEX_URL);

    await expect(page.getByTestId('index-empty')).toBeVisible();
    await expect(page.getByTestId('index-empty')).toContainText('Aún no tienes estrategias');
  });

  test('móvil: cards en lugar de tabla', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    await seedAuth(page);
    await mockApi(page);
    await page.goto(INDEX_URL);

    await expect(page.getByTestId('trackers-cards')).toBeVisible();
    await expect(page.getByTestId('trackers-table')).not.toBeVisible();
    await expect(page.getByTestId('trackers-cards')).toContainText('Momentum Global');
  });
});
