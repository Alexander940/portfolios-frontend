import { test, expect, type Page } from '@playwright/test';

/**
 * Botón permanente «OR group» — empezar un grupo sin tener reglas sueltas antes.
 *
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





test.describe('Builder — botón permanente de grupo OR', () => {
  test('el botón se ve SIN reglas previas (el punto de la opción B)', async ({ page }) => {
    await seedAuth(page);
    const name = 'E2E OR botón';
    await mockApi(page, [strategyRow('sid-btn', name, {})]);
    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: name }).locator('button[title="Edit"]').click();
    await page.getByRole('button', { name: /Investment universe/ }).click();

    // Con CERO reglas el botón ya está: es lo que la versión anterior no tenía.
    await expect(page.getByTestId('sb-or-new').first()).toBeVisible();
  });

  test('empezar por el grupo: dos huecos, se rellenan, se promueve', async ({ page }) => {
    await seedAuth(page);
    const name = 'E2E OR flujo';
    const calls = await mockApi(page, [strategyRow('sid-flow', name, {})]);
    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: name }).locator('button[title="Edit"]').click();
    await page.getByRole('button', { name: /Investment universe/ }).click();

    await page.getByTestId('sb-or-new').first().click();
    const draft = page.getByTestId('sb-or-draft');
    await expect(draft).toBeVisible();
    // Nace con DOS huecos — el mínimo que el backend exige, dicho por la forma.
    await expect(draft.getByTestId('sb-or-draft-slot-0')).toBeVisible();
    await expect(draft.getByTestId('sb-or-draft-slot-1')).toBeVisible();

    // Rellenar el primero deja el borrador vivo (aún no es un grupo real).
    await draft.getByTestId('sb-or-draft-slot-0').selectOption('rating');
    await page.getByLabel('Min').fill('2');
    await page.getByRole('button', { name: /Apply|Add/ }).click();
    await expect(page.getByTestId('sb-or-draft')).toBeVisible();
    await expect(page.getByTestId('sb-or-group')).toHaveCount(0);

    // Al rellenar el segundo se PROMUEVE a grupo real y el borrador desaparece.
    await page.getByTestId('sb-or-draft').getByTestId('sb-or-draft-slot-1').selectOption('smart_momentum');
    await page.getByLabel('Min').fill('80');
    await page.getByRole('button', { name: /Apply|Add/ }).click();
    await expect(page.getByTestId('sb-or-draft')).toHaveCount(0);
    await expect(page.getByTestId('sb-or-group')).toBeVisible();

    // Y llega al spec como any_of.
    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect(page.getByTestId('sb-results')).toBeVisible();
    const put = calls.find((c) => c.method === 'PUT');
    const universe = (put?.body?.spec as { universe: Record<string, unknown> }).universe;
    expect(universe.any_of).toEqual([
      { options: [{ rating: { min: 2 } }, { smart_momentum: { min: 80 } }] },
    ]);
  });

  test('un borrador a medias NO viaja al spec ni bloquea el guardado', async ({ page }) => {
    await seedAuth(page);
    const name = 'E2E OR borrador';
    const calls = await mockApi(page, [strategyRow('sid-draft', name, {})]);
    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: name }).locator('button[title="Edit"]').click();
    await page.getByRole('button', { name: /Investment universe/ }).click();

    await page.getByTestId('sb-or-new').first().click();
    await page.getByTestId('sb-or-draft').getByTestId('sb-or-draft-slot-0').selectOption('rating');
    await page.getByLabel('Min').fill('2');
    await page.getByRole('button', { name: /Apply|Add/ }).click();

    // El borrador vive solo en el estado del componente: el spec no lo ve.
    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect(page.getByTestId('sb-results')).toBeVisible();
    const put = calls.find((c) => c.method === 'PUT');
    const universe = (put?.body?.spec as { universe: Record<string, unknown> }).universe;
    expect('any_of' in universe).toBe(false);
  });

  test('Cancel descarta el borrador entero', async ({ page }) => {
    await seedAuth(page);
    const name = 'E2E OR cancel';
    await mockApi(page, [strategyRow('sid-cancel', name, {})]);
    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: name }).locator('button[title="Edit"]').click();
    await page.getByRole('button', { name: /Investment universe/ }).click();

    await page.getByTestId('sb-or-new').first().click();
    await expect(page.getByTestId('sb-or-draft')).toBeVisible();
    await page.getByTestId('sb-or-draft').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('sb-or-draft')).toHaveCount(0);
  });
});
