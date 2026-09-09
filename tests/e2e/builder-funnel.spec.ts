import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #174 (Fase B) — the "Selection" tab in the Strategy Builder
 * results view: the funnel of the last rebalance (Universe → Selection rules
 * → Ranking → Weighting → Execution) plus the per-candidate table.
 *
 * NOT RUN in this environment (Playwright's browser cannot launch in this
 * WSL — `browserType.launch: Target page, context or browser has been
 * closed`); the executable guard for this phase is
 * `tests/checks/funnel-view.ts`, which exercises the same pure functions
 * (`rowsAtStage`, `exitStageLabel`, `reasonLabel`, `detectRankingTies`) this
 * spec would otherwise be indirectly checking through the DOM. This spec is
 * the written contract for CI / a machine that can launch a browser.
 *
 * Harness pattern: builder-156-turnover.spec.ts (results-view mocking via
 * `backtestFromList`) + builder-or-filters.spec.ts (auth seeding). The new
 * bit is a second mocked route for `GET /backtests/{job_id}/selection-trace`
 * — Playwright's single `*` in `**\/backtests/*` doesn't cross a `/`
 * boundary, so it never matches the extra `/selection-trace` segment; the two
 * routes coexist independently of registration order.
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
  selection: { sort_by: 'rating', sort_order: 'desc', top_n: 5 },
  weighting: { method: 'equal' },
  rebalance: { cadence: 'monthly' },
  validation: { start: '2024-01-02', end: '2024-06-28', oos_split: 0.2, min_n_trades: 30 },
};

const BASE_METRICS = {
  total_return: 0.12, cagr: 0.25, volatility: 0.18, sharpe: 1.4, sortino: 1.9,
  calmar: 2.1, max_drawdown: -0.08, alpha: 0.01, beta: 1.02, n_trades: 12,
  n_rebalances: 3, is_sharpe: 1.5, oos_sharpe: 1.2,
  low_sample_trades: false, low_sample_universe: false,
};

const BASE_EQUITY = [
  { date: '2024-01-02', total_value: 100000, cash: 0, invested: 100000, benchmark_value: 100, daily_return: 0, drawdown: 0 },
  { date: '2024-06-28', total_value: 112000, cash: 0, invested: 112000, benchmark_value: 108, daily_return: 0.001, drawdown: -0.01 },
];

const DONE_RESULT = {
  job_id: 'j1',
  status: 'done',
  error: null,
  result: {
    metrics: BASE_METRICS,
    coverage_pct: 0.98,
    fill_convention: 'next_open_net_of_costs',
    initial_cash: 100000,
    window_start: '2024-01-02',
    window_end: '2024-06-28',
    equity: BASE_EQUITY,
    trades: [],
  },
};

/** 12 candidates, scaled down from the design's reference 1,185/30 — same
 *  shape: selection_rules and weighting have no rules of their own (applies:
 *  false, greyed "no rules" per the approved design), ranks 1-2 tie on the
 *  best score (the low-cardinality-ranking-key warning), and one candidate
 *  that survives ranking still gets cut in execution (no_price). */
function traceRow(p: {
  symbol_id: string; ticker: string; rank: number | null; score: number | null;
  exit_stage: string | null; reason: string | null; weight_pct: number | null;
}) {
  return {
    symbol_id: p.symbol_id,
    ticker: p.ticker,
    name: `${p.ticker} Inc.`,
    sector: 'Technology',
    score: p.score,
    rank: p.rank,
    exit_stage: p.exit_stage,
    reason: p.reason,
    weight_pct: p.weight_pct,
  };
}

