import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for the portfolio-vs-S&P500 performance chart.
 *
 * The chart endpoint (and the auth + portfolio detail endpoints it depends on)
 * are route-mocked, so this is deterministic and needs no backend. We seed an
 * authenticated session via localStorage, then assert both series render.
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
  name: 'E2E Curve Portfolio',
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

const CURVE = {
  portfolio_id: PORTFOLIO_ID,
  benchmark: 'SPY',
  return_basis: 'total_return',
  base_mode: 'index_100',
  base: 100,
  benchmark_available: true,
  start_date: '2026-01-02',
  end_date: '2026-01-03',
  points: [
    {
      date: '2026-01-02',
      portfolio_value: 100,
      portfolio_return_pct: 0,
      benchmark_value: 100,
      benchmark_return_pct: 0,
      relative_return_pct: 0,
    },
    {
      date: '2026-01-03',
      portfolio_value: 110,
      portfolio_return_pct: 10,
      benchmark_value: 102,
      benchmark_return_pct: 2,
      relative_return_pct: 8,
    },
  ],
};

async function seedAuthAndRoutes(page: Page): Promise<void> {
  // Seed an authenticated session before the app boots.
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

  await page.route('**/auth/me', (route) =>
    route.fulfill({ json: USER }),
  );
  await page.route('**/portfolios/*/performance/curve*', (route) =>
    route.fulfill({ json: CURVE }),
  );
  await page.route('**/portfolios/*/positions*', (route) =>
    route.fulfill({ json: { items: [], total: 0, limit: 25, offset: 0 } }),
  );
  await page.route(`**/portfolios/${PORTFOLIO_ID}`, (route) =>
    route.fulfill({ json: PORTFOLIO }),
  );
}

test.describe('Portfolio performance curve', () => {
  // Vite's first-navigation dependency optimization can be slow on cold caches.
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await seedAuthAndRoutes(page);
  });

  test('renders portfolio and S&P 500 series on the detail page', async ({ page }) => {
    await page.goto(`/dashboard/analysis/${PORTFOLIO_ID}`, {
      waitUntil: 'domcontentloaded',
    });

    const chart = page.getByTestId('portfolio-performance-chart');
    await expect(chart).toBeVisible({ timeout: 60_000 });
    await expect(chart.getByText('Performance vs S&P 500')).toBeVisible();

    // Main chart SVG (role=application) + both line series rendered.
    await expect(chart.getByRole('application')).toBeVisible({ timeout: 30_000 });
    await expect(chart.locator('.recharts-line')).toHaveCount(2);

    // Legend names both series.
    await expect(chart.getByText('Portfolio', { exact: true })).toBeVisible();
    await expect(chart.getByText('S&P 500', { exact: true })).toBeVisible();
  });

  test('base-mode toggle refetches and keeps the chart rendered', async ({ page }) => {
    await page.goto(`/dashboard/analysis/${PORTFOLIO_ID}`, {
      waitUntil: 'domcontentloaded',
    });

    const chart = page.getByTestId('portfolio-performance-chart');
    await expect(chart.getByRole('application')).toBeVisible({ timeout: 60_000 });

    await chart.getByRole('button', { name: 'Capital inicial' }).click();

    await expect(chart.getByRole('application')).toBeVisible();
    await expect(chart.locator('.recharts-line')).toHaveCount(2);
  });
});
