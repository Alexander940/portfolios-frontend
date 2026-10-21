import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * E2E for issue #278, fase 3 — pestaña «Rebalanceos» con el índice por
 * rebalanceo. API route-mocked (pattern: builder-156-turnover.spec.ts).
 *
 *  (a) resultado `done` → la pestaña aparece, al abrirla se pide
 *      `GET /backtests/{job}/rebalances`, se pintan 3 filas (una saltada, en
 *      gris con «saltado») y las 6 tarjetas del `summary`;
 *  (b) «Ordenar por» → Retorno del período reordena las filas;
 *  (c) clic en la fecha → detalle mínimo «Rebalanceo 2 de 3» y vuelta al índice;
 *  (d) 409 (resultado anterior a la tabla) → tarjeta con el mensaje del backend
 *      y «Volver a correr», que dispara `POST …/backtest?force=true`;
 *  (e) «Exportar CSV (rebalanceos)» → `GET /backtests/{job}/rebalances.csv`.
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

const SPEC = {
  general: { instrument_type: 'stocks', currency: 'USD', benchmark: 'SPY', performance_metric: 'total_return' },
  universe: { country: ['US'] },
  selection: { sort_by: 'market_cap', sort_order: 'desc', top_n: 2 },
  weighting: { method: 'equal' },
  rebalance: { cadence: 'weekly' },
  costs: { commission_bps: 5, slippage_bps: 5 },
  validation: { start: '2024-01-01', end: '2024-01-22', oos_split: 0.2, min_n_trades: 1 },
};

const RESULT = {
  metrics: {
    total_return: 0.04, cagr: 0.9, volatility: 0.2, sharpe: 1.1, sortino: 1.4,
    calmar: 2, max_drawdown: -0.03, alpha: 0.01, beta: 1, n_trades: 3,
    n_rebalances: 2, is_sharpe: 1, oos_sharpe: 1, low_sample_trades: false, low_sample_universe: false,
  },
  coverage_pct: 1,
  fill_convention: 'next_open_net_of_costs',
  initial_cash: 100000,
  window_start: '2024-01-01',
  window_end: '2024-01-22',
  equity: [
    { date: '2024-01-01', total_value: 100000, cash: 100000, invested: 0, benchmark_value: 100, daily_return: 0, drawdown: 0 },
    { date: '2024-01-22', total_value: 104000, cash: 0, invested: 104000, benchmark_value: 101, daily_return: 0, drawdown: 0 },
  ],
  trades: [],
};

const ROWS = [
  {
    seq: 0, decision_date: '2024-01-01', fill_date: '2024-01-02', period_end: '2024-01-08', skipped: false,
    period_return: -0.017163, bench_return: -0.015429, excess: -0.001734, max_drawdown: -0.022957,
    turnover_pct: 0.500501, costs: 100.0, n_entries: 2, n_exits: 0, n_adjust: 0, n_stops: 0,
    cash_after: -100.0, value_after: 99900.0, n_positions_before: 0, n_positions_after: 2,
  },
  {
    seq: 1, decision_date: '2024-01-08', fill_date: '2024-01-09', period_end: '2024-01-15', skipped: true,
    period_return: 0.0102, bench_return: 0.0072, excess: 0.003, max_drawdown: -0.004,
    turnover_pct: 0, costs: 0, n_entries: 0, n_exits: 0, n_adjust: 0, n_stops: 0,
    cash_after: -100.0, value_after: 100919.0, n_positions_before: 2, n_positions_after: 2,
  },
  {
    seq: 2, decision_date: '2024-01-15', fill_date: '2024-01-16', period_end: '2024-01-22', skipped: false,
    period_return: 0.048316, bench_return: 0.038316, excess: 0.01, max_drawdown: -0.01,
    turnover_pct: 0.005498, costs: 1.09, n_entries: 1, n_exits: 1, n_adjust: 0, n_stops: 0,
    cash_after: 12.5, value_after: 105800.0, n_positions_before: 2, n_positions_after: 2,
  },
];

const INDEX = {
  items: ROWS,
  total: 3,
  summary: {
    n_executed: 2,
    n_skipped: 1,
    pct_periods_beating_bench: 0.667,
    median_turnover_pct: 0.253,
    total_costs: 101.09,
    best: { seq: 2, decision_date: '2024-01-15', period_return: 0.048316 },
    worst: { seq: 0, decision_date: '2024-01-01', period_return: -0.017163 },
  },
};

