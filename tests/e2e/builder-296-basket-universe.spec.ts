import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * E2E issue #296 — builder con «Universe source: Filters | Basket», método
 * «Index weight» (`basket_weight`), badge/warnings en resultados, columna
 * «Index weight» en el selection trace y «Index wt» en las posiciones del
 * tracker. API mockeada por `page.route` contra los contratos del backend
 * (`app/schemas/strategy.py`, `backtest.py`, `selection_trace.py`,
 * `strategy_holdings.py`, `basket.py`).
 *
 * Oráculos (docs/loops-history/issue-296/design.md):
 *  1. payload: «Filters» byte-idéntico al snapshot pre-#296 (el string de
 *     abajo se grabó contra el código de `feat/baskets-295` @ 3340a71 y este
 *     test pasa también ahí); «Basket» = `{ basket_id }` sin `country`;
 *     `mergeSpecPreserving` no reinyecta `country`.
 *  2. carga de una estrategia con / sin `basket_id`.
 *  3. «Index weight» deshabilitado sin basket; reset a equal con aviso.
 *  4. resultados: badge, warnings, columna «Index weight»; legado sin NaN.
 *  5. preview: `resolve-universe` con `basket_id`; 422 → error en el selector.
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

const SP500_ID = '5b500000-0000-4000-8000-000000000500';
const MY_ID = 'a1a1a1a1-0000-4000-8000-0000000000a1';

const SP500_ITEM = {
  basket_id: SP500_ID,
  slug: 'sp500',
  kind: 'index',
  name: 'S&P 500',
  description: 'S&P 500 constituents (FMP)',
  is_system: true,
  member_count: 503,
  weights_as_of: '2026-10-22',
  updated_at: '2026-10-22T06:00:00Z',
};

const MY_ITEM = {
  basket_id: MY_ID,
  slug: null,
  kind: 'user',
  name: 'Mis AI',
  description: 'AI hardware',
  is_system: false,
  member_count: 2,
  weights_as_of: null,
  updated_at: '2026-10-20T12:00:00Z',
};

/** Snapshot pre-#296 del spec que guarda una estrategia NUEVA con «Filters» y
 *  la talla «Large» elegida (nombre aparte: no va en el spec). Grabado con el
 *  código de 3340a71 (`cfgToSpec(DEFAULT_CONFIG)` + `market_cap_category`). */
const FILTERS_SNAPSHOT =
  '{"general":{"instrument_type":"stocks","currency":"USD","benchmark":"SPY","performance_metric":"total_return"},' +
  '"universe":{"country":["US"],"market_cap_category":["large"]},' +
  '"entry_exit":{"mode":"trade_state","min_er":0.3,"max_sm_atr_mult":10,"atr_spike_mult":2,"trail_atr_mult":3,"emergency_atr_mult":4,"exit_rating_long":-1,"exit_rating_short":1,"use_trail_stop":true},' +
  '"selection":{"sort_by":"rating","sort_order":"desc","top_n":25,"per_sector":null},' +
  '"weighting":{"method":"equal"},' +
  '"rebalance":{"cadence":"monthly","min_trade_pct":0.005},' +
  '"costs":{"commission_bps":5,"slippage_bps":8},' +
  '"validation":{"start":"2019-01-01","end":"2024-01-01","oos_split":0.2,"min_n_trades":30}}';

const BASE_SPEC = {
  general: { instrument_type: 'stocks', currency: 'USD', benchmark: 'SPY', performance_metric: 'total_return' },
  universe: { country: ['US'] } as Record<string, unknown>,
  entry_exit: {
    mode: 'trade_state', min_er: 0.3, max_sm_atr_mult: 10, atr_spike_mult: 2,
    trail_atr_mult: 3, emergency_atr_mult: 4, exit_rating_long: -1, exit_rating_short: 1,
    use_trail_stop: false,
  },
  selection: { sort_by: 'rating', sort_order: 'desc', top_n: 25 },
  weighting: { method: 'equal' } as Record<string, unknown>,
  rebalance: { cadence: 'monthly' },
  costs: { commission_bps: 5, slippage_bps: 8 },
  validation: { start: '2024-01-02', end: '2024-06-28', oos_split: 0.2, min_n_trades: 30 },
};

