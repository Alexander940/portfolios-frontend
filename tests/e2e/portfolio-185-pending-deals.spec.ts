import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #185 (épica #175) — pending M&A deals in the frontend.
 *
 * Route-mocked, so it needs no backend. Three things are covered:
 *  1. Portfolio holdings: the "En adquisición" badge shows on the position that
 *     carries a `deal` and on NO other row (a deal-free portfolio is untouched).
 *  2. Events feed: the new "Deals" chip asks the API for `type=deals` and the
 *     deal rows render with the acquirer.
 *  3. Screener: the "Excluir en adquisición" toggle is ON by default (sends
 *     `exclude_pending_deals: true`), turning it off sends `false`, writes it to
 *     the URL, and survives a reload.
 */

const PORTFOLIO_ID = '11111111-1111-1111-1111-111111111111';

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
  portfolio_id: PORTFOLIO_ID,
  user_id: USER.user_id,
  name: 'E2E Deals Portfolio',
  description: null,
  portfolio_type: 'model',
  currency: 'USD',
  initial_cash: 10000,
  is_default: false,
  is_public: false,
  weighting_method: 'equal',
  screener_filters: null,
  last_rebalance_date: null,
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

const DEAL = {
  status: 'pending',
  acquirer: 'Globex Corporation',
  payment_type: 'cash',
  deal_price: 92.5,
  exchange_ratio: null,
  announced_date: '2026-07-15',
  expected_close_date: '2026-12-31',
  closed_date: null,
  // Percent, NOT a fraction — the UI must print 3.42%, never 342%.
  spread_pct: 3.42,
};

function position(overrides: Record<string, unknown>) {
  return {
    position_id: 'p-x',
    symbol_id: 's-x',
    ticker: 'XXX',
    name: 'X Corp',
    sector: 'Technology',
    country: 'US',
    quantity: 10,
    average_cost: 80,
    weight_pct: 50,
    entry_date: '2026-01-02',
    entry_rating: 2,
    current_price: 90,
    current_value: 900,
    unrealized_pnl: 100,
    unrealized_pnl_pct: 12.5,
    current_rating: 2,
    rating_changed: false,
    deal: null,
    ...overrides,
  };
}

const POSITIONS = {
  items: [
    position({
      position_id: 'p-1',
      symbol_id: 's-1',
      ticker: 'ACME',
      name: 'Acme Industries',
      deal: DEAL,
    }),
    position({
      position_id: 'p-2',
      symbol_id: 's-2',
      ticker: 'FREE',
      name: 'Free Standing Inc.',
      deal: null,
    }),
  ],
  total: 2,
  limit: 25,
  offset: 0,
};

const DEAL_EVENT = {
  event_type: 'deal',
  ticker: 'ACME',
  name: 'Acme Industries',
  sector: 'Technology',
  portfolio_id: PORTFOLIO_ID,
  portfolio_name: PORTFOLIO.name,
  previous_rating: null,
  current_rating: null,
  rating_delta: null,
  move_pct: null,
  as_of: '2026-07-15',
  held_in_portfolios: 1,
  deal: DEAL,
};

function stock(overrides: Record<string, unknown>) {
  return {
    symbol_id: 'sc-x',
    ticker: 'XXX',
    name: 'X Corp',
    country: 'US',
    exchange: 'NASDAQ',
    sector: 'Technology',
    rating: 2,
    smart_momentum: null,
    trend_strength: null,
    retracement: null,
    new_high_low: null,
    days_since_rating: null,
    pe_ratio: 20,
    return_1m: 1,
    return_3m: 2,
    return_12m: 3,
    dividend_yield: null,
    liquidity_usd_m: 10,
    pending_deal: null,
    deal_status: null,
    deal_acquirer: null,
    deal_payment_type: null,
    deal_price: null,
    deal_exchange_ratio: null,
    deal_announced_date: null,
    ...overrides,
  };
}

const SCREENER_RESULTS = {
  results: [stock({ symbol_id: 'sc-1', ticker: 'FREE', name: 'Free Standing Inc.' })],
  total_count: 1,
  limit: 50,
  offset: 0,
};

