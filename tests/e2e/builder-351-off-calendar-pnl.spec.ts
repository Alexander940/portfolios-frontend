import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * E2E for portfolios-backend#355 (épica #351) — el P&L de las salidas fuera de
 * calendario se contabiliza en el rebalanceo SIGUIENTE al que ocurren. API
 * route-mocked (patrón: builder-278-rebalances.spec.ts).
 *
 *  (a) detalle con dos salidas desde el rebalanceo anterior: tabla con su P&L,
 *      fila de total = `realized_pnl_off_calendar`, y la tarjeta «P&L
 *      realizado» = rebalanceo + fuera de calendario;
 *  (b) la acción que salió por stop lleva su motivo en «Después»;
 *  (c) último rebalanceo: las salidas posteriores van en su bloque y no suman
 *      en la tarjeta;
 *  (d) rebalanceo sin salidas: texto de vacío, sin tabla;
 *  (e) resultado anterior al cambio (sin los campos nuevos): lista vieja +
 *      aviso de volver a correr, sin errores;
 *  (f) índice: columna «P&L realizado» y tarjeta del total con su desglose;
 *      en un resultado antiguo la columna muestra lo que haya y no hay tarjeta;
 *  (g) a 390 px el detalle no desborda.
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
  rebalance: { cadence: 'weekly', stop_loss_pct: 0.2 },
  costs: { commission_bps: 5, slippage_bps: 5 },
  validation: { start: '2024-01-01', end: '2024-01-22', oos_split: 0.2, min_n_trades: 1 },
};