function strategyRow(sid: string, name: string, universe: Record<string, unknown>, weighting = { method: 'equal' }) {
  return {
    strategy_id: sid,
    name,
    description: null,
    latest_version: 1,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-02T00:00:00Z',
    spec: { ...BASE_SPEC, universe, weighting },
    template_slug: null,
    template_version: null,
  };
}

const BASKET_ROW = strategyRow('sid-basket', 'E2E Basket Strategy', { basket_id: MY_ID });
const FILTERS_ROW = strategyRow('sid-filters', 'E2E Filters Strategy', {
  country: ['US'],
  dividend_yield: { min: 0.01 }, // live-only: el merge debe preservarlo
});

const RESULT = {
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
};

function traceRow(ticker: string, rank: number, extra: Record<string, unknown> = {}) {
  return {
    symbol_id: `sym-${ticker}`,
    ticker,
    name: `${ticker} Inc.`,
    sector: 'Technology',
    score: 3,
    rank,
    exit_stage: null,
    reason: null,
    weight_pct: 50,
    ...extra,
  };
}

function trace(rows: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
  return {
    as_of: '2024-06-03',
    sort_by: 'rating',
    candidates_count: 2,
    total: rows.length,
    truncated: false,
    stages: [
      { key: 'universe', count: rows.length, dropped_from_prev: 0, applies: true },
      { key: 'selection_rules', count: rows.length, dropped_from_prev: 0, applies: false },
      { key: 'ranking', count: rows.length, dropped_from_prev: 0, applies: true },
      { key: 'weighting', count: rows.length, dropped_from_prev: 0, applies: true },
      { key: 'execution', count: rows.length, dropped_from_prev: 0, applies: true },
    ],
    rows,
    ...extra,
  };
}

const TRACE_BASKET = trace(
  [traceRow('NVDA', 1, { index_weight: 7.776316 }), traceRow('AMD', 2, { index_weight: null })],
  {
    universe_source: { type: 'basket', basket_id: MY_ID, name: 'Mis AI', kind: 'user' },
    weights_source: 'ssga_spy',
  },
);
/** Trace legado (pre-#292/#294): sin `universe_source`, sin `index_weight`. */
const TRACE_LEGACY = trace([traceRow('AAPL', 1), traceRow('MSFT', 2)]);

const RESOLVE_OK = {
  as_of: '2026-10-22',
  eligible_count: 2,
  coverage_pct: 1,
  sectors: [{ sector: 'Technology', member_count: 2, alpha_coverage: 2, base_weight_pct: 100, alpha_vs_spy: 1 }],
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
  await page.route('**/alerts/events/**', (route) => route.fulfill({ json: { count: 0 } }));
  await page.route('**/templates/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/templates/', (route) => route.fulfill({ json: [] }));
}

function preflight(route: Route) {
  return route.fulfill({
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': '*',
    },
  });
}

interface MockOpts {
  list?: Record<string, unknown>[];
  /** GET /backtests/{job} → status response (by job id). */
  jobs?: Record<string, Record<string, unknown>>;
  traces?: Record<string, Record<string, unknown>>;
  /** Make resolve-universe answer 422 basket_not_found. */
  resolve422?: boolean;
}

