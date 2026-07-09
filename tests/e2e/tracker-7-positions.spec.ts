import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #7 — positions table + intraday mark mode.
 *
 * API route-mocked. `?mark=live` re-marks per position (price_source) and
 * never persists; "Volver al cierre" refetches without the param.
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
  cash: '512.34',
};

function makePosition(overrides: Record<string, unknown>) {
  return {
    symbol_id: 'x',
    ticker: 'XXX',
    name: 'X Corp',
    sector: 'Technology',
    country: 'US',
    quantity: '10',
    average_cost: '100.00',
    weight_pct: '10',
    entry_date: '2026-01-02',
    entry_rating: 1,
    current_price: '100.00',
    current_value: '1000.00',
    unrealized_pnl: '0',
    unrealized_pnl_pct: '0',
    current_rating: 1,
    rating_changed: false,
    price_source: 'nightly_close',
    ...overrides,
  };
}

const POSITIONS_CLOSE = {
  items: [
    makePosition({
      symbol_id: 's1',
      ticker: 'AAPL',
      name: 'Apple Inc.',
      quantity: '200',
      average_cost: '180.00',
      weight_pct: '40.1',
      entry_rating: 2,
      current_price: '200.00',
      current_value: '40000.00',
      unrealized_pnl: '4000.00',
      unrealized_pnl_pct: '11.11',
      current_rating: 3,
      rating_changed: true,
    }),
    makePosition({
      symbol_id: 's2',
      ticker: 'MSFT',
      name: 'Microsoft Corp.',
      quantity: '70',
      average_cost: '480.00',
      weight_pct: '35.0',
      entry_rating: 3,
      current_price: '500.00',
      current_value: '35000.00',
      unrealized_pnl: '1400.00',
      unrealized_pnl_pct: '4.17',
      current_rating: 3,
    }),
    makePosition({
      symbol_id: 's3',
      ticker: 'TSLA',
      name: 'Tesla Inc.',
      sector: 'Consumer Cyclical',
      quantity: '83',
      average_cost: '320.00',
      weight_pct: '24.9',
      entry_rating: 1,
      current_price: '300.00',
      current_value: '24900.00',
      unrealized_pnl: '-1660.00',
      unrealized_pnl_pct: '-6.25',
      current_rating: -1,
      rating_changed: true,
    }),
  ],
  total: 3,
  limit: 200,
  offset: 0,
  quoted_at: null,
  warnings: [],
};

const POSITIONS_LIVE = {
  ...POSITIONS_CLOSE,
  items: POSITIONS_CLOSE.items.map((p) =>
    p.ticker === 'TSLA'
      ? { ...p, price_source: 'nightly_close' }
      : { ...p, price_source: 'fmp_intraday' },
  ),
  quoted_at: '2026-07-09T15:30:00Z',
  warnings: ['TSLA: no intraday quote'],
};

const POSITIONS_LIVE_UNAVAILABLE = {
  ...POSITIONS_CLOSE,
  quoted_at: '2026-07-09T15:30:00Z',
  warnings: ['intraday quotes unavailable'],
};

