import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #282 — fill noise:
 *  (a) a NEW strategy created without touching anything sends the suggested
 *      `rebalance.min_trade_pct = 0.005` (A-282-1, default 0.5 %);
 *  (b) a SAVED strategy whose spec has no `min_trade_pct` loads with the field
 *      empty and a re-save never injects it;
 *  (c) the trade log tags each fill entrada / salida / ajuste and can hide the
 *      adjustments under 0.5 % of the book — since #278 fase 4 that table
 *      lives in the per-rebalance detail (Rebalanceos tab).
 * API route-mocked (pattern: builder-156-turnover.spec.ts /
 * builder-158-rebalance-section.spec.ts).
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

const BASE_SPEC = {
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
  validation: { start: '2024-01-02', end: '2024-06-28', oos_split: 0.2, min_n_trades: 30 },
};

const BASE_METRICS = {
  total_return: 0.12, cagr: 0.25, volatility: 0.18, sharpe: 1.4, sortino: 1.9,
  calmar: 2.1, max_drawdown: -0.08, alpha: 0.01, beta: 1.02, n_trades: 42,
  n_rebalances: 6, is_sharpe: 1.5, oos_sharpe: 1.2,
  low_sample_trades: false, low_sample_universe: false,
};

const BASE_EQUITY = [
  { date: '2024-01-02', total_value: 100000, cash: 0, invested: 100000, benchmark_value: 100, daily_return: 0, drawdown: 0 },
  { date: '2024-06-28', total_value: 112000, cash: 0, invested: 112000, benchmark_value: 108, daily_return: 0.001, drawdown: -0.01 },
];

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

interface RecordedCall {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

/** Builder API mock: `GET /strategies/` answers `rows`; create/update/backtest
 *  are recorded; every backtest resolves to `result`. */
async function mockApi(
  page: Page,
  rows: Record<string, unknown>[],
  result: Record<string, unknown>,
): Promise<RecordedCall[]> {
  const calls: RecordedCall[] = [];
  const done = { job_id: 'j1', status: 'done', error: null, result };
  await page.route('**/templates/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/templates/', (route) => route.fulfill({ json: [] }));
  await page.route('**/backtests/*', (route) => route.fulfill({ json: done }));
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
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
        json: { strategy_id: 'new-created', version: 1, content_hash: 'dead'.repeat(16) },
      });
      return;
    }
    await route.fulfill({ json: rows });
  });
  return calls;
}

/** #278 fase 4: the flat trade log left the overview — the fills now live in
 *  the per-rebalance detail. One rebalance (seq 0) whose fills are `trades`,
 *  over an empty before-book worth 100k. */
async function mockRebalances(page: Page, trades: Record<string, unknown>[]): Promise<void> {
  const row = {
    seq: 0, decision_date: '2024-01-02', fill_date: '2024-01-03', period_end: '2024-06-28', skipped: false,
    period_return: 0.12, bench_return: 0.08, excess: 0.04, max_drawdown: -0.08, turnover_pct: 0.5,
    costs: 1, n_entries: 2, n_exits: 1, n_adjust: 0, n_stops: 0, cash_after: 0, value_after: 100000,
    n_positions_before: 0, n_positions_after: 2,
  };
  await page.route('**/backtests/*/rebalances', (route) =>
    route.fulfill({
      json: {
        items: [row],
        total: 1,
        summary: {
          n_executed: 1, n_skipped: 0, pct_periods_beating_bench: 1, median_turnover_pct: 0.5,
          total_costs: 1, best: null, worst: null,
        },
      },
    }),
  );
  await page.route('**/backtests/*/rebalances/*', (route) =>
    route.fulfill({
      json: {
        seq: 0, decision_date: row.decision_date, fill_date: row.fill_date, period_end: row.period_end,
        skipped: false,
        metrics: { ...row, cash_before: 100000, value_before: 100000, realized_pnl: 0, best_contrib: null, worst_contrib: null },
        positions_before: [], positions_after: [], trades, stops: [],
      },
    }),
  );
}

/** Results → «Rebalanceos» → detail of seq 0 (where the fills table lives now). */
async function openRebalanceFills(page: Page): Promise<void> {
  await page.getByTestId('sb-tab-rebalances').click();
  await page.locator('[data-testid="sb-rb-row"][data-seq="0"]').getByTestId('sb-rb-date').click();
  await expect(page.getByTestId('sb-rb-detail').getByTestId('sb-fills-table')).toBeVisible();
}

function strategyRow(sid: string, name: string, rebalance: Record<string, unknown>) {
  return {
    strategy_id: sid,
    name,
    description: null,
    latest_version: 1,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-02T00:00:00Z',
    spec: { ...BASE_SPEC, costs: { commission_bps: 5, slippage_bps: 8 }, rebalance },
    template_slug: null,
    template_version: null,
  };
}

function fill(ticker: string, date: string, side: 'buy' | 'sell', shares: number) {
  return {
    symbol_id: ticker === 'AAA' ? 'sid-aaa' : 'sid-bbb',
    ticker,
    date,
    side,
    shares,
    price: 100,
    value: shares * 100,
    cost: 0.1,
    reason: null,
  };
}

// Book = 100k every day. 2 entradas (1 % of the book each), 3 ajustes of
// 0.1 % (100 USD), 1 salida.
const SIX_FILLS = [
  fill('AAA', '2024-01-03', 'buy', 10), // entrada
  fill('BBB', '2024-01-03', 'buy', 10), // entrada
  fill('AAA', '2024-02-01', 'buy', 1), // ajuste 0.1 %
  fill('BBB', '2024-02-01', 'sell', 1), // ajuste 0.1 %
  fill('AAA', '2024-03-01', 'sell', 1), // ajuste 0.1 %
  fill('BBB', '2024-03-01', 'sell', 9), // salida
];