async function mockApi(page: Page, opts: MockOpts = {}): Promise<{ calls: Recorded[] }> {
  const calls: Recorded[] = [];

  // Baskets: matcher por pathname (patrón de baskets-295) — un glob
  // `**/baskets/**` interceptaría los módulos de Vite de src/features/baskets.
  await page.route((url) => /^(\/api\/v1)?\/baskets(\/|$)/.test(url.pathname), async (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    return route.fulfill({ json: [SP500_ITEM, MY_ITEM] });
  });

  await page.route((url) => /^(\/api\/v1)?\/backtests\//.test(url.pathname), async (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
    const m = path.match(/^\/backtests\/([^/]+)(\/selection-trace)?$/);
    const job = m?.[1] ?? '';
    if (m?.[2]) {
      const t = opts.traces?.[job];
      return t ? route.fulfill({ json: t }) : route.fulfill({ status: 404, json: { detail: 'no trace' } });
    }
    const st = opts.jobs?.[job] ?? { job_id: job, status: 'running', error: null, result: null };
    return route.fulfill({ json: st });
  });

  await page.route('**/strategies/**', async (route) => {
    const req = route.request();
    const method = req.method();
    if (method === 'OPTIONS') return preflight(route);
    const url = new URL(req.url());
    const body = method === 'POST' || method === 'PUT' ? (req.postDataJSON() as Record<string, unknown>) : null;
    calls.push({ method, path: url.pathname, body });
    if (url.pathname.endsWith('/resolve-universe')) {
      const universe = (body?.universe ?? {}) as Record<string, unknown>;
      if (opts.resolve422 && universe.basket_id) {
        return route.fulfill({
          status: 422,
          json: { detail: { code: 'basket_not_found', basket_id: universe.basket_id } },
        });
      }
      return route.fulfill({ json: RESOLVE_OK });
    }
    if (method === 'POST' && url.pathname.endsWith('/backtest')) {
      const sid = url.pathname.split('/').slice(-2)[0];
      return route.fulfill({ json: { job_id: `job-${sid}`, status: 'queued', cached: false } });
    }
    if (method === 'POST') {
      return route.fulfill({ status: 201, json: { strategy_id: 'new-1', version: 1, name: 'x' } });
    }
    if (method === 'PUT') {
      const sid = url.pathname.split('/').filter(Boolean).pop();
      return route.fulfill({ json: { strategy_id: sid, version: 2, name: 'x' } });
    }
    return route.fulfill({ json: opts.list ?? [] });
  });

  return { calls };
}

async function openNew(page: Page, name: string): Promise<void> {
  await page.goto('/dashboard/builder');
  await page.getByRole('button', { name: 'New strategy' }).first().click();
  await page.getByPlaceholder('Strategy name').fill(name);
}

async function chooseBasket(page: Page, basketId: string): Promise<void> {
  await page.getByTestId('sb-universe-source-basket').check();
  const select = page.getByTestId('sb-basket-select');
  await expect(select.locator(`option[value="${basketId}"]`)).toHaveCount(1);
  await select.selectOption(basketId);
}

async function saveAndBacktest(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Save & backtest/ }).click();
}

function savedSpec(calls: Recorded[], method: 'POST' | 'PUT'): Record<string, unknown> | undefined {
  const c = calls.find(
    (x) =>
      x.method === method &&
      (method === 'POST' ? x.path.endsWith('/strategies/') : /\/strategies\/[^/]+$/.test(x.path)),
  );
  return c?.body?.spec as Record<string, unknown> | undefined;
}

