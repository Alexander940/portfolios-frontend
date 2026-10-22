import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #283 — the "Trades" card becomes "Entradas" (it counts
 * positions opened, `n_trades`, not fills) with the fill count as subtitle, and
 * "Avg. holding" gets the entry→full-exit tooltip plus the FIFO-lot line
 * (`avg_lot_days`) when the result carries it. API route-mocked (pattern:
 * builder-156-turnover.spec.ts).
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

function fill(i: number, side: 'buy' | 'sell') {
  return {
    symbol_id: 100 + i,
    ticker: `T${i}`,
    date: `2024-02-0${i + 1}`,
    side,
    shares: 10,
    price: 50,
    value: 500,
    cost: 0.5,
    reason: null,
  };
}

const SIX_FILLS = [
  fill(0, 'buy'), fill(1, 'buy'), fill(2, 'buy'),
  fill(3, 'sell'), fill(4, 'buy'), fill(5, 'sell'),
];

function result(metrics: Record<string, unknown>, trades: unknown[]) {
  return {
    metrics,
    coverage_pct: 0.98,
    fill_convention: 'next_open_net_of_costs',
    initial_cash: 100000,
    window_start: '2024-01-02',
    window_end: '2024-06-28',
    equity: BASE_EQUITY,
    trades,
  };
}

test.describe('Builder — tarjeta Entradas y holding (#283)', () => {
  test('n_trades 2 con 6 fills → «Entradas 2» con subtítulo «6 fills» y línea FIFO', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, {
      sid: 'sid-283-new',
      name: 'E2E Entries Card',
      costs: { commission_bps: 5, slippage_bps: 8 },
      result: result(
        {
          ...BASE_METRICS,
          n_trades: 2,
          turnover_pct_annual: 300,
          total_costs: 10,
          cost_drag_pct_annual: 0.5,
          avg_holding_days: 21,
          avg_lot_days: 14,
          n_exits: 1,
        },
        SIX_FILLS,
      ),
    });

    await backtestFromList(page, 'E2E Entries Card');

    const card = page.getByTestId('sb-metric-entries');
    await expect(card).toContainText('Entradas');
    await expect(card.locator('.mv')).toHaveText('2');
    await expect(card.locator('.msub')).toHaveText('6 fills');
    await expect(page.getByTestId('sb-metrics')).not.toContainText('Trades');

    const holding = page.getByTestId('sb-metric-avg-holding');
    await expect(holding).toContainText('21d');
    await expect(holding.getByTestId('sb-avg-lot-days')).toHaveText('por lote FIFO: 14 d');
  });

  test('resultado legado sin avg_lot_days → sin línea FIFO, sin undefined ni NaN', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, {
      sid: 'sid-283-legacy',
      name: 'E2E Legacy Holding',
      costs: { commission_bps: 5, slippage_bps: 8 },
      result: result(
        {
          ...BASE_METRICS,
          turnover_pct_annual: 300,
          total_costs: 10,
          cost_drag_pct_annual: 0.5,
          avg_holding_days: 10.5,
          n_exits: 0,
        },
        SIX_FILLS,
      ),
    });

    await backtestFromList(page, 'E2E Legacy Holding');

    await expect(page.getByTestId('sb-metric-avg-holding')).toContainText('11d');
    await expect(page.getByTestId('sb-avg-lot-days')).toHaveCount(0);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('NaN');
  });
});
