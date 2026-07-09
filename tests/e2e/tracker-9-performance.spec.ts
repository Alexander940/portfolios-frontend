import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #9 — performance: live equity vs SPY + backtest overlay.
 *
 * API route-mocked: base curve from the portfolios endpoint, overlay from
 * /tracker/vs-backtest, and the run-backtest flow (POST + job polling).
 */

const STRATEGY_ID = '33333333-3333-3333-3333-333333333333';
const PORTFOLIO_ID = '66666666-6666-6666-6666-666666666666';

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

const TRACKER = {
  tracker_id: '44444444-4444-4444-4444-444444444444',
  strategy_id: STRATEGY_ID,
  strategy_version_id: '55555555-5555-5555-5555-555555555555',
  portfolio_id: PORTFOLIO_ID,
  status: 'active',
  initial_cash: '100000.00',
  started_at: '2026-06-01',
  last_rebalance_date: '2026-07-01',
  next_rebalance_date: '2026-07-15',
  last_evaluated_date: '2026-07-08',
  force_rebalance: false,
  notifications_enabled: true,
  last_error: null,
  created_at: '2026-06-01T00:00:00Z',
};

const CURVE = {
  portfolio_id: PORTFOLIO_ID,
  benchmark: 'SPY',
  return_basis: 'total_return',
  base_mode: 'index_100',
  base: 100,
  benchmark_available: true,
  start_date: '2026-06-01',
  end_date: '2026-06-03',
  points: [
    {
      date: '2026-06-01',
      portfolio_value: 100,
      portfolio_return_pct: 0,
      benchmark_value: 100,
      benchmark_return_pct: 0,
      relative_return_pct: 0,
    },
    {
      date: '2026-06-02',
      portfolio_value: 104,
      portfolio_return_pct: 4,
      benchmark_value: 101,
      benchmark_return_pct: 1,
      relative_return_pct: 3,
    },
    {
      date: '2026-06-03',
      portfolio_value: 106,
      portfolio_return_pct: 6,
      benchmark_value: 102,
      benchmark_return_pct: 2,
      relative_return_pct: 4,
    },
  ],
};

function series(values: [string, number][]) {
  return values.map(([date, rebased]) => ({ date, value: rebased * 1000, rebased }));
}

const VSBACKTEST_FULL = {
  started_at: '2026-06-01',
  conventions: {
    tracker: 'last_close_whole_shares',
    backtest: 'next_open_fractional_shares',
  },
  live: series([
    ['2026-06-01', 100],
    ['2026-06-02', 104],
    ['2026-06-03', 106],
  ]),
  backtest: series([
    ['2026-06-01', 100],
    ['2026-06-02', 103],
    ['2026-06-03', 104.5],
  ]),
  benchmark: series([
    ['2026-06-01', 100],
    ['2026-06-02', 101],
    ['2026-06-03', 102],
  ]),
  backtest_job_id: 'job-1',
  backtest_missing_reason: null,
  divergence: {
    common_days: 3,
    window_start: '2026-06-01',
    window_end: '2026-06-03',
    live_return_pct: '6.00',
    backtest_return_pct: '4.50',
    delta_pct: '1.50',
  },
  warnings: [],
};

const VSBACKTEST_MISSING = {
  ...VSBACKTEST_FULL,
  backtest: null,
  backtest_job_id: null,
  backtest_missing_reason: 'No existe un backtest para la versión trackeada',
  divergence: null,
};

const VSBACKTEST_DISJOINT = {
  ...VSBACKTEST_FULL,
  divergence: null,
  warnings: ['Las ventanas del tracker y el backtest no comparten fechas'],
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

interface MockOptions {
  /** Payload inicial del vs-backtest; tras completar el job pasa a FULL. */
  vsBacktest?: Record<string, unknown>;
  /** Nº de GETs del job en estado running antes de done. */
  jobRunningPolls?: number;
}

async function mockApi(page: Page, opts: MockOptions = {}): Promise<void> {
  let backtestDone = false;
  let jobPolls = 0;

  await page.route('**/portfolios/*/positions*', (route) =>
    route.fulfill({ json: { items: [], total: 0, limit: 200, offset: 0 } }),
  );
  await page.route('**/portfolios/*/performance/curve*', (route) =>
    route.fulfill({ json: CURVE }),
  );
  await page.route('**/backtests/*', async (route) => {
    jobPolls += 1;
    const running = jobPolls <= (opts.jobRunningPolls ?? 1);
    if (!running) backtestDone = true;
    await route.fulfill({
      json: { job_id: 'job-9', status: running ? 'running' : 'done' },
    });
  });
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname.endsWith('/tracker/vs-backtest')) {
      await route.fulfill({
        json: backtestDone ? VSBACKTEST_FULL : (opts.vsBacktest ?? VSBACKTEST_FULL),
      });
      return;
    }
    if (url.pathname.endsWith('/backtest') && method === 'POST') {
      await route.fulfill({ json: { job_id: 'job-9', status: 'queued' } });
      return;
    }
    if (url.pathname.endsWith('/tracker') && method === 'GET') {
      await route.fulfill({ json: TRACKER });
      return;
    }
    if (url.pathname.endsWith('/tracker/drift')) {
      await route.fulfill({ json: { entries: [], exits: [], weight_drift: [], warnings: [] } });
      return;
    }
    if (url.pathname.endsWith('/holdings')) {
      await route.fulfill({ json: { data_as_of: '2026-07-08', warnings: [], holdings: [] } });
      return;
    }
    await route.fulfill({ status: 404, json: { detail: 'Not mocked' } });
  });
}

