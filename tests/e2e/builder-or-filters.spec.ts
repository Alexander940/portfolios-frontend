import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * E2E for issue #173 — grouping Additional/Selection rules with OR in the
 * Strategy Builder. API route-mocked (harness pattern: builder-158-rebalance-
 * section.spec.ts for auth/mock-routes, builder-13-min-weight.spec.ts for the
 * resolve-universe stub + the "new strategy" flow).
 *
 * NOT RUN in this environment (Playwright's browser cannot launch in this
 * WSL — `browserType.launch: Target page, context or browser has been
 * closed`); the executable guard for this phase is
 * `tests/checks/or-filters-roundtrip.ts`. This spec is the written contract
 * for CI / a machine that can launch a browser.
 *
 * The LEGACY case is the FIRST test — same risk ordering as #158: all 21
 * strategies saved in production predate `any_of` entirely, so opening one
 * and re-saving it must not gain the key or otherwise disturb its spec.
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

const RESOLVE_UNIVERSE = {
  as_of: '2026-08-26',
  alpha_window: '12m',
  alpha_metric: 'return',
  alpha_pit_safe: true,
  base_method: 'universe_marketcap',
  total_market_cap: 0,
  eligible_count: 0,
  coverage_pct: 1,
  sectors: [],
};

const BASE_SPEC = {
  general: { instrument_type: 'stocks', currency: 'USD', benchmark: 'SPY', performance_metric: 'total_return' },
  entry_exit: {
    mode: 'trade_state', min_er: 0.3, max_sm_atr_mult: 10, atr_spike_mult: 2,
    trail_atr_mult: 3, emergency_atr_mult: 4, exit_rating_long: -1, exit_rating_short: 1,
    use_trail_stop: false,
  },
  selection: { sort_by: 'rating', sort_order: 'desc', top_n: 25 },
  weighting: { method: 'equal' },
  costs: { commission_bps: 5, slippage_bps: 8 },
  validation: { start: '2024-01-02', end: '2024-06-28', oos_split: 0.2, min_n_trades: 30 },
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

interface RecordedCall {
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

/** Mocks the builder API. `GET /strategies/` answers with `rows`; PUT/POST are
 *  recorded so a test can assert on the spec that was actually sent. */
async function mockApi(page: Page, rows: Record<string, unknown>[]): Promise<RecordedCall[]> {
  const calls: RecordedCall[] = [];

  await page.route('**/templates/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/templates/', (route) => route.fulfill({ json: [] }));
  await page.route('**/backtests/*', (route) => route.fulfill({ json: DONE_RESULT }));
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname.endsWith('/resolve-universe')) {
      await route.fulfill({ json: RESOLVE_UNIVERSE });
      return;
    }
    if (method === 'POST' && url.pathname.endsWith('/backtest')) {
      calls.push({ method, path: url.pathname, body: null });
      await route.fulfill({ json: { job_id: 'j1', status: 'done', cached: false } });
      return;
    }
    if (method === 'PUT') {
      calls.push({ method, path: url.pathname, body: route.request().postDataJSON() });
      await route.fulfill({
        json: {
          strategy_id: url.pathname.split('/').filter(Boolean).pop(),
          version: 2,
          content_hash: 'beef'.repeat(16),
          spec_changed: true,
        },
      });
      return;
    }
    if (method === 'POST') {
      calls.push({ method, path: url.pathname, body: route.request().postDataJSON() });
      await route.fulfill({
        status: 201,
        json: { strategy_id: 'new-1', version: 1, content_hash: 'dead'.repeat(16) },
      });
      return;
    }
    await route.fulfill({ json: rows });
  });

  return calls;
}

function strategyRow(sid: string, name: string, universe: Record<string, unknown>) {
  return {
    strategy_id: sid,
    name,
    description: null,
    latest_version: 1,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-02T00:00:00Z',
    spec: { ...BASE_SPEC, universe: { country: ['US'], ...universe } },
    template_slug: null,
    template_version: null,
  };
}

async function openNewStrategyForm(page: Page, name: string): Promise<void> {
  await page.goto('/dashboard/builder');
  await page.getByRole('button', { name: 'New strategy' }).first().click();
  await page.getByPlaceholder('Strategy name').fill(name);
}

const additionalRulesBox = (page: Page): Locator =>
  page.locator('.sb-field', { hasText: 'Additional rules' });
const selectionRulesBox = (page: Page): Locator =>
  page.locator('.sb-section', { hasText: 'Selection rules' });

/** Add one loose range filter via the "+ Add a filter…" picker + modal. */
async function addRangeFilter(page: Page, box: Locator, fieldLabel: string, min: string): Promise<void> {
  await box.locator('.sb-fund-add select').selectOption({ label: fieldLabel });
  await page.getByLabel('Minimum').fill(min);
  await page.getByRole('button', { name: 'Apply' }).click();
}

async function checkForGrouping(box: Locator, fieldLabel: string): Promise<void> {
  await box.getByRole('checkbox', { name: `Select ${fieldLabel} to combine with OR` }).check();
}