const RESULT = {
  metrics: {
    total_return: 0.04, cagr: 0.9, volatility: 0.2, sharpe: 1.1, sortino: 1.4,
    calmar: 2, max_drawdown: -0.03, alpha: 0.01, beta: 1, n_trades: 3,
    n_rebalances: 3, is_sharpe: 1, oos_sharpe: 1, low_sample_trades: false, low_sample_universe: false,
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

const SID = {
  AAA: '00000000-0000-0000-0000-0000000000aa',
  BBB: '00000000-0000-0000-0000-0000000000bb',
  CCC: '00000000-0000-0000-0000-0000000000cc',
  DDD: '00000000-0000-0000-0000-0000000000dd',
};
type Tk = keyof typeof SID;

const base = (seq: number, decision: string, fill: string, end: string) => ({
  seq, decision_date: decision, fill_date: fill, period_end: end, skipped: false,
  period_return: 0.01, bench_return: 0.005, excess: 0.005, max_drawdown: -0.01,
  turnover_pct: 0.2, costs: 10, n_entries: 1, n_exits: 1, n_adjust: 0,
  cash_after: 0, value_after: 100000, n_positions_before: 2, n_positions_after: 2,
});

/** Filas del índice con la contabilidad de #351. */
const ROWS = [
  { ...base(0, '2024-01-01', '2024-01-02', '2024-01-08'), n_stops: 0,
    realized_pnl: 0, realized_pnl_rebalance: 0, realized_pnl_off_calendar: 0 },
  { ...base(1, '2024-01-08', '2024-01-09', '2024-01-15'), n_stops: 2,
    realized_pnl: -1260, realized_pnl_rebalance: 240, realized_pnl_off_calendar: -1500 },
  { ...base(2, '2024-01-15', '2024-01-16', '2024-01-22'), n_stops: 0,
    realized_pnl: 100, realized_pnl_rebalance: 100, realized_pnl_off_calendar: 0 },
];

/** Las mismas filas como las devuelve un resultado guardado antes del cambio:
 *  sin el desglose y con `n_stops` en la ventana vieja. */
const LEGACY_ROWS = ROWS.map((r) => {
  const { realized_pnl_rebalance: _a, realized_pnl_off_calendar: _b, ...rest } = r;
  void _a; void _b;
  return { ...rest, realized_pnl: r.realized_pnl_rebalance, n_stops: r.seq === 0 ? 2 : r.seq === 2 ? 1 : 0 };
});

const summary = (legacy: boolean) => ({
  n_executed: 3, n_skipped: 0, pct_periods_beating_bench: 1, median_turnover_pct: 0.2, total_costs: 34.5,
  best: { seq: 0, decision_date: '2024-01-01', period_return: 0.01 },
  worst: { seq: 0, decision_date: '2024-01-01', period_return: 0.01 },
  ...(legacy
    ? { total_realized_pnl: null, total_realized_pnl_rebalance: null, total_realized_pnl_off_calendar: null }
    : { total_realized_pnl: -1560, total_realized_pnl_rebalance: 340, total_realized_pnl_off_calendar: -1900 }),
});

const exit = (tk: Tk, date: string, reason: string, shares: number, price: number, costBasis: number) => ({
  symbol_id: SID[tk], ticker: tk, date, reason, shares, price, cost_basis: costBasis,
  value: shares * price, cost: 2.5, pnl: (price - costBasis) * shares, pnl_pct: price / costBasis - 1,
});
const stopTrade = (tk: Tk, date: string, reason: string, shares: number, price: number) => ({
  symbol_id: SID[tk], ticker: tk, date, side: 'sell', shares, price, value: shares * price, cost: 2.5, reason,
});

// BBB y CCC salieron por stop entre el rebalanceo 1 y el 2 → se contabilizan en el 2.
const EXITS_1 = [
  exit('BBB', '2024-01-04', 'stop_loss', 100, 80, 90), // −1.000
  exit('CCC', '2024-01-05', 'trailing_stop_atr', 50, 40, 50), // −500
];
// DDD salió después del último rebalanceo → cola.
const TAIL = [exit('DDD', '2024-01-18', 'stop_loss', 40, 90, 100)]; // −400

function detailFor(seq: number, legacy: boolean): Record<string, unknown> | null {
  const rows = legacy ? LEGACY_ROWS : ROWS;
  const row = rows.find((r) => r.seq === seq);
  if (!row) return null;
  const head = {
    seq, decision_date: row.decision_date, fill_date: row.fill_date, period_end: row.period_end, skipped: false,
    positions_before: [], trades: [],
  };
  const metrics = { ...row, cash_before: 0, value_before: 100000, best_contrib: null, worst_contrib: null };
  const after0 = [
    { symbol_id: SID.AAA, ticker: 'AAA', shares: 500, price: 100, value: 50000, weight: 0.5, target_weight: 0.5,
      period_return: 0.04, contribution: 0.02, cambio: 'nueva', ...(legacy ? {} : { exit_date: null, exit_reason: null }) },
    { symbol_id: SID.BBB, ticker: 'BBB', shares: 100, price: 90, value: 9000, weight: 0.09, target_weight: 0.1,
      period_return: -0.1111, contribution: -0.01, cambio: 'nueva',
      ...(legacy ? {} : { exit_date: '2024-01-04', exit_reason: 'stop_loss' }) },
  ];
  if (legacy) {
    // ventana vieja: los stops del período que SIGUE al rebalanceo
    const stops =
      seq === 0
        ? [stopTrade('BBB', '2024-01-04', 'stop_loss', 100, 80), stopTrade('CCC', '2024-01-05', 'trailing_stop_atr', 50, 40)]
        : seq === 2
          ? [stopTrade('DDD', '2024-01-18', 'stop_loss', 40, 90)]
          : [];
    return { ...head, metrics, positions_after: seq === 0 ? after0 : [], stops };
  }
  if (seq === 0) {
    return { ...head, metrics, positions_after: after0, stops: [], off_calendar_exits: [], off_calendar_exits_after: [] };
  }
  if (seq === 1) {
    return {
      ...head,
      metrics: { ...metrics, off_calendar_costs: 5, off_calendar_exits: EXITS_1 },
      positions_after: [],
      stops: [stopTrade('BBB', '2024-01-04', 'stop_loss', 100, 80), stopTrade('CCC', '2024-01-05', 'trailing_stop_atr', 50, 40)],
      off_calendar_exits: EXITS_1,
      off_calendar_exits_after: [],
    };
  }
  return {
    ...head,
    metrics: { ...metrics, off_calendar_costs: 0, off_calendar_exits: [], realized_pnl_off_calendar_after: -400 },
    positions_after: [],
    stops: [],
    off_calendar_exits: [],
    off_calendar_exits_after: TAIL,
  };
}

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

async function mockApi(page: Page, opts: { legacy?: boolean } = {}): Promise<string[]> {
  const legacy = !!opts.legacy;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Errores de la pantalla, no ruido de red de llamadas ajenas sin mock
  // (campana de alertas, etc.).
  page.on('console', (m) => {
    if (m.type() === 'error' && !/\[API Error\]|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  const strategyRow = {
    strategy_id: 'sid-351', name: 'E2E Fuera de calendario', description: null, latest_version: 1,
    created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z', spec: SPEC,
    template_slug: null, template_version: null,
  };
  await page.route('**/templates/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/templates/', (route) => route.fulfill({ json: [] }));
  await page.route('**/backtests/*', (route) => {
    const jobId = new URL(route.request().url()).pathname.split('/').pop();
    return route.fulfill({ json: { job_id: jobId, status: 'done', error: null, result: RESULT } });
  });
  await page.route('**/backtests/*/rebalances', (route: Route) =>
    route.fulfill({ json: { items: legacy ? LEGACY_ROWS : ROWS, total: 3, summary: summary(legacy) } }),
  );
  await page.route('**/backtests/*/rebalances/*', (route: Route) => {
    const d = detailFor(Number(new URL(route.request().url()).pathname.split('/').pop()), legacy);
    return d ? route.fulfill({ json: d }) : route.fulfill({ status: 404, json: { detail: 'not found' } });
  });
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST' && url.pathname.endsWith('/backtest')) {
      await route.fulfill({ json: { job_id: 'j1', status: 'done', cached: true } });
      return;
    }
    await route.fulfill({ json: [strategyRow] });
  });
  return errors;
}

async function openRebalancesTab(page: Page): Promise<void> {
  await page.goto('/dashboard/builder');
  await page.locator('.sb-card', { hasText: 'E2E Fuera de calendario' }).locator('button[title="Backtest"]').click();
  await expect(page.getByTestId('sb-results')).toBeVisible();
  await page.getByTestId('sb-tab-rebalances').click();
  await expect(page.getByTestId('sb-rb-table')).toBeVisible();
}

async function openDetail(page: Page, seq: number): Promise<void> {
  await page.locator(`[data-testid="sb-rb-row"][data-seq="${seq}"]`).getByTestId('sb-rb-date').click();
  await expect(page.getByTestId('sb-rb-detail')).toContainText(`Rebalanceo ${seq + 1} de 3`);
}

const SHOT_DIR = process.env.SHOT_DIR;
/** Capturas para el PR (sólo con SHOT_DIR): la página y, si se pide, un
 *  elemento — el detalle hace scroll dentro de su panel, así que la sección de
 *  salidas se captura por elemento. */
async function shot(page: Page, name: string, testId?: string): Promise<void> {
  if (!SHOT_DIR) return;
  if (testId) {
    const el = page.getByTestId(testId);
    await el.scrollIntoViewIfNeeded();
    await el.screenshot({ path: `${SHOT_DIR}/${name}.png` });
  } else {
    await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
  }
}

/** The metric card whose label is exactly `label`. */
const card = (page: Page, label: string) =>
  page.getByTestId('sb-rb-metric').filter({ has: page.locator('.mk', { hasText: new RegExp(`^${label}$`) }) });

test.describe('Builder — P&L de las salidas fuera de calendario (#351)', () => {
  test('(a) las salidas desde el rebalanceo anterior traen su P&L y suman en el total', async ({ page }) => {
    await seedAuth(page);
    const errors = await mockApi(page);
    await openRebalancesTab(page);
    await openDetail(page, 1);

    const stops = page.getByTestId('sb-rb-stops');
    await expect(stops).toContainText('Desde el rebalanceo anterior');
    const rows = stops.getByTestId('sb-rb-exit-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('BBB');
    await expect(rows.nth(0).locator('.sb-chip')).toHaveText('stop_loss');
    await expect(rows.nth(0)).toContainText('2024-01-04');
    await expect(rows.nth(0)).toContainText('$90.00'); // costo medio
    await expect(rows.nth(0)).toContainText('$80.00'); // precio de venta
    await expect(rows.nth(0)).toContainText('-$1,000');
    await expect(rows.nth(0)).toContainText('-11.1%');
    await expect(rows.nth(1)).toContainText('CCC');
    await expect(rows.nth(1).locator('.sb-chip')).toHaveText('trailing_stop_atr');
    await expect(rows.nth(1)).toContainText('-$500');
    // total de la tabla = realized_pnl_off_calendar
    await expect(page.getByTestId('sb-rb-stops-table-total')).toContainText('-$1,500');
    await expect(page.getByTestId('sb-rb-stops-after')).toHaveCount(0);
    await expect(page.getByTestId('sb-rb-stops-legacy')).toHaveCount(0);

    // tarjeta: total = rebalanceo + fuera de calendario
    await expect(page.getByTestId('sb-rb-metric')).toHaveCount(8);
    const pnl = card(page, 'P&L realizado');
    await expect(pnl.locator('.mv')).toHaveText('-$1,260');
    await expect(pnl.locator('.mv')).toHaveClass(/neg/);
    await expect(pnl.getByTestId('sb-rb-pnl-split')).toHaveText('rebalanceo $240 · fuera de calendario -$1,500');
    await shot(page, 'detalle-tarjetas-1280', 'sb-rb-metrics');
    await shot(page, 'detalle-salidas-1280', 'sb-rb-stops');
    expect(errors).toEqual([]);
  });

  test('(b) la acción que salió por stop lleva su motivo en «Después»', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await openRebalancesTab(page);
    await openDetail(page, 0);
    const after = page.getByTestId('sb-rb-after');
    const bbb = after.locator('tbody tr', { hasText: 'BBB' });
    await expect(bbb.getByTestId('sb-rb-exit-chip')).toHaveText('stop_loss');
    await expect(bbb).toContainText('-11.1%');
    await expect(after.locator('tbody tr', { hasText: 'AAA' }).getByTestId('sb-rb-exit-chip')).toHaveCount(0);
  });

  test('(c) el último rebalanceo muestra la cola aparte y no la suma en la tarjeta', async ({ page }) => {
    await seedAuth(page);
    const errors = await mockApi(page);
    await openRebalancesTab(page);
    await openDetail(page, 2);

    const stops = page.getByTestId('sb-rb-stops');
    await expect(stops).toContainText('Ninguna desde el rebalanceo anterior.');
    await expect(page.getByTestId('sb-rb-stops-table')).toHaveCount(0);
    const tail = page.getByTestId('sb-rb-stops-after');
    await expect(tail).toContainText('Posteriores a este rebalanceo');
    await expect(tail).toContainText('no suman en el P&L de este rebalanceo');
    await expect(tail.getByTestId('sb-rb-exit-row')).toHaveCount(1);
    await expect(tail.getByTestId('sb-rb-exit-row')).toContainText('DDD');
    await expect(page.getByTestId('sb-rb-stops-after-table-total')).toContainText('-$400');

    const pnl = card(page, 'P&L realizado');
    await expect(pnl.locator('.mv')).toHaveText('$100'); // sin los −400 de la cola
    await expect(pnl.getByTestId('sb-rb-pnl-split')).toHaveText('rebalanceo $100 · fuera de calendario $0');
    await shot(page, 'detalle-ultimo-con-cola-1280', 'sb-rb-stops');
    expect(errors).toEqual([]);
  });

  test('(d) un rebalanceo sin salidas muestra el texto de vacío', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await openRebalancesTab(page);
    await openDetail(page, 0);
    const stops = page.getByTestId('sb-rb-stops');
    await expect(stops).toContainText('Ninguna desde el rebalanceo anterior.');
    await expect(stops.getByTestId('sb-rb-exit-row')).toHaveCount(0);
    await expect(page.getByTestId('sb-rb-stops-table-total')).toHaveCount(0);
    await expect(page.getByTestId('sb-rb-stops-after')).toHaveCount(0);
  });

  test('(e) un resultado anterior al cambio cae a la lista vieja con el aviso', async ({ page }) => {
    await seedAuth(page);
    const errors = await mockApi(page, { legacy: true });
    await openRebalancesTab(page);
    await openDetail(page, 0);

    const stops = page.getByTestId('sb-rb-stops');
    await expect(stops.locator('li')).toHaveCount(2);
    await expect(stops).toContainText('BBB');
    await expect(stops.locator('.sb-chip')).toHaveText(['stop_loss', 'trailing_stop_atr']);
    await expect(page.getByTestId('sb-rb-stops-legacy')).toContainText('Vuelve a correr el backtest');
    await expect(page.getByTestId('sb-rb-stops-table')).toHaveCount(0);
    // la tarjeta vieja, con lo que el resultado tenga
    await expect(card(page, 'P&L realizado en las salidas').locator('.mv')).toHaveText('$0');
    await expect(page.getByTestId('sb-rb-pnl-split')).toHaveCount(0);
    await expect(page.getByTestId('sb-rb-exit-chip')).toHaveCount(0);
    await shot(page, 'detalle-resultado-antiguo-1280', 'sb-rb-stops');
    expect(errors).toEqual([]);
  });

  test('(f) el índice muestra el P&L realizado por fila y el total', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await openRebalancesTab(page);
    await expect(page.getByTestId('sb-rb-table').locator('thead')).toContainText('P&L realizado');
    const cell = (seq: number) => page.locator(`[data-testid="sb-rb-row"][data-seq="${seq}"]`).getByTestId('sb-rb-realized');
    await expect(cell(0)).toHaveText('$0');
    await expect(cell(1)).toHaveText('-$1,260');
    await expect(cell(1)).toHaveClass(/neg/);
    await expect(cell(2)).toHaveText('$100');
    const total = page.getByTestId('sb-rb-card-realized');
    await expect(total.locator('.mv')).toHaveText('-$1,560');
    await expect(total.locator('.msub')).toHaveText('rebalanceos $340 · fuera de calendario -$1,900');
    await expect(page.locator('.sb-rb-foot')).toContainText('desde el rebalanceo anterior');
    await shot(page, 'indice-1280');
  });

  test('(f2) índice de un resultado antiguo: la columna muestra lo que hay y no hay tarjeta de total', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, { legacy: true });
    await openRebalancesTab(page);
    await expect(page.getByTestId('sb-rb-card-realized')).toHaveCount(0);
    await expect(
      page.locator('[data-testid="sb-rb-row"][data-seq="1"]').getByTestId('sb-rb-realized'),
    ).toHaveText('$240');
  });

  test('(g) a 390 px el detalle con salidas no desborda', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedAuth(page);
    await mockApi(page);
    await openRebalancesTab(page);
    await openDetail(page, 1);
    await expect(page.getByTestId('sb-rb-exit-row')).toHaveCount(2);
    // las columnas anchas se ocultan; el P&L sigue visible
    await expect(page.getByTestId('sb-rb-stops-table').locator('th', { hasText: 'Costo medio' })).toBeHidden();
    await expect(page.getByTestId('sb-rb-stops-table').locator('th', { hasText: /^P&L$/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await shot(page, 'detalle-salidas-390', 'sb-rb-stops');
  });
});