const TRACE_RESPONSE = {
  as_of: '2026-08-03',
  sort_by: 'rating',
  candidates_count: 40,
  total: 12,
  truncated: false,
  stages: [
    { key: 'universe', count: 12, dropped_from_prev: 28, applies: true },
    { key: 'selection_rules', count: 12, dropped_from_prev: 0, applies: false },
    { key: 'ranking', count: 5, dropped_from_prev: 7, applies: true },
    { key: 'weighting', count: 5, dropped_from_prev: 0, applies: false },
    { key: 'execution', count: 4, dropped_from_prev: 1, applies: true },
  ],
  rows: [
    traceRow({ symbol_id: 'sym-1', ticker: 'AAA', rank: 1, score: 3, exit_stage: null, reason: null, weight_pct: 30 }),
    traceRow({ symbol_id: 'sym-2', ticker: 'BBB', rank: 2, score: 3, exit_stage: null, reason: null, weight_pct: 30 }),
    traceRow({ symbol_id: 'sym-3', ticker: 'CCC', rank: 3, score: 2, exit_stage: null, reason: null, weight_pct: 20 }),
    traceRow({ symbol_id: 'sym-4', ticker: 'DDD', rank: 4, score: 1, exit_stage: 'execution', reason: 'no_price', weight_pct: null }),
    traceRow({ symbol_id: 'sym-5', ticker: 'EEE', rank: 5, score: 1, exit_stage: null, reason: null, weight_pct: 20 }),
    traceRow({ symbol_id: 'sym-6', ticker: 'FFF', rank: 6, score: 0, exit_stage: 'ranking', reason: 'top_n_cut', weight_pct: null }),
    traceRow({ symbol_id: 'sym-7', ticker: 'GGG', rank: 7, score: 0, exit_stage: 'ranking', reason: 'top_n_cut', weight_pct: null }),
    traceRow({ symbol_id: 'sym-8', ticker: 'HHH', rank: 8, score: -1, exit_stage: 'ranking', reason: 'top_n_cut', weight_pct: null }),
    traceRow({ symbol_id: 'sym-9', ticker: 'III', rank: 9, score: -1, exit_stage: 'ranking', reason: 'top_n_cut', weight_pct: null }),
    traceRow({ symbol_id: 'sym-10', ticker: 'JJJ', rank: 10, score: -2, exit_stage: 'ranking', reason: 'top_n_cut', weight_pct: null }),
    traceRow({ symbol_id: 'sym-11', ticker: 'KKK', rank: 11, score: -2, exit_stage: 'ranking', reason: 'top_n_cut', weight_pct: null }),
    traceRow({ symbol_id: 'sym-12', ticker: 'LLL', rank: 12, score: -3, exit_stage: 'ranking', reason: 'top_n_cut', weight_pct: null }),
  ],
};

/** Same shape, but past the endpoint's 5,000-row hard cap — `total` (the real
 *  candidate count) is bigger than `rows.length` (what actually came back). */
const TRUNCATED_TRACE_RESPONSE = {
  ...TRACE_RESPONSE,
  total: 5300,
  truncated: true,
};

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

/** Mocks the builder API with ONE saved, already-backtested strategy, plus
 *  its selection-trace. `trace: null` simulates the endpoint failing (honest
 *  error-state test) instead of fulfilling. */
