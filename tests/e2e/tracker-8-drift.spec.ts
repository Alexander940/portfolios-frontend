import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #8 — drift panel: entries / exits / weight drift + footer.
 * API route-mocked with the contract from the issue.
 */

const STRATEGY_ID = '33333333-3333-3333-3333-333333333333';

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

const TRACKER = {
  tracker_id: '44444444-4444-4444-4444-444444444444',
  strategy_id: STRATEGY_ID,
  strategy_version_id: '55555555-5555-5555-5555-555555555555',
  portfolio_id: '66666666-6666-6666-6666-666666666666',
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

const DRIFT = {
  as_of: '2026-07-09',
  data_as_of: '2026-07-08',
  next_rebalance_date: '2026-07-15',
  coverage_pct: '0.93',
  total_value: '112345.67',
  cash: '512.34',
  entries: [
    {
      symbol_id: 'e1',
      ticker: 'NVDA',
      sector: 'Technology',
      score: '2.00',
      target_weight_pct: '5.0',
    },
    {
      symbol_id: 'e2',
      ticker: 'AMD',
      sector: 'Technology',
      score: '1.50',
      target_weight_pct: '3.2',
    },
  ],
  exits: [
    {
      symbol_id: 'x1',
      ticker: 'INTC',
      shares: '120',
      current_weight_pct: '2.8',
      stale: true,
    },
  ],
  weight_drift: [
    {
      symbol_id: 'w1',
      ticker: 'AAPL',
      current_weight_pct: '42.6',
      target_weight_pct: '40.1',
      delta_pct: '2.5',
    },
    {
      symbol_id: 'w2',
      ticker: 'MSFT',
      current_weight_pct: '33.2',
      target_weight_pct: '35.0',
      delta_pct: '-1.8',
    },
    {
      symbol_id: 'w3',
      ticker: 'TSLA',
      current_weight_pct: '25.6',
      target_weight_pct: '24.9',
      delta_pct: '0.7',
    },
  ],
  warnings: ['3 tickers sin precio de cierre reciente'],
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

async function mockApi(page: Page, drift: Record<string, unknown> = DRIFT): Promise<void> {
  await page.route('**/portfolios/*/positions*', (route) =>
    route.fulfill({ json: { items: [], total: 0, limit: 200, offset: 0 } }),
  );
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/tracker/drift')) {
      await route.fulfill({ json: drift });
      return;
    }
    if (url.pathname.endsWith('/tracker') && route.request().method() === 'GET') {
      await route.fulfill({ json: TRACKER });
      return;
    }
    if (url.pathname.endsWith('/holdings')) {
      await route.fulfill({ json: { data_as_of: '2026-07-08', warnings: [], holdings: [] } });
      return;
    }
    await route.fulfill({ status: 404, json: { detail: 'Not mocked' } });
  });
}

const DETAIL_URL = `/dashboard/strategy/${STRATEGY_ID}`;

test.describe('Panel de drift (#8)', () => {
  test('3 cajas: entradas con score, salidas con flag deslistada, footer con contexto', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto(DETAIL_URL);

    const entries = page.getByTestId('drift-entries');
    await expect(entries).toBeVisible();
    await expect(entries).toContainText('NVDA');
    await expect(entries).toContainText('2.00'); // score = valor de sort_by, no 0-100
    await expect(entries).toContainText('5.0%');

    const exits = page.getByTestId('drift-exits');
    await expect(exits).toContainText('INTC');
    await expect(exits).toContainText('posible deslistada');
    // Razón genérica hasta backend#52
    await expect(exits).toContainText('Dejó de pasar los filtros o cayó del top-N');

    const footer = page.getByTestId('drift-footer');
    await expect(footer).toContainText('Jul 15, 2026');
    await expect(footer).toContainText('93.0%'); // coverage_pct 0.93 → %
    await expect(footer).toContainText('3 tickers sin precio de cierre reciente');
  });

  test('barra bidireccional: over a la derecha, under a la izquierda, proporcional al máximo', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto(DETAIL_URL);

    const weights = page.getByTestId('drift-weights');
    await expect(weights).toBeVisible();

    // Orden por |delta| tal como llega del API: AAPL, MSFT, TSLA
    const rows = weights.locator('[data-testid^="drift-bar-"]');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('AAPL');
    await expect(rows.nth(1)).toContainText('MSFT');

    // AAPL over (delta +2.5, el máximo → 100% del half-track)
    const aaplBar = page.getByTestId('drift-bar-AAPL').locator('.trk-drift-bar');
    await expect(aaplBar).toHaveClass(/over/);
    await expect(aaplBar).toHaveAttribute('style', /width: 100%/);
    await expect(page.getByTestId('drift-bar-AAPL')).toContainText('+2.5%');

    // MSFT under (delta -1.8 → 72% del half-track izquierdo)
    const msftBar = page.getByTestId('drift-bar-MSFT').locator('.trk-drift-bar');
    await expect(msftBar).toHaveClass(/under/);
    await expect(msftBar).toHaveAttribute('style', /width: 72%/);
    await expect(page.getByTestId('drift-bar-MSFT')).toContainText('-1.8%');
  });

  test('empty state cuando no hay entradas, salidas ni desvíos', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, { ...DRIFT, entries: [], exits: [], weight_drift: [], warnings: [] });
    await page.goto(DETAIL_URL);

    await expect(page.getByTestId('drift-empty')).toBeVisible();
    await expect(page.getByTestId('drift-empty')).toContainText(
      'Tu libro coincide con el target',
    );
  });

  test('móvil: tabs conmutan las cajas', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    await seedAuth(page);
    await mockApi(page);
    await page.goto(DETAIL_URL);

    // En móvil solo la caja activa es visible
    await expect(page.getByTestId('drift-entries')).toBeVisible();
    await expect(page.getByTestId('drift-exits')).not.toBeVisible();

    await page.getByRole('tab', { name: 'Saldrían' }).click();
    await expect(page.getByTestId('drift-exits')).toBeVisible();
    await expect(page.getByTestId('drift-entries')).not.toBeVisible();

    await page.getByRole('tab', { name: 'Desvío' }).click();
    await expect(page.getByTestId('drift-weights')).toBeVisible();
  });
});