test.describe('Builder — grupos OR en Additional/Selection rules (#173)', () => {
  test('caso legado: una estrategia sin any_of carga y se guarda sin ganar la clave', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockApi(page, [
      strategyRow('sid-legacy', 'E2E Legacy No OR', { rating: { min: 1 } }),
    ]);

    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: 'E2E Legacy No OR' }).locator('button[title="Edit"]').click();

    // Loads exactly as before #173: one plain "Rating" chip, no OR group box.
    await expect(additionalRulesBox(page).getByText('Rating', { exact: false })).toBeVisible();
    await expect(page.locator('.sb-or-group')).toHaveCount(0);

    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect(page.getByTestId('sb-results')).toBeVisible();

    const put = calls.find((c) => c.method === 'PUT');
    expect(put).toBeTruthy();
    const universe = (put?.body?.spec as { universe: Record<string, unknown> }).universe;
    expect('any_of' in universe).toBe(false);
    expect(universe.rating).toEqual({ min: 1 });
  });

  test('agrupar 2 reglas sueltas en Additional rules produce any_of en universe', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockApi(page, []);
    await openNewStrategyForm(page, 'E2E Group Additional');

    const box = additionalRulesBox(page);
    await addRangeFilter(page, box, 'Trend Strength', '2');
    await addRangeFilter(page, box, 'Smart Momentum', '5');

    // No group yet: two plain chips, each individually selectable.
    await expect(page.locator('.sb-or-group')).toHaveCount(0);
    await checkForGrouping(box, 'Trend Strength');
    await checkForGrouping(box, 'Smart Momentum');

    await box.getByRole('button', { name: 'Group 2 as OR' }).click();

    const groupBox = box.locator('.sb-or-group');
    await expect(groupBox).toHaveCount(1);
    await expect(groupBox.getByText('OR', { exact: true })).toBeVisible();
    await expect(groupBox.getByText('Trend Strength', { exact: false })).toBeVisible();
    await expect(groupBox.getByText('Smart Momentum', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect(page.getByTestId('sb-results')).toBeVisible();

    const post = calls.find((c) => c.method === 'POST' && c.path.endsWith('/strategies/'));
    expect(post).toBeTruthy();
    const universe = (post?.body?.spec as { universe: Record<string, unknown> }).universe;
    expect('trend_strength' in universe).toBe(false);
    expect('smart_momentum' in universe).toBe(false);
    expect(universe.any_of).toEqual([
      { options: [{ trend_strength: { min: 2 } }, { smart_momentum: { min: 5 } }] },
    ]);
  });

  test('ungroup: deshacer un grupo existente lo vuelve a reglas sueltas y el spec pierde any_of', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockApi(page, [
      strategyRow('sid-grouped', 'E2E Ungroup Me', {
        rating: { min: 1 },
        any_of: [{ options: [{ trend_strength: { min: 2 } }, { smart_momentum: { min: 5 } }] }],
      }),
    ]);

    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: 'E2E Ungroup Me' }).locator('button[title="Edit"]').click();

    const box = additionalRulesBox(page);
    const groupBox = box.locator('.sb-or-group');
    await expect(groupBox).toHaveCount(1);

    await groupBox.getByRole('button', { name: 'Ungroup' }).click();

    await expect(page.locator('.sb-or-group')).toHaveCount(0);
    await expect(box.getByText('Trend Strength', { exact: false })).toBeVisible();
    await expect(box.getByText('Smart Momentum', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect(page.getByTestId('sb-results')).toBeVisible();

    const put = calls.find((c) => c.method === 'PUT');
    expect(put).toBeTruthy();
    const universe = (put?.body?.spec as { universe: Record<string, unknown> }).universe;
    expect('any_of' in universe).toBe(false);
    expect(universe.rating).toEqual({ min: 1 });
    expect(universe.trend_strength).toEqual({ min: 2 });
    expect(universe.smart_momentum).toEqual({ min: 5 });
  });

  test('Selection rules soporta el mismo mecanismo de grupos OR (componente compartido)', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockApi(page, []);
    await openNewStrategyForm(page, 'E2E Group Selection');

    const box = selectionRulesBox(page);
    await addRangeFilter(page, box, 'Return YTD', '0');
    await addRangeFilter(page, box, 'Sharpe 12M', '1');

    await checkForGrouping(box, 'Return YTD');
    await checkForGrouping(box, 'Sharpe 12M');
    await box.getByRole('button', { name: 'Group 2 as OR' }).click();

    await expect(box.locator('.sb-or-group')).toHaveCount(1);

    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect(page.getByTestId('sb-results')).toBeVisible();

    const post = calls.find((c) => c.method === 'POST' && c.path.endsWith('/strategies/'));
    expect(post).toBeTruthy();
    const spec = post?.body?.spec as { selection_filters?: Record<string, unknown> };
    expect(spec.selection_filters?.any_of).toEqual([
      { options: [{ return_ytd: { min: 0 } }, { sharpe_12m: { min: 1 } }] },
    ]);
  });
});
