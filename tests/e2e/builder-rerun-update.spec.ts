import { test, expect, type Page } from '@playwright/test';

/**
 * E2E — re-run de una estrategia persistida (bug de duplicación).
 *
 * API route-mocked. Asserts:
 *  - editar la fecha y "Save & backtest" hace PUT /strategies/{id} (nueva
 *    versión de la MISMA estrategia) y NUNCA re-POSTea /strategies/ (el flujo
 *    viejo creaba una fila duplicada, o 409-eaba tras el guard de #58);
 *  - correr sin cambios (botón play, o edit sin tocar nada) dedupea server-side
 *    (cached: true) y muestra el aviso "dates haven't changed" en vez de
 *    fingir una corrida nueva.
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

const SID = '33333333-3333-3333-3333-333333333333';

const SERVER_SPEC = {
  general: { instrument_type: 'stocks', currency: 'USD', benchmark: 'SPY', performance_metric: 'total_return' },
  universe: { country: ['US'], rating: { min: 1 } },
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

const STRATEGY_ROW = {
  strategy_id: SID,
  name: 'Mi Momentum',
  description: null,
  latest_version: 1,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-02T00:00:00Z',
  spec: SERVER_SPEC,
  template_slug: null,
  template_version: null,
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
}

/** Mock the builder API. `submit` controls the backtest POST response. */
async function mockApi(
  page: Page,
  opts: {
    submit: { job_id: string; status: string; cached: boolean };
    putResponse?: { version: number; spec_changed: boolean };
  },
): Promise<Recorded[]> {
  const calls: Recorded[] = [];

  await page.route('**/templates/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/templates/', (route) => route.fulfill({ json: [] }));
  await page.route('**/backtests/*', (route) => route.fulfill({ json: DONE_RESULT }));
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (method === 'POST' && url.pathname.endsWith('/backtest')) {
      calls.push({ method, path: url.pathname, body: null });
      await route.fulfill({ json: opts.submit });
      return;
    }
    if (method === 'PUT') {
      calls.push({ method, path: url.pathname, body: route.request().postDataJSON() });
      await route.fulfill({
        json: {
          strategy_id: SID,
          version: opts.putResponse?.version ?? 2,
          content_hash: 'beef'.repeat(16),
          spec_changed: opts.putResponse?.spec_changed ?? true,
        },
      });
      return;
    }
    if (method === 'POST') {
      calls.push({ method, path: url.pathname, body: route.request().postDataJSON() });
      await route.fulfill({
        status: 201,
        json: { strategy_id: 'dup-created', version: 1, content_hash: 'dead'.repeat(16) },
      });
      return;
    }
    await route.fulfill({ json: [STRATEGY_ROW] });
  });

  return calls;
}

async function openValidation(page: Page): Promise<void> {
  const start = page.locator('input[type="date"]').first();
  if (!(await start.isVisible().catch(() => false))) {
    await page.getByText('Validation window').click();
  }
}

test.describe('Builder — re-run de estrategia persistida (no duplicar / aviso cached)', () => {
  test('editar la fecha y re-correr hace PUT a la MISMA estrategia, nunca un POST de create', async ({
    page,
  }) => {
    await seedAuth(page);
    const calls = await mockApi(page, {
      submit: { job_id: 'j1', status: 'running', cached: false },
      putResponse: { version: 2, spec_changed: true },
    });

    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: 'Mi Momentum' }).locator('button[title="Edit"]').click();
    await openValidation(page);
    await page.locator('input[type="date"]').nth(1).fill('2024-09-30');
    await page.getByRole('button', { name: 'Save & backtest' }).click();

    await expect(page.getByTestId('sb-results')).toBeVisible();

    const put = calls.find((c) => c.method === 'PUT');
    expect(put).toBeTruthy();
    expect(put?.path.endsWith(`/strategies/${SID}`)).toBe(true);
    const spec = put?.body?.spec as { validation: { end: string } };
    expect(spec.validation.end).toBe('2024-09-30');
    // el flujo viejo re-creaba la estrategia — eso es exactamente lo prohibido
    const createPost = calls.find((c) => c.method === 'POST' && c.path.endsWith('/strategies/'));
    expect(createPost).toBeUndefined();
    // fechas nuevas → corrida real → sin aviso de "sin cambios"
    await expect(page.getByTestId('sb-cached-notice')).toHaveCount(0);
  });

  test('play sin cambios → dedupe cached y aviso "dates haven\'t changed"', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockApi(page, {
      submit: { job_id: 'j1', status: 'done', cached: true },
    });

    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: 'Mi Momentum' }).locator('button[title="Backtest"]').click();

    await expect(page.getByTestId('sb-results')).toBeVisible();
    await expect(page.getByTestId('sb-cached-notice')).toBeVisible();
    await expect(page.getByTestId('sb-cached-notice')).toContainText("haven't changed");
    // ni create ni update — solo el submit del backtest (deduped)
    expect(calls.filter((c) => c.method === 'POST' && c.path.endsWith('/strategies/'))).toHaveLength(0);
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
  });

  test('edit sin tocar nada → PUT spec_changed:false + cached → aviso, sin duplicado', async ({
    page,
  }) => {
    await seedAuth(page);
    const calls = await mockApi(page, {
      submit: { job_id: 'j1', status: 'done', cached: true },
      putResponse: { version: 1, spec_changed: false },
    });

    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: 'Mi Momentum' }).locator('button[title="Edit"]').click();
    await page.getByRole('button', { name: 'Save & backtest' }).click();

    await expect(page.getByTestId('sb-results')).toBeVisible();
    await expect(page.getByTestId('sb-cached-notice')).toBeVisible();
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
    expect(calls.filter((c) => c.method === 'POST' && c.path.endsWith('/strategies/'))).toHaveLength(0);
  });
});