interface EventCall {
  type: string | null;
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

/** Portfolio detail page: header, positions, curve, summary, events. */
async function mockPortfolioApi(page: Page): Promise<EventCall[]> {
  const eventCalls: EventCall[] = [];

  await page.route('**/portfolios/events*', async (route) => {
    const url = new URL(route.request().url());
    const type = url.searchParams.get('type');
    eventCalls.push({ type });
    const items = type === 'deals' || type === 'all' ? [DEAL_EVENT] : [];
    await route.fulfill({
      json: { items, total: items.length, limit: 50, offset: 0 },
    });
  });

  await page.route('**/portfolios/*/positions*', (route) =>
    route.fulfill({ json: POSITIONS }),
  );
  await page.route('**/portfolios/*/performance/curve*', (route) =>
    route.fulfill({
      json: {
        portfolio_id: PORTFOLIO_ID,
        benchmark: 'SPY',
        return_basis: 'total_return',
        base_mode: 'index_100',
        base: 100,
        benchmark_available: false,
        start_date: null,
        end_date: null,
        points: [],
      },
    }),
  );
  await page.route(`**/portfolios/${PORTFOLIO_ID}`, (route) =>
    route.fulfill({ json: PORTFOLIO }),
  );

  return eventCalls;
}

/** Screener page: options, presets, and the POST whose body we inspect. */
async function mockScreenerApi(page: Page): Promise<Record<string, unknown>[]> {
  const bodies: Record<string, unknown>[] = [];

  await page.route('**/screener/options', (route) =>
    route.fulfill({
      json: { countries: ['US'], exchanges: ['NASDAQ'], sectors: ['Technology'] },
    }),
  );
  await page.route('**/screener/presets/*', (route) =>
    route.fulfill({ json: { items: [], total: 0, limit: 50, offset: 0 } }),
  );
  await page.route('**/screener/', async (route) => {
    if (route.request().method() === 'POST') {
      bodies.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ json: SCREENER_RESULTS });
      return;
    }
    await route.fallback();
  });

  return bodies;
}

test.describe('Pending M&A deals (#185)', () => {
  // Vite's first-navigation dependency optimization can be slow on cold caches.
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test('holdings: only the position with a deal gets the badge', async ({ page }) => {
    await mockPortfolioApi(page);
    await page.goto(`/dashboard/analysis/${PORTFOLIO_ID}`, {
      waitUntil: 'domcontentloaded',
    });

    await page.getByRole('tab', { name: 'Holdings' }).click();

    const table = page.locator('table.tbl');
    await expect(table).toBeVisible({ timeout: 60_000 });

    // Exactly one badge — the deal-free row must look like it always did.
    const badges = page.getByTestId('deal-badge');
    await expect(badges).toHaveCount(1);

    const badge = badges.first();
    await expect(badge).toHaveText('En adquisición');
    await expect(badge).toHaveAttribute('data-deal-status', 'pending');

    // Tooltip carries acquirer, payment, price, dates and the spread. The
    // spread arrives in PERCENT units and must not be re-scaled.
    const tooltip = await badge.getAttribute('title');
    expect(tooltip).toContain('Globex Corporation');
    expect(tooltip).toContain('efectivo');
    expect(tooltip).toContain('$92.50');
    expect(tooltip).toContain('Spread: +3.42%');

    // The badge sits on the ACME row, not on the deal-free one.
    const acmeRow = table.locator('tbody tr', { hasText: 'ACME' });
    await expect(acmeRow.getByTestId('deal-badge')).toHaveCount(1);
    const freeRow = table.locator('tbody tr', { hasText: 'Free Standing' });
    await expect(freeRow.getByTestId('deal-badge')).toHaveCount(0);
  });

  test('events feed: the Deals chip asks for type=deals and renders the row', async ({
    page,
  }) => {
    const eventCalls = await mockPortfolioApi(page);
    await page.goto(`/dashboard/analysis/${PORTFOLIO_ID}`, {
      waitUntil: 'domcontentloaded',
    });

    await page.getByRole('tab', { name: 'Events' }).click();
    await page.getByRole('button', { name: 'Deals', exact: true }).click();

    await expect
      .poll(() => eventCalls.map((c) => c.type), { timeout: 30_000 })
      .toContain('deals');

    const row = page.getByTestId('deal-event-ACME');
    await expect(row).toBeVisible();
    await expect(row).toContainText('Globex Corporation');
    await expect(row.getByTestId('deal-badge')).toBeVisible();
  });

  test('screener: exclusion is on by default, and turning it off persists', async ({
    page,
  }) => {
    const bodies = await mockScreenerApi(page);
    await page.goto('/dashboard/screening', { waitUntil: 'domcontentloaded' });

    const toggle = page.getByTestId('exclude-pending-deals-toggle');
    await expect(toggle).toBeVisible({ timeout: 60_000 });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // Default request excludes deals without the user touching anything.
    await expect
      .poll(() => bodies.map((b) => b.exclude_pending_deals), { timeout: 30_000 })
      .toContain(true);

    // The default value is NOT written to the URL (a plain screener link is
    // unchanged); only the explicit "off" is.
    expect(new URL(page.url()).searchParams.get('exclude_pending_deals')).toBeNull();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    await expect
      .poll(() => bodies.map((b) => b.exclude_pending_deals), { timeout: 30_000 })
      .toContain(false);
    await expect
      .poll(() => new URL(page.url()).searchParams.get('exclude_pending_deals'), {
        timeout: 30_000,
      })
      .toBe('false');

    // A refresh must not silently re-enable it (the key has to be in the
    // store's hardcoded booleanFilterKeys list for this to hold).
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('exclude-pending-deals-toggle')).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('screener: a result with no deal renders no badge', async ({ page }) => {
    await mockScreenerApi(page);
    await page.goto('/dashboard/screening', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Free Standing Inc.')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('deal-badge')).toHaveCount(0);
  });
});
