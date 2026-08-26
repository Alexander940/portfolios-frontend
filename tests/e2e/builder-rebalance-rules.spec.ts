import { test, expect, type Page } from '@playwright/test';

/**
 * E2E de las 11 reglas opcionales de rebalanceo (épica #154) en la Sección 8
 * del Strategy Builder. API mockeada por rutas (mismo arnés que
 * builder-158-rebalance-section.spec.ts).
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

// ---------------------------------------------------------------------------
// Reglas de rebalanceo (épica #154) — los 11 controles de la Sección 8.
//
// Lo que se protege aquí, por orden de importancia:
//   1. Una estrategia guardada SIN reglas se vuelve a guardar sin ninguna clave
//      de regla en `rebalance`. El backend popea esas claves de canonical_json,
//      así que emitir un `null` cambiaría el content_hash de los 225 specs de
//      producción y rompería el dedupe de backtests.
//   2. Las unidades: el formulario recoge PORCENTAJES y el spec lleva
//      FRACCIONES. Un 25 que viaje como 25 en vez de 0.25 sería un 2.500 % de
//      turnover permitido — el backend lo rechaza (le=1.0), pero el usuario
//      solo vería un 422 opaco.
//   3. La vuelta: un spec con reglas se muestra en el formulario en porcentaje.
// ---------------------------------------------------------------------------

function field(page: Page, label: string) {
  return page.locator('.sb-field', { hasText: label }).locator('input');
}

async function openBuilder(page: Page, name: string) {
  await page.goto('/dashboard/builder');
  await page.locator('.sb-card', { hasText: name }).locator('button[title="Edit"]').click();
  await page.getByRole('button', { name: /Rebalancing/ }).click();
}

test.describe('Builder — reglas de rebalanceo (#154)', () => {
  test('una estrategia sin reglas se guarda sin ninguna clave de regla', async ({ page }) => {
    await seedAuth(page);
    const name = 'E2E sin reglas';
    const calls = await mockApi(page, [strategyRow('sid-plain', name, { cadence: 'monthly' })]);

    await page.goto('/dashboard/builder');
    await page.locator('.sb-card', { hasText: name }).locator('button[title="Edit"]').click();
    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect(page.getByTestId('sb-results')).toBeVisible();

    const put = calls.find((c) => c.method === 'PUT');
    const rebalance = (put?.body?.spec as { rebalance: Record<string, unknown> }).rebalance;
    // Exactamente la cláusula original: ni una clave más.
    expect(Object.keys(rebalance).sort()).toEqual(['cadence']);
  });

  test('las reglas viajan al spec en unidades del backend', async ({ page }) => {
    await seedAuth(page);
    const name = 'E2E con reglas';
    const calls = await mockApi(page, [strategyRow('sid-rules', name, { cadence: 'monthly' })]);

    await openBuilder(page, name);
    await field(page, 'Rank buffer for held names').fill('1.5');
    await field(page, 'Max new entries per rebalance').fill('5');
    await field(page, 'Minimum holding period').fill('60');
    await field(page, 'Max turnover per rebalance').fill('25');
    await field(page, 'Skip rebalance within drift band').fill('5');
    await field(page, 'Cash buffer').fill('2.5');
    await field(page, 'Minimum trade size').fill('0.5');
    await field(page, 'Stop loss').fill('20');
    await field(page, 'Trailing stop (ATR)').fill('3');
    await field(page, 'Exit on dead price feed').fill('10');
    await page.getByRole('switch', { name: 'Prioritise current holdings' }).click();

    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect(page.getByTestId('sb-results')).toBeVisible();

    const put = calls.find((c) => c.method === 'PUT');
    const rebalance = (put?.body?.spec as { rebalance: Record<string, unknown> }).rebalance;
    expect(rebalance).toMatchObject({
      cadence: 'monthly',
      hold_rank_buffer: 1.5,          // multiplicador, sin convertir
      prioritize_held: true,
      min_holding_days: 60,           // días, entero
      max_entries_per_rebalance: 5,
      max_turnover_pct: 0.25,         // 25 % → fracción
      drift_band_pct: 0.05,           // 5 pp → fracción
      cash_buffer_pct: 0.025,
      min_trade_pct: 0.005,
      stop_loss_pct: 0.2,
      trailing_stop_atr: 3,           // múltiplos de ATR, sin convertir
      exit_on_stale_price_days: 10,   // días, entero
    });
  });

  test('un spec con reglas se muestra en el formulario en porcentaje', async ({ page }) => {
    await seedAuth(page);
    const name = 'E2E carga reglas';
    await mockApi(page, [
      strategyRow('sid-load', name, {
        cadence: 'quarterly',
        hold_rank_buffer: 1.5,
        prioritize_held: true,
        max_turnover_pct: 0.25,
        stop_loss_pct: 0.2,
        exit_on_stale_price_days: 10,
      }),
    ]);

    await openBuilder(page, name);
    await expect(field(page, 'Rank buffer for held names')).toHaveValue('1.5');
    await expect(field(page, 'Max turnover per rebalance')).toHaveValue('25');
    await expect(field(page, 'Stop loss')).toHaveValue('20');
    await expect(field(page, 'Exit on dead price feed')).toHaveValue('10');
    await expect(page.getByRole('switch', { name: 'Prioritise current holdings' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('el rango se valida en el formulario, no con un 422 del backend', async ({ page }) => {
    await seedAuth(page);
    const name = 'E2E validación';
    await mockApi(page, [strategyRow('sid-valid', name, { cadence: 'monthly' })]);

    await openBuilder(page, name);
    // 1.0 no es un colchón: exige el mismo rank que una entrada nueva.
    await field(page, 'Rank buffer for held names').fill('1');
    await expect(page.locator('.sb-field-error', { hasText: 'Must be above 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save & backtest' })).toBeDisabled();
  });
});
