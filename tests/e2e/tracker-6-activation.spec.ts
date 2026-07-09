import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #6 — activation flow: materialization preview + POST tracker.
 *
 * API route-mocked. The preview recompute is client-side (backend fixes
 * initial_cash=100000), so the capital chips must change shares/cash WITHOUT
 * a new holdings request.
 */

const STRATEGY_ID = '33333333-3333-3333-3333-333333333333';

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
  portfolio_id: '66666666-6666-6666-6666-666666666666',
  status: 'active',
  initial_cash: '100000.00',
  started_at: '2026-07-08',
  last_rebalance_date: '2026-07-08',
  next_rebalance_date: '2026-07-15',
  last_evaluated_date: '2026-07-08',
  force_rebalance: false,
  notifications_enabled: true,
  last_error: null,
  created_at: '2026-07-08T00:00:00Z',
};

// Capital 100k → AAPL 200 acciones / MSFT 70 / TSLA 83; cash $100.00.
// Capital 50k  → AAPL 100 / MSFT 35 / TSLA 41; cash $200.00.
const PREVIEW = {
  as_of: '2026-07-08',
  data_as_of: '2026-07-08',
  eligible_count: 3,
  coverage_pct: '0.95',
  initial_cash: '100000',
  cash_pct: '0.001',
  warnings: [],
  sector_breakdown: [],
  holdings: [
    {
      symbol_id: 's1',
      ticker: 'AAPL',
      name: 'Apple Inc.',
      sector: 'Technology',
      rating: 2,
      score: '1.85',
      price: '200.00',
      weight_pct: '40',
      shares: 200,
      est_value: '40000',
      weight_realized_pct: '40',
    },
    {
      symbol_id: 's2',
      ticker: 'MSFT',
      name: 'Microsoft Corp.',
      sector: 'Technology',
      rating: 3,
      score: '2.10',
      price: '500.00',
      weight_pct: '35',
      shares: 70,
      est_value: '35000',
      weight_realized_pct: '35',
    },
    {
      symbol_id: 's3',
      ticker: 'TSLA',
      name: 'Tesla Inc.',
      sector: 'Consumer Cyclical',
      rating: -1,
      score: '-0.40',
      price: '300.00',
      weight_pct: '25',
      shares: 83,
      est_value: '24900',
      weight_realized_pct: '24.9',
    },
  ],
};

interface RecordedCall {
  method: string;
  path: string;
  body: unknown;
}

interface MockOptions {
  preview?: Record<string, unknown>;
  createStatus?: number;
  createDetail?: string;
  /** GET /tracker responde 404 solo las primeras N veces (default: hasta el POST). */
  notFoundTimes?: number;
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

async function mockActivationApi(
  page: Page,
  opts: MockOptions = {},
): Promise<RecordedCall[]> {
  const calls: RecordedCall[] = [];
  let created = false;
  let trackerGets = 0;

  await page.route('**/strategies/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    let body: unknown = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = null;
    }
    calls.push({ method, path: url.pathname, body });

    if (url.pathname.endsWith('/holdings')) {
      await route.fulfill({ json: opts.preview ?? PREVIEW });
      return;
    }
    if (url.pathname.endsWith('/tracker')) {
      if (method === 'GET') {
        trackerGets += 1;
        const stillNotFound =
          opts.notFoundTimes !== undefined ? trackerGets <= opts.notFoundTimes : !created;
        if (stillNotFound) {
          await route.fulfill({ status: 404, json: { detail: 'Tracker not found' } });
        } else {
          await route.fulfill({ json: TRACKER });
        }
        return;
      }
      if (method === 'POST') {
        if (opts.createStatus && opts.createStatus >= 400) {
          await route.fulfill({
            status: opts.createStatus,
            json: { detail: opts.createDetail ?? 'Create rejected' },
          });
        } else {
          created = true;
          await route.fulfill({
            status: 201,
            json: { ...TRACKER, positions_count: 3 },
          });
        }
        return;
      }
    }
    await route.fulfill({ status: 404, json: { detail: 'Not mocked' } });
  });

  return calls;
}

const DETAIL_URL = `/dashboard/strategy/${STRATEGY_ID}`;

