import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * E2E de #310 (backend) — subpanel «Hold conditions» (`spec.hold_filters`) en
 * la Sección 8 del Strategy Builder, más las etiquetas nuevas del selection
 * trace (`retained_by_hold_filters`) y del drift del tracker
 * (`left_hold_filters` + `detail`). API mockeada por rutas: mismo arnés que
 * builder-rebalance-rules.spec.ts (edición → PUT), builder-13-min-weight
 * (estrategia nueva → POST), builder-funnel (trace) y tracker-8-drift (drift).
 *
 * Lo que se protege, por orden de importancia:
 *   1. Sin condiciones de permanencia el spec NO lleva la clave `hold_filters`
 *      (el backend la popea de canonical_json; omitirla deja el content_hash
 *      de las estrategias existentes intacto y el JSON guardado mínimo).
 *   2. Con condiciones, viajan en las MISMAS unidades que el universo
 *      (`rating ≥ -1` → `{ rating: { min: -1 } }`, número).
 *   3. La vuelta: un spec con `hold_filters` llena el subpanel, marca lo que
 *      difiere del universo y se re-guarda sin pérdida.
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
  rebalance: { cadence: 'monthly', prioritize_held: true },
  costs: { commission_bps: 5, slippage_bps: 8 },
  validation: { start: '2024-01-02', end: '2024-06-28', oos_split: 0.2, min_n_trades: 30 },
};

const HOLD_FILTERS = { country: ['US'], rating: { min: -1 }, sm_long_points: { min: 3 } };

const HYSTERESIS_WARNING =
  'hold_filters is defined but neither prioritize_held nor hold_rank_buffer is set — hysteresis may churn';

