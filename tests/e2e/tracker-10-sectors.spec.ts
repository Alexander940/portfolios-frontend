import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #10 — sector composition: current book vs strategy target.
 *
 * Current weights are computed client-side from positions (+ cash del
 * tracker); target comes from holdings.sector_breakdown (+ cash_pct 0-1).
 * Both datasets are already loaded by sibling sections — the panel must not
 * fire extra API calls.
 */

const STRATEGY_ID = '33333333-3333-3333-3333-333333333333';
const PORTFOLIO_ID = '66666666-6666-6666-6666-666666666666';

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
  portfolio_id: PORTFOLIO_ID,
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
  cash: '1000.00',
};

// Libro: Tech 75.000 (75%), Consumer Cyclical 20.000 (20%),
// null-sector 4.000 (4% → Unclassified), cash 1.000 (1%). Total 100.000.
function position(overrides: Record<string, unknown>) {
  return {
    symbol_id: 'x',
    ticker: 'XXX',
    name: 'X Corp',
    sector: 'Technology',
    country: 'US',
    quantity: '1',
    average_cost: '1.00',
    weight_pct: '0',
    entry_date: '2026-01-02',
    entry_rating: 1,
    current_price: '1.00',
    current_value: '0',
    unrealized_pnl: '0',
    unrealized_pnl_pct: '0',
    current_rating: 1,
    rating_changed: false,
    price_source: 'nightly_close',
    ...overrides,
  };
}

const POSITIONS = {
  items: [
    position({ symbol_id: 's1', ticker: 'AAPL', current_value: '40000' }),
    position({ symbol_id: 's2', ticker: 'MSFT', current_value: '35000' }),
    position({
      symbol_id: 's3',
      ticker: 'TSLA',
      sector: 'Consumer Cyclical',
      current_value: '20000',
    }),
    position({ symbol_id: 's4', ticker: 'NULLCO', sector: null, current_value: '4000' }),
  ],
  total: 4,
  limit: 200,
  offset: 0,
  quoted_at: null,
  warnings: [],
};

const HOLDINGS = {
  data_as_of: '2026-07-08',
  warnings: [],
  holdings: [],
  cash_pct: '0.05',
  sector_breakdown: [
    { sector: 'Technology', weight_pct: '70', holdings_count: 2 },
    { sector: 'Consumer Cyclical', weight_pct: '25', holdings_count: 1 },
  ],
};

const EMPTY_CURVE = {
  portfolio_id: PORTFOLIO_ID,
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

async function mockApi(page: Page): Promise<{ positions: number; holdings: number }> {
  const counters = { positions: 0, holdings: 0 };

  await page.route('**/portfolios/*/positions*', async (route) => {
    counters.positions += 1;
    await route.fulfill({ json: POSITIONS });
  });
  await page.route('**/portfolios/*/performance/curve*', (route) =>
    route.fulfill({ json: EMPTY_CURVE }),
  );
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/tracker') && route.request().method() === 'GET') {
      await route.fulfill({ json: TRACKER });
      return;
    }
    if (url.pathname.endsWith('/tracker/drift')) {
      await route.fulfill({
        json: { entries: [], exits: [], weight_drift: [], warnings: [] },
      });
      return;
    }
    if (url.pathname.endsWith('/holdings')) {
      counters.holdings += 1;
      await route.fulfill({ json: HOLDINGS });
      return;
    }
    await route.fulfill({ status: 404, json: { detail: 'Not mocked' } });
  });

  return counters;
}

const DETAIL_URL = `/dashboard/strategy/${STRATEGY_ID}`;

test.describe('Composición sectorial (#10)', () => {
  test('barras actual vs tick target por sector, con Unclassified y Cash', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto(DETAIL_URL);

    const panel = page.getByTestId('sector-composition');
    await expect(panel).toBeVisible();

    // Technology: actual 75.0% (computado client-side) / target 70.0%
    const tech = page.getByTestId('sector-row-Technology');
    await expect(tech).toContainText('75.0%');
    await expect(tech).toContainText('70.0%');
    await expect(tech.locator('.trk-sector-tick')).toHaveAttribute(
      'title',
      'Target: 70.0%',
    );

    // Consumer Cyclical: 20.0% / 25.0%
    const cc = page.getByTestId('sector-row-Consumer Cyclical');
    await expect(cc).toContainText('20.0%');
    await expect(cc).toContainText('25.0%');

    // Unclassified (sector null): 4.0% actual, sin target
    const uncl = page.getByTestId('sector-row-Unclassified');
    await expect(uncl).toContainText('4.0%');
    await expect(uncl).toContainText('—');

    // Cash: 1.0% actual / 5.0% target (cash_pct 0.05 → %)
    const cash = page.getByTestId('sector-row-Cash');
    await expect(cash).toContainText('1.0%');
    await expect(cash).toContainText('5.0%');

    // Leyenda
    await expect(panel).toContainText('Peso actual');
    await expect(panel).toContainText('Target (base/tilt)');
  });

  test('sin llamadas API adicionales: reutiliza positions y holdings ya cargados', async ({
    page,
  }) => {
    await seedAuth(page);
    const counters = await mockApi(page);
    await page.goto(DETAIL_URL);

    await expect(page.getByTestId('sector-composition')).toBeVisible();
    await expect(page.getByTestId('sector-row-Technology')).toBeVisible();

    // React StrictMode duplica el load inicial en dev; lo que importa es que
    // el panel sectorial no añade requests propios sobre los del load.
    const positionsAfterRender = counters.positions;
    const holdingsAfterRender = counters.holdings;
    expect(positionsAfterRender).toBeLessThanOrEqual(2);
    expect(holdingsAfterRender).toBeLessThanOrEqual(2);

    // Esperar un poco y verificar que no siguen creciendo
    await page.waitForTimeout(1000);
    expect(counters.positions).toBe(positionsAfterRender);
    expect(counters.holdings).toBe(holdingsAfterRender);
  });
});