const STALE_MSG = 'Vuelve a correr el backtest para ver el detalle por rebalanceo';

async function seedAuth(page: Page): Promise<void> {
  await page.addInitScript(
    ([user, token]) => {
      localStorage.setItem('access_token', token as string);
      localStorage.setItem('auth-storage', JSON.stringify({ state: { user, isAuthenticated: true }, version: 0 }));
    },
    [USER, 'fake-e2e-token'],
  );
  await page.route('**/auth/me', (route) => route.fulfill({ json: USER }));
}

interface Captured {
  posts: string[];
  indexGets: string[];
  csvGets: string[];
}

/** One saved strategy; its backtest resolves to job `j1` (or `j2` after a
 *  `force=true` re-run). `stale` → the `j1` index answers 409 (a result
 *  persisted before the rebalances table); `j2` always answers the index. */
async function mockApi(page: Page, opts: { stale?: boolean } = {}): Promise<Captured> {
  const cap: Captured = { posts: [], indexGets: [], csvGets: [] };
  const strategyRow = {
    strategy_id: 'sid-278',
    name: 'E2E Rebalanceos',
    description: null,
    latest_version: 1,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-02T00:00:00Z',
    spec: SPEC,
    template_slug: null,
    template_version: null,
  };

  await page.route('**/templates/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/templates/', (route) => route.fulfill({ json: [] }));
  await page.route('**/backtests/*', (route) => {
    const jobId = new URL(route.request().url()).pathname.split('/').pop();
    return route.fulfill({ json: { job_id: jobId, status: 'done', error: null, result: RESULT } });
  });
  await page.route('**/backtests/*/rebalances', (route: Route) => {
    const url = route.request().url();
    cap.indexGets.push(url);
    if (opts.stale && url.includes('/backtests/j1/')) {
      return route.fulfill({ status: 409, json: { detail: STALE_MSG } });
    }
    return route.fulfill({ json: INDEX });
  });
  await page.route('**/backtests/*/rebalances.csv', (route: Route) => {
    cap.csvGets.push(route.request().url());
    return route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="rebalances-j1.csv"',
        'Access-Control-Expose-Headers': 'Content-Disposition',
      },
      body: 'seq,decision_date\n0,2024-01-01\n',
    });
  });
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (method === 'POST' && url.pathname.endsWith('/backtest')) {
      cap.posts.push(route.request().url());
      const forced = url.searchParams.get('force') === 'true';
      await route.fulfill({ json: { job_id: forced ? 'j2' : 'j1', status: 'done', cached: !forced } });
      return;
    }
    await route.fulfill({ json: [strategyRow] });
  });
  return cap;
}

async function openRebalancesTab(page: Page): Promise<void> {
  await page.goto('/dashboard/builder');
  await page.locator('.sb-card', { hasText: 'E2E Rebalanceos' }).locator('button[title="Backtest"]').click();
  await expect(page.getByTestId('sb-results')).toBeVisible();
  const tab = page.getByTestId('sb-tab-rebalances');
  await expect(tab).toBeVisible();
  await expect(tab).toHaveAttribute('role', 'tab');
  await tab.click();
}

const rowSeqs = (page: Page) =>
  page.getByTestId('sb-rb-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-seq')));

