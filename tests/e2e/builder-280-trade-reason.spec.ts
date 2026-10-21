import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #280 — the trade log ("fills" table) shows the off-calendar
 * exit reason in a «Motivo» column. API route-mocked (pattern:
 * builder-156-turnover.spec.ts). Since #278 fase 4 the fills table lives in
 * the per-rebalance detail (Rebalanceos tab), not in the overview.
 *
 *  - a result with a stop sale (`reason: "stop_loss"`) → the chip shows on
 *    that row and the rebalance rows (`reason: null`) stay empty;
 *  - a LEGACY result whose trades lack the `reason` key (every backtest saved
 *    before #280) → the column renders empty, never "undefined"/"null".
 *  - #281: trades arriving shuffled from the API render sorted by date
 *    (then ticker, then buy before sell).
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

/** Mocks the builder API with ONE saved strategy (`sid`/`name`/`costs`) whose
 *  backtest resolves immediately to `result`. */
async function mockApi(
  page: Page,
  opts: { sid: string; name: string; costs: { commission_bps: number; slippage_bps: number }; result: Record<string, unknown> },
): Promise<void> {
  const strategyRow = {
    strategy_id: opts.sid,
    name: opts.name,
    description: null,
    latest_version: 1,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-02T00:00:00Z',
    spec: { ...BASE_SPEC, costs: opts.costs },
    template_slug: null,
    template_version: null,
  };
  const doneResult = {
    job_id: 'j1',
    status: 'done',
    error: null,
    result: opts.result,
  };

  await page.route('**/templates/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/templates/', (route) => route.fulfill({ json: [] }));
  await page.route('**/backtests/*', (route) => route.fulfill({ json: doneResult }));
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (method === 'POST' && url.pathname.endsWith('/backtest')) {
      await route.fulfill({ json: { job_id: 'j1', status: 'done', cached: false } });
      return;
    }
    await route.fulfill({ json: [strategyRow] });
  });
}

async function backtestFromList(page: Page, name: string): Promise<void> {
  await page.goto('/dashboard/builder');
  await page.locator('.sb-card', { hasText: name }).locator('button[title="Backtest"]').click();
  await expect(page.getByTestId('sb-results')).toBeVisible();
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

function trade(ticker: string, date: string, side: string, extra: Record<string, unknown> = {}) {
  return {
    symbol_id: `sid-${ticker}`,
    ticker,
    date,
    side,
    shares: 10,
    price: 100,
    value: 1000,
    cost: 1,
    ...extra,
  };
}

function resultWith(trades: Record<string, unknown>[]): Record<string, unknown> {
  return {
    metrics: { ...BASE_METRICS },
    coverage_pct: 0.98,
    fill_convention: 'next_open_net_of_costs',
    initial_cash: 100000,
    window_start: '2024-01-02',
    window_end: '2024-06-28',
    equity: BASE_EQUITY,
    trades,
  };
}

const COSTS = { commission_bps: 5, slippage_bps: 8 };

const STOP_TRADES = [
  trade('AAA', '2024-01-03', 'buy', { reason: null }),
  trade('BBB', '2024-01-03', 'buy', { reason: null }),
  trade('AAA', '2024-01-10', 'sell', { reason: 'stop_loss' }),
];
const LEGACY_TRADES = [trade('AAA', '2024-01-03', 'buy'), trade('AAA', '2024-02-01', 'sell')];
const SHUFFLED_TRADES = [
  trade('MMM', '2024-03-04', 'buy'),
  trade('ZZZ', '2024-01-03', 'buy'),
  trade('AAA', '2024-02-05', 'sell', { reason: 'stop_loss' }),
  trade('AAA', '2024-01-03', 'buy'),
  trade('AAA', '2024-02-05', 'buy'),
];

test.describe('Builder — motivo de salida en el trade log (#280)', () => {
  test('una venta por stop muestra el chip stop_loss; los fills de rebalanceo quedan vacíos', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, {
      sid: 'sid-stop',
      name: 'E2E Stop Reason',
      costs: COSTS,
      result: resultWith(STOP_TRADES),
    });
    await mockRebalances(page, STOP_TRADES);

    await backtestFromList(page, 'E2E Stop Reason');
    await openRebalanceFills(page);

    const table = page.getByTestId('sb-fills-table');
    await expect(table.locator('thead')).toContainText('Motivo');
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(3);

    const stopRow = rows.filter({ hasText: '2024-01-10' });
    await expect(stopRow).toHaveCount(1);
    const chip = stopRow.getByTestId('sb-fill-reason').locator('.sb-chip.neg');
    await expect(chip).toHaveText('stop_loss');

    // rebalance fills: the reason cell exists but is empty
    const buyRows = rows.filter({ hasText: '2024-01-03' });
    await expect(buyRows).toHaveCount(2);
    for (const cell of await buyRows.getByTestId('sb-fill-reason').all()) {
      await expect(cell).toHaveText('');
    }
  });

  test('resultado legado sin la clave reason: columna vacía, sin undefined ni null', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, {
      sid: 'sid-legacy-reason',
      name: 'E2E Legacy Fills',
      costs: COSTS,
      result: resultWith(LEGACY_TRADES),
    });
    await mockRebalances(page, LEGACY_TRADES);

    await backtestFromList(page, 'E2E Legacy Fills');
    await openRebalanceFills(page);

    const table = page.getByTestId('sb-fills-table');
    const cells = table.locator('tbody tr').getByTestId('sb-fill-reason');
    await expect(cells).toHaveCount(2);
    for (const cell of await cells.all()) {
      await expect(cell).toHaveText('');
    }
    await expect(table.locator('.sb-chip')).toHaveCount(0);

    const tableText = await table.innerText();
    expect(tableText).not.toContain('undefined');
    expect(tableText).not.toContain('null');
  });

  test('#281 — trades desordenados en la API se pintan por fecha ascendente', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, {
      sid: 'sid-shuffled',
      name: 'E2E Shuffled Fills',
      costs: COSTS,
      result: resultWith(SHUFFLED_TRADES),
    });
    await mockRebalances(page, SHUFFLED_TRADES);

    await backtestFromList(page, 'E2E Shuffled Fills');
    await openRebalanceFills(page);

    const rows = page.getByTestId('sb-fills-table').locator('tbody tr');
    await expect(rows).toHaveCount(5);
    const got: string[] = [];
    for (const row of await rows.all()) {
      const cells = row.locator('td');
      got.push(`${await cells.nth(1).innerText()} ${await cells.nth(0).innerText()} ${await cells.nth(2).innerText()}`);
    }
    expect(got).toEqual([
      '2024-01-03 AAA buy',
      '2024-01-03 ZZZ buy',
      '2024-02-05 AAA buy',
      '2024-02-05 AAA sell',
      '2024-03-04 MMM buy',
    ]);
  });
});