const DONE_RESULT = {
  job_id: 'j1',
  status: 'done',
  error: null,
  warnings: [HYSTERESIS_WARNING],
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

function traceRow(p: {
  symbol_id: string; ticker: string; rank: number | null; score: number | null;
  exit_stage: string | null; reason: string | null; weight_pct: number | null;
}) {
  return { ...p, name: `${p.ticker} Inc.`, sector: 'Technology' };
}

const TRACE_RESPONSE = {
  as_of: '2026-08-03',
  sort_by: 'rating',
  candidates_count: 6,
  total: 4,
  truncated: false,
  stages: [
    { key: 'universe', count: 3, dropped_from_prev: 3, applies: true },
    { key: 'selection_rules', count: 3, dropped_from_prev: 1, applies: true },
    { key: 'ranking', count: 3, dropped_from_prev: 0, applies: true },
    { key: 'weighting', count: 3, dropped_from_prev: 0, applies: false },
    { key: 'execution', count: 3, dropped_from_prev: 0, applies: true },
  ],
  rows: [
    traceRow({ symbol_id: 's1', ticker: 'AAA', rank: 1, score: 3, exit_stage: null, reason: null, weight_pct: 40 }),
    traceRow({ symbol_id: 's2', ticker: 'BBB', rank: 2, score: 2, exit_stage: null, reason: null, weight_pct: 30 }),
    traceRow({ symbol_id: 's3', ticker: 'HLD', rank: 3, score: 0, exit_stage: null, reason: 'retained_by_hold_filters', weight_pct: 30 }),
    traceRow({ symbol_id: 's4', ticker: 'OUT', rank: null, score: null, exit_stage: 'selection_rules', reason: 'failed_hold_filters', weight_pct: null }),
  ],
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

/** Builder API: `GET /strategies/` answers `rows`; POST/PUT are recorded. */
async function mockBuilderApi(page: Page, rows: Record<string, unknown>[]): Promise<RecordedCall[]> {
  const calls: RecordedCall[] = [];
  await page.route('**/templates/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/templates/', (route) => route.fulfill({ json: [] }));
  await page.route('**/backtests/*/selection-trace', (route) => route.fulfill({ json: TRACE_RESPONSE }));
  await page.route('**/backtests/*', (route) => route.fulfill({ json: DONE_RESULT }));
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname.endsWith('/resolve-universe')) {
      await route.fulfill({
        json: {
          as_of: '2026-07-10', alpha_window: '12m', alpha_metric: 'return', alpha_pit_safe: true,
          base_method: 'equal', total_market_cap: 0, eligible_count: 0, coverage_pct: 1, sectors: [],
        },
      });
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

function strategyRow(sid: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    strategy_id: sid,
    name,
    description: null,
    latest_version: 1,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-02T00:00:00Z',
    spec: { ...BASE_SPEC, ...extra },
    template_slug: null,
    template_version: null,
  };
}

const holdPanel = (page: Page): Locator => page.getByTestId('sb-hold-filters');

async function openNewStrategy(page: Page, name: string): Promise<void> {
  await page.goto('/dashboard/builder');
  await page.getByRole('button', { name: 'New strategy' }).first().click();
  await page.getByPlaceholder('Strategy name').fill(name);
}

/** Opens the (collapsed-when-empty) subpanel if it isn't open yet. */
async function expandHoldPanel(page: Page): Promise<void> {
  const toggle = page.getByTestId('sb-hold-filters-toggle');
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function addRangeFilter(page: Page, box: Locator, fieldLabel: string, min: string): Promise<void> {
  await box.locator('.sb-fund-add select').first().selectOption({ label: fieldLabel });
  await page.getByLabel('Minimum').fill(min);
  await page.getByRole('button', { name: 'Apply' }).click();
}

async function postedSpec(calls: RecordedCall[]): Promise<Record<string, unknown>> {
  await expect
    .poll(() => calls.filter((c) => c.method === 'POST' && c.path.endsWith('/strategies/')).length)
    .toBeGreaterThan(0);
  const created = calls.find((c) => c.method === 'POST' && c.path.endsWith('/strategies/'));
  return created?.body?.spec as Record<string, unknown>;
}

test.describe('Builder — condiciones de permanencia (hold_filters, #310)', () => {
  test('(a) una condición rating ≥ -1 viaja como spec.hold_filters.rating.min = -1', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockBuilderApi(page, []);
    await openNewStrategy(page, 'E2E Hold rating');

    await expandHoldPanel(page);
    await expect(holdPanel(page)).toContainText(
      'A name already in the book stays while it passes the universe filters OR these conditions.',
    );
    await addRangeFilter(page, holdPanel(page), 'Rating', '-1');
    await expect(holdPanel(page).locator('[data-filter-key="rating"]')).toBeVisible();

    await page.getByRole('button', { name: 'Save & backtest' }).click();
    const spec = await postedSpec(calls);
    expect(spec.hold_filters).toEqual({ rating: { min: -1 } });
    // El universo no se contamina con la condición de permanencia.
    expect((spec.universe as Record<string, unknown>).rating).toBeUndefined();
  });

  test('(b) sin tocar el subpanel el spec no lleva la clave hold_filters', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockBuilderApi(page, []);
    await openNewStrategy(page, 'E2E Hold none');

    await page.getByRole('button', { name: 'Save & backtest' }).click();
    const spec = await postedSpec(calls);
    expect('hold_filters' in spec).toBe(false);
  });

  test('(b2) re-guardar una estrategia sin hold_filters no gana la clave', async ({ page }) => {
    await seedAuth(page);
    const name = 'E2E Hold legacy';
    const calls = await mockBuilderApi(page, [strategyRow('sid-legacy', name)]);
    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: name }).locator('button[title="Edit"]').click();
    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect(page.getByTestId('sb-results')).toBeVisible();

    const put = calls.find((c) => c.method === 'PUT');
    expect('hold_filters' in (put?.body?.spec as Record<string, unknown>)).toBe(false);
  });

  test('(c) un spec con hold_filters llena el subpanel, marca lo que difiere y vuelve sin pérdida', async ({ page }) => {
    await seedAuth(page);
    const name = 'E2E Hold load';
    const calls = await mockBuilderApi(page, [strategyRow('sid-hold', name, { hold_filters: HOLD_FILTERS })]);
    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: name }).locator('button[title="Edit"]').click();

    const panel = holdPanel(page);
    await expect(page.getByTestId('sb-hold-filters-toggle')).toHaveAttribute('aria-expanded', 'true');
    const rating = panel.locator('[data-filter-key="rating"]');
    const country = panel.locator('[data-filter-key="country"]');
    const smLong = panel.locator('[data-filter-key="sm_long_points"]');
    await expect(rating).toContainText('Rating');
    await expect(rating).toContainText('-1');
    await expect(country).toContainText('US');
    await expect(smLong).toContainText('3');
    // rating: universo min 1, permanencia min -1 → difiere. country: igual.
    await expect(rating).toHaveAttribute('data-differs', 'true');
    await expect(rating).toHaveClass(/sb-hold-differs/);
    await expect(country).toHaveAttribute('data-differs', 'false');

    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect(page.getByTestId('sb-results')).toBeVisible();
    const put = calls.find((c) => c.method === 'PUT');
    expect((put?.body?.spec as Record<string, unknown>).hold_filters).toEqual(HOLD_FILTERS);
  });

  test('(d) «Copy from universe» replica las reglas del universo', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockBuilderApi(page, []);
    await openNewStrategy(page, 'E2E Hold copy');

    await addRangeFilter(page, page.locator('.sb-field', { hasText: 'Additional rules' }), 'Rating', '1');
    await expandHoldPanel(page);
    await page.getByTestId('sb-hold-copy-universe').click();

    const panel = holdPanel(page);
    await expect(panel.locator('[data-filter-key="country"]')).toContainText('US');
    await expect(panel.locator('[data-filter-key="rating"]')).toContainText('1');
    // Recién copiadas, ninguna difiere.
    await expect(panel.locator('[data-differs="true"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Save & backtest' }).click();
    const spec = await postedSpec(calls);
    expect(spec.hold_filters).toEqual(spec.universe);
    expect(spec.hold_filters).toEqual({ country: ['US'], rating: { min: 1 } });
  });

  test('(e1) el trace etiqueta retained_by_hold_filters / failed_hold_filters y el warning del linter se ve', async ({ page }) => {
    await seedAuth(page);
    const name = 'E2E Hold trace';
    await mockBuilderApi(page, [strategyRow('sid-trace', name, { hold_filters: HOLD_FILTERS })]);
    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: name }).locator('button[title="Backtest"]').click();
    await expect(page.getByTestId('sb-results')).toBeVisible();
    await expect(page.getByTestId('sb-backtest-warnings')).toContainText(HYSTERESIS_WARNING);

    await page.getByTestId('sb-tab-selection').click();
    await expect(page.getByTestId('sb-selection-trace')).toBeVisible();
    const held = page.locator('table.tbl tbody tr', { hasText: 'HLD' });
    await expect(held).toContainText('Retained by the hold conditions');
    await expect(held).not.toContainText('retained_by_hold_filters');

    await page.getByTestId('sb-stage-universe').click();
    const out = page.locator('table.tbl tbody tr', { hasText: 'OUT' });
    await expect(out).toContainText('Failed the hold conditions');
  });

  test('(e2) el drift etiqueta left_hold_filters con el detail entre paréntesis', async ({ page }) => {
    const STRATEGY_ID = '33333333-3333-3333-3333-333333333333';
    await seedAuth(page);
    await page.route('**/portfolios/*/positions*', (route) =>
      route.fulfill({ json: { items: [], total: 0, limit: 200, offset: 0 } }),
    );
    await page.route('**/portfolios/*/performance/curve*', (route) =>
      route.fulfill({
        json: {
          portfolio_id: 'x', benchmark: 'SPY', return_basis: 'total_return', base_mode: 'index_100',
          base: 100, benchmark_available: false, start_date: null, end_date: null, points: [],
        },
      }),
    );
    const drift = {
      as_of: '2026-07-09',
      data_as_of: '2026-07-08',
      next_rebalance_date: '2026-07-15',
      coverage_pct: '0.93',
      total_value: '112345.67',
      cash: '512.34',
      entries: [],
      exits: [
        { symbol_id: 'x1', ticker: 'INTC', shares: '120', current_weight_pct: '2.8', stale: false, reason: 'left_hold_filters', detail: 'rating >= -1' },
        { symbol_id: 'x2', ticker: 'CSCO', shares: '50', current_weight_pct: '1.1', stale: false, reason: 'fell_out_of_top_n', detail: null },
        { symbol_id: 'x3', ticker: 'IBM', shares: '10', current_weight_pct: '0.9', stale: false, reason: 'some_future_code' },
      ],
      weight_drift: [],
      warnings: [],
    };
    await page.route('**/strategies/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/tracker/drift')) {
        await route.fulfill({ json: drift });
        return;
      }
      if (url.pathname.endsWith('/tracker') && route.request().method() === 'GET') {
        await route.fulfill({
          json: {
            tracker_id: '44444444-4444-4444-4444-444444444444',
            strategy_id: STRATEGY_ID,
            strategy_version_id: '55555555-5555-5555-5555-555555555555',
            portfolio_id: '66666666-6666-6666-6666-666666666666',
            status: 'active',
            initial_cash: '100000.00',
            started_at: '2026-01-02',
            last_rebalance_date: '2026-07-01',
            next_rebalance_date: '2026-07-15',
            last_evaluated_date: '2026-07-08',
            force_rebalance: false,
            notifications_enabled: true,
            last_error: null,
            created_at: '2026-01-02T00:00:00Z',
          },
        });
        return;
      }
      if (url.pathname.endsWith('/holdings')) {
        await route.fulfill({ json: { data_as_of: '2026-07-08', warnings: [], holdings: [] } });
        return;
      }
      await route.fulfill({ status: 404, json: { detail: 'Not mocked' } });
    });
    await page.goto(`/dashboard/strategy/${STRATEGY_ID}`);

    const exits = page.getByTestId('drift-exits');
    await expect(exits).toContainText('Salió: no cumplió la permanencia (rating >= -1)');
    await expect(exits).toContainText('Cayó del top-N');
    await expect(exits).not.toContainText('left_hold_filters');
    await expect(exits).not.toContainText('fell_out_of_top_n');
    await expect(exits).not.toContainText('some_future_code');
    await expect(exits).toContainText('Some future code');
  });
});