test.describe('Builder — universo desde un basket (#296)', () => {
  test('oráculo 1a — «Filters»: el payload es byte-idéntico al snapshot pre-#296', async ({ page }) => {
    await seedAuth(page);
    const { calls } = await mockApi(page);
    await openNew(page, 'E2E 296 Filters');
    await page.locator('.sb-size-pill', { hasText: 'Large' }).click();
    await saveAndBacktest(page);
    await expect.poll(() => savedSpec(calls, 'POST')).toBeTruthy();
    expect(JSON.stringify(savedSpec(calls, 'POST'))).toBe(FILTERS_SNAPSHOT);
  });

  test('oráculo 1b — «Basket»: universe = { basket_id } sin country ni company size', async ({ page }) => {
    await seedAuth(page);
    const { calls } = await mockApi(page);
    await openNew(page, 'E2E 296 Basket');
    await page.locator('.sb-size-pill', { hasText: 'Large' }).click();
    await chooseBasket(page, SP500_ID);
    // Instrument / Country / Company size se ocultan con basket.
    await expect(page.getByTestId('sb-country-locked')).toHaveCount(0);
    await expect(page.locator('.sb-size-pill')).toHaveCount(0);
    await saveAndBacktest(page);
    await expect.poll(() => savedSpec(calls, 'POST')).toBeTruthy();
    const spec = savedSpec(calls, 'POST')!;
    expect(spec.universe).toEqual({ basket_id: SP500_ID });
    expect(spec.weighting).toEqual({ method: 'equal' });
  });

  test('oráculo 1c — editar una estrategia «Filters» a «Basket»: el merge no reinyecta country y preserva lo live-only', async ({ page }) => {
    await seedAuth(page);
    const { calls } = await mockApi(page, { list: [FILTERS_ROW] });
    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: 'E2E Filters Strategy' }).locator('button[title="Edit"]').click();
    await chooseBasket(page, MY_ID);
    await saveAndBacktest(page);
    await expect.poll(() => savedSpec(calls, 'PUT')).toBeTruthy();
    const universe = savedSpec(calls, 'PUT')!.universe as Record<string, unknown>;
    expect(universe).toEqual({ basket_id: MY_ID, dividend_yield: { min: 0.01 } });
  });

  test('oráculo 2 — carga: con basket_id → «Basket» + nombre; sin → «Filters» y país bloqueado', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, { list: [BASKET_ROW, FILTERS_ROW] });
    await page.goto('/dashboard/builder');

    await page.locator('.sb-card', { hasText: 'E2E Basket Strategy' }).locator('button[title="Edit"]').click();
    await expect(page.getByTestId('sb-universe-source-basket')).toBeChecked();
    await expect(page.getByTestId('sb-basket-select').locator('option:checked')).toHaveText(/Mis AI/);
    await expect(page.getByTestId('sb-basket-semantics')).toContainText('survivorship bias');
    await expect(page.getByRole('link', { name: 'Manage baskets' })).toHaveAttribute('href', '/dashboard/baskets');
    await expect(page.getByTestId('sb-country-locked')).toHaveCount(0);

    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.locator('.sb-card', { hasText: 'E2E Filters Strategy' }).locator('button[title="Edit"]').click();
    await expect(page.getByTestId('sb-universe-source-filters')).toBeChecked();
    await expect(page.getByTestId('sb-basket-select')).toHaveCount(0);
    const country = page.getByTestId('sb-country-locked').locator('select');
    await expect(country).toBeDisabled();
    await expect(country).toHaveValue('US');
  });

  test('oráculo 2b — un basket índice muestra la semántica de membresía histórica', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await openNew(page, 'E2E 296 Index');
    await chooseBasket(page, SP500_ID);
    await expect(page.getByTestId('sb-basket-semantics')).toContainText('historical membership at every rebalance');
    // Agrupado: sistema primero.
    const groups = page.getByTestId('sb-basket-select').locator('optgroup');
    await expect(groups.first()).toHaveAttribute('label', 'System');
    await expect(groups.nth(1)).toHaveAttribute('label', 'My baskets');
  });

  test('oráculo 3 — «Index weight»: deshabilitado sin basket, habilitado con basket, reset a equal con aviso', async ({ page }) => {
    await seedAuth(page);
    const { calls } = await mockApi(page);
    await openNew(page, 'E2E 296 Weight');
    const method = page.getByTestId('sb-weight-method');
    const idx = method.locator('option[value="basket_weight"]');
    await expect(idx).toBeDisabled();
    await expect(idx).toHaveAttribute('title', /needs a basket universe/);

    await chooseBasket(page, SP500_ID);
    await expect(idx).toBeEnabled();
    await method.selectOption('basket_weight');
    await expect(method).toHaveValue('basket_weight');

    await page.getByTestId('sb-universe-source-filters').check();
    await expect(method).toHaveValue('layered');
    await expect(page.getByTestId('sb-weight-reset-notice')).toBeVisible();

    // De vuelta a basket + Index weight → el payload lleva basket_weight y no layered.
    await chooseBasket(page, SP500_ID);
    await method.selectOption('basket_weight');
    await saveAndBacktest(page);
    await expect.poll(() => savedSpec(calls, 'POST')).toBeTruthy();
    const spec = savedSpec(calls, 'POST')!;
    expect(spec.weighting).toEqual({ method: 'basket_weight' });
    expect('layered' in spec).toBe(false);
    expect(spec.universe).toEqual({ basket_id: SP500_ID });
  });

  test('oráculo 4a — resultados con basket: badge, warnings y columna «Index weight»', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, {
      list: [BASKET_ROW],
      jobs: {
        'job-sid-basket': {
          job_id: 'job-sid-basket',
          status: 'done',
          error: null,
          result: RESULT,
          warnings: ['basket_user_static: el basket «Mis AI» es una lista propia: en todo el período se usa la lista de hoy'],
        },
      },
      traces: { 'job-sid-basket': TRACE_BASKET },
    });
    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: 'E2E Basket Strategy' }).locator('button[title="Backtest"]').click();
    await expect(page.getByTestId('sb-results')).toBeVisible();
    await expect(page.getByTestId('sb-universe-badge')).toHaveText('Universe: Basket · Mis AI');
    const warnings = page.getByTestId('sb-backtest-warnings');
    await expect(warnings).toBeVisible();
    await expect(warnings.getByTestId('sb-backtest-warning')).toHaveCount(1);
    await expect(warnings).toContainText('lista propia');

    await page.getByTestId('sb-tab-selection').click();
    await expect(page.getByTestId('sb-selection-trace')).toBeVisible();
    const table = page.getByTestId('sb-selection-trace').locator('table');
    await expect(table.locator('th', { hasText: 'Index weight' })).toHaveCount(1);
    await expect(table).toContainText('7.78%');
    await expect(page.getByTestId('sb-selection-trace')).not.toContainText(/undefined|NaN/);
  });

  test('oráculo 4b — resultado legado sin las claves nuevas: «Universe: Filters», sin warnings, sin NaN', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, {
      list: [FILTERS_ROW],
      jobs: {
        'job-sid-filters': { job_id: 'job-sid-filters', status: 'done', error: null, result: RESULT },
      },
      traces: { 'job-sid-filters': TRACE_LEGACY },
    });
    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: 'E2E Filters Strategy' }).locator('button[title="Backtest"]').click();
    await expect(page.getByTestId('sb-results')).toBeVisible();
    await expect(page.getByTestId('sb-universe-badge')).toHaveText('Universe: Filters');
    await expect(page.getByTestId('sb-backtest-warnings')).toHaveCount(0);
    await expect(page.getByTestId('sb-results')).not.toContainText(/undefined|NaN/);

    await page.getByTestId('sb-tab-selection').click();
    await expect(page.getByTestId('sb-selection-trace')).toBeVisible();
    await expect(page.getByTestId('sb-selection-trace').locator('th', { hasText: 'Index weight' })).toHaveCount(0);
    await expect(page.getByTestId('sb-selection-trace')).not.toContainText(/undefined|NaN/);
  });

  test('oráculo 5a — preview: elegir basket dispara resolve-universe con basket_id y sin country', async ({ page }) => {
    await seedAuth(page);
    const { calls } = await mockApi(page);
    await openNew(page, 'E2E 296 Preview');
    await chooseBasket(page, MY_ID);
    const resolves = () =>
      calls.filter((c) => c.path.endsWith('/resolve-universe')).map((c) => c.body?.universe as Record<string, unknown>);
    await expect.poll(() => resolves().some((u) => u?.basket_id === MY_ID)).toBe(true);
    const last = resolves().filter((u) => u?.basket_id === MY_ID).pop()!;
    expect('country' in last).toBe(false);
    await expect(page.getByTestId('sb-basket-error')).toHaveCount(0);
  });

  test('oráculo 5b — preview: 422 basket_not_found se muestra como error del selector', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, { resolve422: true });
    await openNew(page, 'E2E 296 Preview 422');
    await chooseBasket(page, MY_ID);
    await expect(page.getByTestId('sb-basket-error')).toBeVisible();
    await expect(page.getByTestId('sb-basket-error')).toContainText('Basket not found');
  });
});