test.describe('Builder — índice de rebalanceos (#278, fase 3)', () => {
  test('(a) la pestaña pide el índice y pinta filas y tarjetas', async ({ page }) => {
    await seedAuth(page);
    const cap = await mockApi(page);
    await openRebalancesTab(page);

    const view = page.getByTestId('sb-rb-index');
    await expect(view).toBeVisible();
    expect(cap.indexGets.some((u) => u.includes('/backtests/j1/rebalances'))).toBe(true);
    await expect(view).toContainText('3 rebalanceos');
    await expect(view).toContainText('Cada fila es una decisión al cierre');

    await expect(page.getByTestId('sb-rb-row')).toHaveCount(3);
    expect(await rowSeqs(page)).toEqual(['0', '1', '2']);
    const skipped = page.locator('[data-testid="sb-rb-row"][data-seq="1"]');
    await expect(skipped).toHaveClass(/sb-rb-skipped/);
    await expect(skipped).toContainText('saltado');
    // A skipped rebalance has no execution: the Ejecución cell shows a dash.
    await expect(skipped.getByTestId('sb-rb-fill-date')).toHaveText('—');
    await expect(page.locator('[data-testid="sb-rb-row"][data-seq="0"]')).toContainText('0 → 2');

    const cards = page.getByTestId('sb-rb-summary');
    await expect(cards.locator('.sb-rb-card')).toHaveCount(6);
    await expect(page.getByTestId('sb-rb-card-executed')).toContainText('2 · 1');
    await expect(page.getByTestId('sb-rb-card-beating')).toContainText('66.7%');
    await expect(page.getByTestId('sb-rb-card-beating')).toContainText('2 de 3');
    await expect(page.getByTestId('sb-rb-card-turnover')).toContainText('25.3%');
    await expect(page.getByTestId('sb-rb-card-costs')).toContainText('$101');
    await expect(page.getByTestId('sb-rb-card-best')).toContainText('+4.8%');
    await expect(page.getByTestId('sb-rb-card-worst')).toContainText('-1.7%');

    // Bar strip: one accessible bar per snapshot.
    await expect(page.getByTestId('sb-rb-bar')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Rebalanceo 2024-01-15: retorno +4.8%' })).toBeVisible();
  });

  test('(b) ordenar por Retorno del período reordena las filas', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await openRebalancesTab(page);
    await expect(page.getByTestId('sb-rb-row')).toHaveCount(3);

    await page.getByTestId('sb-rb-sort').selectOption('period_return');
    await expect.poll(() => rowSeqs(page)).toEqual(['2', '1', '0']);
    await page.getByTestId('sb-rb-sort').selectOption('decision_date');
    await expect.poll(() => rowSeqs(page)).toEqual(['0', '1', '2']);
  });

  test('(c) clic en la fecha abre el detalle mínimo y vuelve al índice', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await openRebalancesTab(page);

    await page.locator('[data-testid="sb-rb-row"][data-seq="1"]').getByTestId('sb-rb-date').click();
    const detail = page.getByTestId('sb-rb-detail');
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('Rebalanceo 2 de 3');
    await expect(detail).toContainText('2024-01-08');
    await expect(page.getByTestId('sb-rb-index')).toHaveCount(0);

    await page.getByRole('button', { name: /Volver al índice/ }).click();
    await expect(page.getByTestId('sb-rb-index')).toBeVisible();
    await expect(page.getByTestId('sb-rb-row')).toHaveCount(3);
  });

  test('(d) 409 → «Volver a correr» lanza POST …/backtest?force=true', async ({ page }) => {
    await seedAuth(page);
    const cap = await mockApi(page, { stale: true });
    await openRebalancesTab(page);

    const stale = page.getByTestId('sb-rb-stale');
    await expect(stale).toBeVisible();
    await expect(stale).toContainText('Este resultado es anterior al detalle por rebalanceo');
    await expect(stale).toContainText(STALE_MSG);
    expect(cap.posts).toHaveLength(1);
    expect(cap.posts[0]).not.toContain('force=true');

    await stale.getByRole('button', { name: 'Volver a correr' }).click();
    await expect.poll(() => cap.posts.length).toBe(2);
    expect(cap.posts[1]).toContain('force=true');
    // The forced re-run lands on a new job whose index is available.
    await expect(page.getByTestId('sb-rb-index')).toBeVisible();
    expect(cap.indexGets.some((u) => u.includes('/backtests/j2/rebalances'))).toBe(true);
  });

  test('(e) «Exportar CSV (rebalanceos)» pide rebalances.csv', async ({ page }) => {
    await seedAuth(page);
    const cap = await mockApi(page);
    await openRebalancesTab(page);
    await expect(page.getByTestId('sb-rb-row')).toHaveCount(3);

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar CSV (rebalanceos)' }).click();
    await expect.poll(() => cap.csvGets.length).toBe(1);
    expect(cap.csvGets[0]).toContain('/backtests/j1/rebalances.csv');
    expect((await download).suggestedFilename()).toBe('rebalances-j1.csv');
  });
});