interface RecordedCall {
  method: string;
  path: string;
  mark: string | null;
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

async function mockApi(
  page: Page,
  livePayload: Record<string, unknown> = POSITIONS_LIVE,
): Promise<RecordedCall[]> {
  const calls: RecordedCall[] = [];

  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
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

  await page.route('**/portfolios/*/positions*', async (route) => {
    const url = new URL(route.request().url());
    const mark = url.searchParams.get('mark');
    calls.push({ method: route.request().method(), path: url.pathname, mark });
    await route.fulfill({ json: mark === 'live' ? livePayload : POSITIONS_CLOSE });
  });

  return calls;
}

const DETAIL_URL = `/dashboard/strategy/${STRATEGY_ID}`;

test.describe('Posiciones + modo intradía (#7)', () => {
  test('tabla con orden por peso, fila CASH, P&L con signo y transición de rating', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto(DETAIL_URL);

    const table = page.getByTestId('positions-table');
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr')).toHaveCount(4); // 3 + CASH

    // Orden default: peso desc → AAPL primero
    await expect(table.locator('tbody tr').first()).toContainText('AAPL');

    // Fila CASH con el cash del TrackerResponse
    await expect(page.getByTestId('positions-cash-row')).toContainText('$512.34');

    // P&L con signo
    await expect(page.getByTestId('position-row-TSLA')).toContainText('-$1,660.00');
    await expect(page.getByTestId('position-row-TSLA')).toContainText('-6.25%');
    await expect(page.getByTestId('position-row-AAPL')).toContainText('+11.11%');

    // Rating entrada→actual: AAPL upgrade (2→3), TSLA downgrade (1→-1).
    // Scoped a la tabla: las cards móviles duplican los testids en el DOM.
    const ratingAapl = table.getByTestId('rating-AAPL');
    const ratingTsla = table.getByTestId('rating-TSLA');
    await expect(ratingAapl.locator('[aria-label="upgrade"]')).toBeVisible();
    await expect(ratingTsla.locator('[aria-label="downgrade"]')).toBeVisible();
    await expect(ratingAapl).toContainText('+2');
    await expect(ratingAapl).toContainText('+3');
    await expect(ratingTsla).toContainText('-1');
  });

  test('orden client-side por columna con toggle asc/desc', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto(DETAIL_URL);

    const table = page.getByTestId('positions-table');
    await expect(table).toBeVisible();

    // Click en Ticker → desc: TSLA primero
    await page.getByRole('columnheader', { name: /^Ticker/ }).click();
    await expect(table.locator('tbody tr').first()).toContainText('TSLA');

    // Segundo click → asc: AAPL primero
    await page.getByRole('columnheader', { name: /^Ticker/ }).click();
    await expect(table.locator('tbody tr').first()).toContainText('AAPL');
  });

  test('toggle intradía: mark=live, banner, tags por fila y volver al cierre', async ({
    page,
  }) => {
    await seedAuth(page);
    const calls = await mockApi(page);
    await page.goto(DETAIL_URL);
    await expect(page.getByTestId('positions-table')).toBeVisible();

    await page.getByRole('button', { name: 'Precios intradía' }).click();

    await expect(page.getByTestId('banner-intraday')).toBeVisible();
    await expect(
      page.getByTestId('position-row-AAPL').locator('.trk-tag.live'),
    ).toHaveText('intradía');
    await expect(
      page.getByTestId('position-row-TSLA').locator('.trk-tag.noquote'),
    ).toHaveText('sin quote');
    await expect(page.getByTestId('positions-section')).toContainText('quotes de');

    const liveCall = calls.find((c) => c.mark === 'live');
    expect(liveCall).toBeTruthy();

    // Volver al cierre → re-fetch sin mark, banner y tags desaparecen
    await page.getByRole('button', { name: 'Volver al cierre' }).click();
    await expect(page.getByTestId('banner-intraday')).not.toBeVisible();
    await expect(page.getByTestId('position-row-AAPL').locator('.trk-tag')).toHaveCount(0);
    const closeCalls = calls.filter((c) => c.mark === null);
    expect(closeCalls.length).toBeGreaterThan(1); // carga inicial + vuelta al cierre
  });

  test('degradación: intraday unavailable → todas las filas sin quote, UI intacta', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockApi(page, POSITIONS_LIVE_UNAVAILABLE);
    await page.goto(DETAIL_URL);
    await expect(page.getByTestId('positions-table')).toBeVisible();

    await page.getByRole('button', { name: 'Precios intradía' }).click();
    await expect(page.getByTestId('banner-intraday')).toBeVisible();

    // Ninguna fila con tag intradía; todas quedan nightly_close ("sin quote")
    await expect(page.locator('.trk-tag.live')).toHaveCount(0);
    await expect(
      page.getByTestId('positions-table').locator('.trk-tag.noquote'),
    ).toHaveCount(3);
    await expect(page.getByTestId('positions-table').locator('tbody tr')).toHaveCount(4);
  });
});
