import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #158 — the new Section 8 "Rebalancing" in the Strategy
 * Builder form (cadence control moved out of *General parameters* + the new
 * `on` day-of-period selector). API route-mocked (pattern:
 * builder-131-top-marketcap.spec.ts / builder-rerun-update.spec.ts).
 *
 * The critical risk this pins (per the design doc): getting `normalizeCfg` /
 * `specToConfig` wrong for the new `rebalanceOn` field would break opening any
 * of the 21 strategies saved before this change — hence the legacy case is
 * the FIRST test, not an afterthought.
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
  costs: { commission_bps: 5, slippage_bps: 8 },
  validation: { start: '2024-01-02', end: '2024-06-28', oos_split: 0.2, min_n_trades: 30 },
};

const DONE_RESULT = {
  job_id: 'j1',
  status: 'done',
  error: null,
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

/** Mocks the builder API. `GET /strategies/` answers with `rows`; PUT/POST are
 *  recorded so the test can assert on the spec that was actually sent. */
async function mockApi(page: Page, rows: Record<string, unknown>[]): Promise<RecordedCall[]> {
  const calls: RecordedCall[] = [];

  await page.route('**/templates/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/templates/', (route) => route.fulfill({ json: [] }));
  await page.route('**/backtests/*', (route) => route.fulfill({ json: DONE_RESULT }));
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
        json: { strategy_id: 'dup-created', version: 1, content_hash: 'dead'.repeat(16) },
      });
      return;
    }
    await route.fulfill({ json: rows });
  });

  return calls;
}

function strategyRow(sid: string, name: string, rebalance: Record<string, unknown>) {
  return {
    strategy_id: sid,
    name,
    description: null,
    latest_version: 1,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-02T00:00:00Z',
    spec: { ...BASE_SPEC, rebalance },
    template_slug: null,
    template_version: null,
  };
}

test.describe('Builder — Sección 8 Rebalancing (#158)', () => {
  test('caso legacy: una estrategia guardada ANTES del cambio (sin `on`) carga con su cadencia correcta', async ({
    page,
  }) => {
    await seedAuth(page);
    // Exactly what every one of the 21 pre-#158 strategies looks like on the
    // wire today: `{cadence}` only, no `on` key at all.
    await mockApi(page, [strategyRow('sid-legacy', 'E2E Legacy Cadence', { cadence: 'weekly' })]);

    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: 'E2E Legacy Cadence' }).locator('button[title="Edit"]').click();

    // Section 8 shows the loaded cadence...
    await expect(page.getByTestId('sb-cadence-weekly')).toHaveClass(/active/);
    // ...and defaults `on` to period_start (the backend's pre-#157 behavior)
    // rather than crashing or leaving it unset.
    await expect(page.getByTestId('sb-rebalance-on-period_start')).toHaveClass(/active/);
    await expect(page.getByTestId('sb-rebalance-on-period_end')).not.toHaveClass(/active/);
  });

  test('la Sección 8 aparece y "General parameters" ya no tiene el control de cadencia', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page, []);

    await page.goto('/dashboard/builder');
    await page.getByRole('button', { name: 'New strategy' }).first().click();

    // Section 8 exists with its own controls, defaulted (monthly / period_start).
    await expect(page.getByText('Rebalancing', { exact: true })).toBeVisible();
    await expect(page.getByText('How the book moves between rebalances')).toBeVisible();
    await expect(page.getByTestId('sb-cadence-monthly')).toHaveClass(/active/);
    await expect(page.getByTestId('sb-rebalance-on-period_start')).toHaveClass(/active/);

    // General parameters no longer shows the cadence control.
    const generalSection = page.locator('.sb-section', { hasText: 'General parameters' });
    await expect(generalSection).toBeVisible();
    await expect(generalSection).not.toContainText('Rebalance');
  });
});

const CADENCES = ['weekly', 'monthly', 'quarterly', 'semiannual', 'annual'] as const;

test.describe('Builder — round-trip cfg→spec→cfg por cadencia (#158)', () => {
  for (const cadence of CADENCES) {
    // Exercise the non-default `on` on one cadence (quarterly) — the others
    // stay on the default (period_start), which must be OMITTED from the wire
    // spec (same content_hash idiom as layer1.top_n / layer2.sector_caps).
    const on = cadence === 'quarterly' ? 'period_end' : undefined;

    test(`estable para cadence=${cadence}${on ? ` (on=${on})` : ''}`, async ({ page }) => {
      await seedAuth(page);
      const sid = `sid-${cadence}`;
      const name = `E2E Cadence ${cadence}`;
      const rebalance = on ? { cadence, on } : { cadence };
      const calls = await mockApi(page, [strategyRow(sid, name, rebalance)]);

      await page.goto('/dashboard/builder');
      await page.locator('.sb-card', { hasText: name }).locator('button[title="Edit"]').click();

      // spec → cfg: the form reflects exactly what was loaded.
      await expect(page.getByTestId(`sb-cadence-${cadence}`)).toHaveClass(/active/);
      await expect(page.getByTestId(`sb-rebalance-on-${on ?? 'period_start'}`)).toHaveClass(/active/);

      // cfg → spec: saving without touching anything must reproduce the same
      // rebalance clause (a stable round-trip — this is the guard against a
      // wrong normalizeCfg/specToConfig silently drifting every saved spec).
      await page.getByRole('button', { name: 'Save & backtest' }).click();
      await expect(page.getByTestId('sb-results')).toBeVisible();

      const put = calls.find((c) => c.method === 'PUT');
      expect(put).toBeTruthy();
      const sentSpec = put?.body?.spec as { rebalance: Record<string, unknown> };
      expect(sentSpec.rebalance.cadence).toBe(cadence);
      if (on) {
        expect(sentSpec.rebalance.on).toBe(on);
      } else {
        expect('on' in sentSpec.rebalance).toBe(false);
      }

      // Never re-created as a duplicate row.
      const createPost = calls.find((c) => c.method === 'POST' && c.path.endsWith('/strategies/'));
      expect(createPost).toBeUndefined();
    });
  }
});
