import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #156 — turnover / cost-drag metrics in the Strategy Builder
 * results view. API route-mocked (pattern: builder-131-top-marketcap.spec.ts).
 *
 * Covers the two cases the design calls out:
 *  - a result WITH the 5 new `BacktestMetrics` fields (issue #155, backend —
 *    still on a parallel branch) → they render, plus the zero-friction warning
 *    when costs are 0 bps and turnover is high;
 *  - a LEGACY result without them (any of the 174 backtests saved before #155
 *    shipped) → the view must not crash, and must never show "NaN"/"undefined".
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

test.describe('Builder — turnover y arrastre de costo en resultados (#156)', () => {
  test('métricas nuevas: turnover, costos, cost drag, holding period y exits se muestran', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, {
      sid: 'sid-new-metrics',
      name: 'E2E Turnover Metrics',
      costs: { commission_bps: 5, slippage_bps: 8 }, // costs > 0 → no zero-friction banner here
      result: {
        metrics: {
          ...BASE_METRICS,
          turnover_pct_annual: 976.3,
          total_costs: 1234.5,
          cost_drag_pct_annual: 2.47,
          avg_holding_days: 42.1,
          n_exits: 58,
        },
        coverage_pct: 0.98,
        fill_convention: 'next_open_net_of_costs',
        initial_cash: 100000,
        window_start: '2024-01-02',
        window_end: '2024-06-28',
        equity: BASE_EQUITY,
        trades: [],
      },
    });

    await backtestFromList(page, 'E2E Turnover Metrics');

    const grid = page.getByTestId('sb-turnover-metrics');
    await expect(grid).toBeVisible();
    await expect(grid).toContainText('976%');
    await expect(grid).toContainText('2.47%');
    await expect(grid).toContainText('42d');
    await expect(grid).toContainText('58');
    // total_costs is USD-abbreviated (formatUsd): 1234.5 → $1.2K
    await expect(grid).toContainText('$1.2K');

    // Costs are non-zero → the zero-friction warning must NOT show even though
    // turnover is well above the "book turned over once" threshold.
    await expect(page.getByTestId('sb-zero-cost-warning')).toHaveCount(0);
  });

  test('aviso de fricción cero cuando costs = 0 bps y turnover alto', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, {
      sid: 'sid-zero-cost',
      name: 'E2E Zero Cost Strategy',
      costs: { commission_bps: 0, slippage_bps: 0 },
      result: {
        metrics: {
          ...BASE_METRICS,
          turnover_pct_annual: 950,
          total_costs: 0,
          cost_drag_pct_annual: 0,
          avg_holding_days: 12,
          n_exits: 80,
        },
        coverage_pct: 0.98,
        fill_convention: 'next_open_net_of_costs',
        initial_cash: 100000,
        window_start: '2024-01-02',
        window_end: '2024-06-28',
        equity: BASE_EQUITY,
        trades: [],
      },
    });

    await backtestFromList(page, 'E2E Zero Cost Strategy');

    await expect(page.getByTestId('sb-zero-cost-warning')).toBeVisible();
    await expect(page.getByTestId('sb-zero-cost-warning')).toContainText('950%');
  });

  test('resultado legado sin las métricas nuevas renderiza sin NaN ni undefined', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, {
      sid: 'sid-legacy',
      name: 'E2E Legacy Result',
      costs: { commission_bps: 5, slippage_bps: 8 },
      result: {
        // No turnover_pct_annual / total_costs / cost_drag_pct_annual /
        // avg_holding_days / n_exits — exactly the 174 pre-#155 rows.
        metrics: { ...BASE_METRICS },
        coverage_pct: 0.98,
        fill_convention: 'next_open_net_of_costs',
        initial_cash: 100000,
        window_start: '2024-01-02',
        window_end: '2024-06-28',
        equity: BASE_EQUITY,
        trades: [],
      },
    });

    await backtestFromList(page, 'E2E Legacy Result');

    // The turnover section is omitted entirely for a legacy result — not shown
    // as a broken/blank grid.
    await expect(page.getByTestId('sb-turnover-metrics')).toHaveCount(0);
    await expect(page.getByTestId('sb-zero-cost-warning')).toHaveCount(0);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');

    // The pre-existing metrics still render fine.
    await expect(page.getByTestId('sb-metrics')).toBeVisible();
    await expect(page.getByTestId('sb-metrics')).toContainText('+12.0%');
  });
});