// ---------------------------------------------------------------------------
// Tracker: columna «Index wt» en las posiciones (contrato 5).

const STRATEGY_ID = '33333333-3333-3333-3333-333333333333';
const TRACKER = {
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
  cash: '512.34',
};

function position(ticker: string, extra: Record<string, unknown> = {}) {
  return {
    symbol_id: `s-${ticker}`,
    ticker,
    name: `${ticker} Corp`,
    sector: 'Technology',
    country: 'US',
    quantity: '10',
    average_cost: '100.00',
    weight_pct: '50',
    entry_date: '2026-01-02',
    entry_rating: 1,
    current_price: '100.00',
    current_value: '1000.00',
    unrealized_pnl: '0',
    unrealized_pnl_pct: '0',
    current_rating: 1,
    rating_changed: false,
    price_source: 'nightly_close',
    ...extra,
  };
}

async function mockTracker(page: Page, items: Record<string, unknown>[]): Promise<void> {
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/tracker') && route.request().method() === 'GET') {
      return route.fulfill({ json: TRACKER });
    }
    if (url.pathname.endsWith('/holdings')) {
      return route.fulfill({ json: { data_as_of: '2026-07-08', warnings: [], holdings: [] } });
    }
    return route.fulfill({ status: 404, json: { detail: 'Not mocked' } });
  });
  await page.route('**/portfolios/*/positions*', (route) =>
    route.fulfill({ json: { items, total: items.length, limit: 200, offset: 0, quoted_at: null, warnings: [] } }),
  );
  await page.route('**/portfolios/*/performance/curve*', (route) =>
    route.fulfill({
      json: {
        portfolio_id: 'x', benchmark: 'SPY', return_basis: 'total_return', base_mode: 'index_100',
        base: 100, benchmark_available: false, start_date: null, end_date: null, points: [],
      },
    }),
  );
}