const DETAIL_URL = `/dashboard/strategy/${STRATEGY_ID}`;

test.describe('Performance + vs-backtest (#9)', () => {
  test('curva base: Tracker + SPY desde el endpoint de portfolios', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto(DETAIL_URL);

    const chart = page.getByTestId('tracker-performance-chart');
    await expect(chart).toBeVisible();
    await expect(chart.locator('.recharts-line')).toHaveCount(2);
    await expect(chart).toContainText('Tracker');
    await expect(chart).toContainText('SPY');
    await expect(page.getByTestId('divergence-card')).not.toBeVisible();
  });

  test('toggle backtest: tercera serie + tarjeta de divergencia + disclaimer de convenciones', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto(DETAIL_URL);
    await expect(page.getByTestId('tracker-performance-chart')).toBeVisible();

    await page.getByRole('button', { name: 'Comparar con backtest' }).click();

    const chart = page.getByTestId('tracker-performance-chart');
    await expect(chart.locator('.recharts-line')).toHaveCount(3);
    await expect(chart).toContainText('Backtest');

    const card = page.getByTestId('divergence-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('+6.00%');
    await expect(card).toContainText('+4.50%');
    await expect(card).toContainText('+1.50%');
    await expect(card).toContainText('3 días en común');

    // Disclaimer construido desde `conventions`, no hardcodeado
    const disclaimer = page.getByTestId('conventions-disclaimer');
    await expect(disclaimer).toContainText('tracker: last_close_whole_shares');
    await expect(disclaimer).toContainText('backtest: next_open_fractional_shares');

    // Toggle off → vuelve a 2 series y desaparece la tarjeta
    await page.getByRole('button', { name: 'Ocultar backtest' }).click();
    await expect(chart.locator('.recharts-line')).toHaveCount(2);
    await expect(card).not.toBeVisible();
  });

  test('sin backtest: empty state + correr backtest con polling hasta done', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockApi(page, { vsBacktest: VSBACKTEST_MISSING, jobRunningPolls: 1 });
    await page.goto(DETAIL_URL);
    await expect(page.getByTestId('tracker-performance-chart')).toBeVisible();

    await page.getByRole('button', { name: 'Comparar con backtest' }).click();

    const missing = page.getByTestId('backtest-missing');
    await expect(missing).toBeVisible();
    await expect(missing).toContainText('No existe un backtest para la versión trackeada');

    await page.getByTestId('run-backtest-cta').click();

    // Tras el polling (running → done) se re-consulta el overlay completo
    await expect(page.getByTestId('tracker-performance-chart')).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByTestId('tracker-performance-chart').locator('.recharts-line'),
    ).toHaveCount(3, { timeout: 20_000 });
    await expect(page.getByTestId('divergence-card')).toBeVisible();
  });

  test('ventanas disjuntas: curvas visibles + warning, sin tarjeta de divergencia', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockApi(page, { vsBacktest: VSBACKTEST_DISJOINT });
    await page.goto(DETAIL_URL);
    await expect(page.getByTestId('tracker-performance-chart')).toBeVisible();

    await page.getByRole('button', { name: 'Comparar con backtest' }).click();

    await expect(
      page.getByTestId('tracker-performance-chart').locator('.recharts-line'),
    ).toHaveCount(3);
    await expect(page.getByTestId('overlay-warning')).toContainText(
      'no comparten fechas',
    );
    await expect(page.getByTestId('divergence-card')).not.toBeVisible();
  });
});