const EQUITY = ['2024-01-02', '2024-01-03', '2024-02-01', '2024-03-01', '2024-06-28'].map((date) => ({
  date,
  total_value: 100000,
  cash: 0,
  invested: 100000,
  benchmark_value: 100,
  daily_return: 0,
  drawdown: 0,
}));

const RESULT = {
  metrics: { ...BASE_METRICS, n_trades: 2 },
  coverage_pct: 0.98,
  fill_convention: 'next_open_net_of_costs',
  initial_cash: 100000,
  window_start: '2024-01-02',
  window_end: '2024-06-28',
  equity: EQUITY,
  trades: SIX_FILLS,
};

test.describe('Builder — min_trade_pct sugerido y tipo de fill (#282)', () => {
  test('(a) una estrategia nueva sin tocar nada manda rebalance.min_trade_pct = 0.005', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockApi(page, [], RESULT);

    await page.goto('/dashboard/builder');
    await page.getByRole('button', { name: 'New strategy' }).first().click();
    await page.getByPlaceholder('Strategy name').fill('E2E Nueva 282');
    await page.getByRole('button', { name: 'Save & backtest' }).click();

    await expect
      .poll(() => calls.filter((c) => c.method === 'POST' && c.path.endsWith('/strategies/')).length)
      .toBeGreaterThan(0);
    const created = calls.find((c) => c.method === 'POST' && c.path.endsWith('/strategies/'));
    const rebalance = (created?.body?.spec as { rebalance: Record<string, unknown> }).rebalance;
    expect(rebalance.min_trade_pct).toBe(0.005);
  });

  test('(b) una estrategia guardada sin la cláusula carga vacía y el re-guardado no la inyecta', async ({
    page,
  }) => {
    await seedAuth(page);
    const name = 'E2E Vieja sin min trade';
    const calls = await mockApi(page, [strategyRow('sid-old-282', name, { cadence: 'monthly' })], RESULT);

    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: name }).locator('button[title="Edit"]').click();
    await page.locator('.sb-section-head', { hasText: 'Rebalancing' }).click();
    const minTrade = page.locator('.sb-field', { hasText: 'Minimum trade size' }).locator('input');
    await expect(minTrade).toHaveValue('');

    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect(page.getByTestId('sb-results')).toBeVisible();

    // Only the create/update calls carry a spec (other POSTs, e.g. the Layer-1
    // preview, don't).
    const saves = calls.filter(
      (c) => (c.method === 'PUT' || (c.method === 'POST' && c.path.endsWith('/strategies/'))) && c.body?.spec,
    );
    expect(saves.length).toBeGreaterThan(0);
    for (const c of saves) {
      const rebalance = (c.body?.spec as { rebalance: Record<string, unknown> }).rebalance;
      expect('min_trade_pct' in rebalance).toBe(false);
    }
  });

  test('(b2) un borrador local guardado antes del campo (sin minTradePct) no recibe el default', async ({
    page,
  }) => {
    await seedAuth(page);
    // A localStorage draft from before the rebalance-rules epic: its cfg has no
    // `minTradePct` key at all. normalizeCfg spreads DEFAULT_CONFIG under saved
    // configs, so without a guard the new 0.5 % default would leak into it.
    await page.addInitScript(() => {
      localStorage.setItem(
        'sb-strategies',
        JSON.stringify({
          state: {
            strategies: [
              {
                id: 'draft-legacy-282',
                name: 'E2E Borrador legado',
                status: 'draft',
                updated: 1751328000000,
                cfg: { name: 'E2E Borrador legado', rebalance: 'monthly' },
              },
            ],
          },
          version: 0,
        }),
      );
    });
    const calls = await mockApi(page, [], RESULT);

    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: 'E2E Borrador legado' }).locator('button[title="Backtest"]').click();

    await expect
      .poll(() => calls.filter((c) => c.method === 'POST' && c.path.endsWith('/strategies/')).length)
      .toBeGreaterThan(0);
    const created = calls.find((c) => c.method === 'POST' && c.path.endsWith('/strategies/'));
    const rebalance = (created?.body?.spec as { rebalance: Record<string, unknown> }).rebalance;
    expect('min_trade_pct' in rebalance).toBe(false);
  });

  test('(c) el log muestra Tipo y el checkbox oculta los ajustes < 0,5 % del libro', async ({ page }) => {
    await seedAuth(page);
    const name = 'E2E Tipo de fill';
    await mockApi(page, [strategyRow('sid-fills-282', name, { cadence: 'monthly' })], RESULT);
    await mockRebalances(page, SIX_FILLS);

    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: name }).locator('button[title="Backtest"]').click();
    await expect(page.getByTestId('sb-results')).toBeVisible();
    await openRebalanceFills(page);

    const table = page.getByTestId('sb-fills-table');
    await expect(table.locator('thead')).toContainText('Tipo');
    const kinds = table.getByTestId('sb-fill-kind');
    await expect(kinds).toHaveText(['entrada', 'entrada', 'ajuste', 'ajuste', 'ajuste', 'salida']);
    await expect(table.locator('tbody tr')).toHaveCount(6);

    await page.getByLabel('Ocultar ajustes < 0,5 % del libro').check();
    await expect(table.locator('tbody tr')).toHaveCount(3);
    await expect(kinds).toHaveText(['entrada', 'entrada', 'salida']);
    await expect(page.locator('.sb-page-info')).toContainText('de 3 fills');
  });
});