async function mockApi(
  page: Page,
  opts: { sid: string; name: string; trace: Record<string, unknown> | null },
): Promise<void> {
  const strategyRow = {
    strategy_id: opts.sid,
    name: opts.name,
    description: null,
    latest_version: 1,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-02T00:00:00Z',
    spec: BASE_SPEC,
    template_slug: null,
    template_version: null,
  };

  await page.route('**/templates/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/templates/', (route) => route.fulfill({ json: [] }));
  // Playwright's single `*` doesn't cross a `/` boundary, so this pattern
  // (one extra path segment) never overlaps `**/backtests/*` below — no
  // registration-order dependency between the two routes.
  await page.route('**/backtests/*/selection-trace', async (route) => {
    if (opts.trace == null) {
      await route.fulfill({ status: 500, json: { detail: 'boom' } });
      return;
    }
    await route.fulfill({ json: opts.trace });
  });
  await page.route('**/backtests/*', (route) => route.fulfill({ json: DONE_RESULT }));
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

async function openSelectionTab(page: Page): Promise<void> {
  await page.getByTestId('sb-tab-selection').click();
  await expect(page.getByTestId('sb-selection-trace')).toBeVisible();
}

test.describe('Builder — pestaña Selection, embudo del último rebalanceo (#174)', () => {
  test('abre en Ranking; el riel muestra 5 etapas con conteo, caída, y las sin reglas en gris', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, { sid: 'sid-1', name: 'E2E Funnel Base', trace: TRACE_RESPONSE });
    await backtestFromList(page, 'E2E Funnel Base');
    await openSelectionTab(page);

    const rail = page.getByTestId('sb-stage-rail');
    await expect(rail).toBeVisible();
    // 5 stages, all present (the approved design: no stage ever hides).
    await expect(rail.locator('.sb-stage-cell')).toHaveCount(5);

    await expect(page.getByTestId('sb-stage-universe')).toContainText('12');
    await expect(page.getByTestId('sb-stage-selection_rules')).toContainText('no rules');
    await expect(page.getByTestId('sb-stage-selection_rules')).toHaveClass(/disabled/);
    await expect(page.getByTestId('sb-stage-ranking')).toContainText('5');
    await expect(page.getByTestId('sb-stage-ranking')).toContainText('−7');
    await expect(page.getByTestId('sb-stage-weighting')).toContainText('no rules');
    await expect(page.getByTestId('sb-stage-execution')).toContainText('4');

    // Opens on Ranking — its cell is the active tab, and the table shows its
    // 5 survivors, not the full 12-candidate universe.
    await expect(page.getByTestId('sb-stage-ranking')).toHaveClass(/active/);
    await expect(page.locator('.card-title', { hasText: 'Ranking' })).toBeVisible();
    await expect(page.locator('table.tbl tbody tr')).toHaveCount(5);

    // One of the 5 ranking survivors (DDD) was still cut in execution — that
    // must read as its OWN reason, not folded into "In portfolio".
    const ddRow = page.locator('table.tbl tbody tr', { hasText: 'DDD' });
    await expect(ddRow).not.toContainText('In portfolio');
    await expect(ddRow).toContainText(/price/i);
    // The 4 that made it show "In portfolio", never a raw stage key.
    await expect(page.locator('table.tbl tbody tr', { hasText: 'AAA' })).toContainText('In portfolio');
  });

  test('"ver las 12 del universo" salta a Universe; "volver" regresa a Ranking', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, { sid: 'sid-2', name: 'E2E Funnel Universe Jump', trace: TRACE_RESPONSE });
    await backtestFromList(page, 'E2E Funnel Universe Jump');
    await openSelectionTab(page);

    await expect(page.locator('table.tbl tbody tr')).toHaveCount(5); // starts on Ranking

    await page.getByRole('button', { name: /see all 12 in the universe/i }).click();
    await expect(page.getByTestId('sb-stage-universe')).toHaveClass(/active/);
    await expect(page.locator('.card-title', { hasText: 'Universe' })).toBeVisible();
    await expect(page.locator('table.tbl tbody tr')).toHaveCount(12);
    // The 7 top_n_cut rejects are visible here — proof this view isn't just
    // "the portfolio again".
    await expect(page.locator('table.tbl tbody tr', { hasText: 'LLL' })).toContainText(/top-n/i);

    await page.getByRole('button', { name: /back to Ranking/i }).click();
    await expect(page.getByTestId('sb-stage-ranking')).toHaveClass(/active/);
    await expect(page.locator('table.tbl tbody tr')).toHaveCount(5);
  });

  test('aviso de empate: el tope del ranking comparte score', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, { sid: 'sid-3', name: 'E2E Funnel Ties', trace: TRACE_RESPONSE });
    await backtestFromList(page, 'E2E Funnel Ties');
    await openSelectionTab(page);

    const banner = page.getByTestId('sb-selection-ties');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('2'); // AAA + BBB tie at score 3
  });

  test('sin empate: reemplazando los scores por valores distintos, el aviso no aparece', async ({ page }) => {
    await seedAuth(page);
    const noTieTrace = {
      ...TRACE_RESPONSE,
      rows: TRACE_RESPONSE.rows.map((r, i) => ({ ...r, score: r.score == null ? null : 10 - i })),
    };
    await mockApi(page, { sid: 'sid-4', name: 'E2E Funnel No Ties', trace: noTieTrace });
    await backtestFromList(page, 'E2E Funnel No Ties');
    await openSelectionTab(page);

    await expect(page.getByTestId('sb-selection-ties')).toHaveCount(0);
  });

  test('resultado truncado: el aviso de 5.000 filas se muestra, nunca se esconde', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, { sid: 'sid-5', name: 'E2E Funnel Truncated', trace: TRUNCATED_TRACE_RESPONSE });
    await backtestFromList(page, 'E2E Funnel Truncated');
    await openSelectionTab(page);

    const banner = page.getByTestId('sb-selection-truncated');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('5,300');
  });

  test('estado de error: el endpoint falla y la pestaña lo dice, no se queda cargando para siempre', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, { sid: 'sid-6', name: 'E2E Funnel Error', trace: null });
    await backtestFromList(page, 'E2E Funnel Error');
    // Not `openSelectionTab`: that helper waits for `sb-selection-trace`,
    // which only the success path renders — the error path is a different
    // (non-wrapped) subtree by design, so it's asserted directly here.
    await page.getByTestId('sb-tab-selection').click();

    await expect(page.getByTestId('sb-selection-error')).toBeVisible();
    await expect(page.getByTestId('sb-selection-loading')).toHaveCount(0);
  });
});