test.describe('Flujo de activación (#6)', () => {
  test('preview con shares del capital por defecto, fila CASH y badge de cierre', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockActivationApi(page);
    await page.goto(DETAIL_URL);

    await expect(page.getByTestId('activation-flow')).toBeVisible();
    await expect(page.getByTestId('activation-asof')).toContainText('Precios al cierre');

    const table = page.getByTestId('activation-table');
    await expect(table.locator('tbody tr')).toHaveCount(4); // 3 holdings + CASH
    const aapl = table.locator('tbody tr').first();
    await expect(aapl).toContainText('AAPL');
    await expect(aapl).toContainText('200'); // shares
    await expect(aapl).toContainText('$40,000.00');
    await expect(page.getByTestId('activation-cash-row')).toContainText('$100.00');

    const cta = page.getByTestId('activation-cta');
    await expect(cta).toBeEnabled();
    await expect(cta).toContainText('Activar tracker con $100,000.00');
  });

  test('la preview recomputa client-side al cambiar el capital (sin refetch)', async ({
    page,
  }) => {
    await seedAuth(page);
    const calls = await mockActivationApi(page);
    await page.goto(DETAIL_URL);
    await expect(page.getByTestId('activation-flow')).toBeVisible();

    await page.getByRole('button', { name: '$50k' }).click();

    const table = page.getByTestId('activation-table');
    await expect(table.locator('tbody tr').first()).toContainText('$20,000.00'); // AAPL 100 acciones
    await expect(page.getByTestId('activation-cash-row')).toContainText('$200.00');
    await expect(page.getByTestId('activation-cta')).toContainText(
      'Activar tracker con $50,000.00',
    );

    const holdingsCalls = calls.filter((c) => c.path.endsWith('/holdings'));
    expect(holdingsCalls.length).toBe(1);
  });

  test('capital muy bajo → todas las shares en 0, banner y CTA deshabilitado', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockActivationApi(page);
    await page.goto(DETAIL_URL);
    await expect(page.getByTestId('activation-flow')).toBeVisible();

    await page.getByLabel('Capital (USD)').fill('100');

    await expect(page.getByTestId('banner-low-capital')).toBeVisible();
    await expect(page.getByTestId('activation-cta')).toBeDisabled();
  });

  test('activar → POST {initial_cash} y navega al detalle', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockActivationApi(page);
    await page.goto(DETAIL_URL);
    await expect(page.getByTestId('activation-flow')).toBeVisible();

    await page.getByTestId('activation-cta').click();

    await expect(page.getByTestId('tracker-header')).toBeVisible();
    await expect(page.getByTestId('tracker-status-badge')).toHaveText('Activo');

    const post = calls.find((c) => c.method === 'POST' && c.path.endsWith('/tracker'));
    expect(post?.body).toEqual({ initial_cash: 100000 });
  });

  test('422 en el POST → banner rojo con el detail del backend', async ({ page }) => {
    await seedAuth(page);
    await mockActivationApi(page, {
      createStatus: 422,
      createDetail: 'Ninguna posición alcanza 1 acción entera con ese capital',
    });
    await page.goto(DETAIL_URL);
    await expect(page.getByTestId('activation-flow')).toBeVisible();

    await page.getByTestId('activation-cta').click();

    const banner = page.getByTestId('activation-error');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(
      'Ninguna posición alcanza 1 acción entera con ese capital',
    );
    // Sigue en el flujo de activación
    await expect(page.getByTestId('activation-flow')).toBeVisible();
  });

  test('409 (ya existe tracker) → redirige al detalle existente', async ({ page }) => {
    await seedAuth(page);
    // StrictMode dispara el GET inicial dos veces; ambos deben dar 404 para
    // que se muestre la activación. A partir del tercero, el tracker "existe".
    await mockActivationApi(page, {
      createStatus: 409,
      createDetail: 'Tracker already exists',
      notFoundTimes: 2,
    });
    await page.goto(DETAIL_URL);
    await expect(page.getByTestId('activation-flow')).toBeVisible();

    await page.getByTestId('activation-cta').click();

    await expect(page.getByTestId('tracker-header')).toBeVisible();
    await expect(page.getByTestId('activation-flow')).not.toBeVisible();
  });

  test('universo vacío → estado dedicado sin tabla', async ({ page }) => {
    await seedAuth(page);
    await mockActivationApi(page, {
      preview: { ...PREVIEW, holdings: [], warnings: ['universe resolved empty'] },
    });
    await page.goto(DETAIL_URL);

    await expect(page.getByTestId('activation-empty')).toBeVisible();
    await expect(page.getByTestId('activation-empty')).toContainText(
      'universo resolvió vacío',
    );
  });
});