test.describe('Tracker — «Index wt» en posiciones (#296)', () => {
  test('con index_weight → columna «Index wt»; la fila sin peso muestra —', async ({ page }) => {
    await seedAuth(page);
    await mockTracker(page, [
      position('NVDA', { index_weight: 7.776316, index_weight_as_of: '2026-10-22' }),
      position('AMD', { index_weight: null, index_weight_as_of: null }),
    ]);
    await page.goto(`/dashboard/strategy/${STRATEGY_ID}`);
    const table = page.getByTestId('positions-table');
    await expect(table).toBeVisible();
    await expect(table.locator('th', { hasText: 'Index wt' })).toHaveCount(1);
    await expect(table.getByTestId('position-row-NVDA')).toContainText('7.78%');
    await expect(table).not.toContainText(/undefined|NaN/);
  });

  test('sin index_weight (legado) → sin columna', async ({ page }) => {
    await seedAuth(page);
    await mockTracker(page, [position('AAPL'), position('MSFT')]);
    await page.goto(`/dashboard/strategy/${STRATEGY_ID}`);
    const table = page.getByTestId('positions-table');
    await expect(table).toBeVisible();
    await expect(table.locator('th', { hasText: 'Index wt' })).toHaveCount(0);
    await expect(table).not.toContainText(/undefined|NaN/);
  });
});
