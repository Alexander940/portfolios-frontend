import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #5 — tracker detail: header, state banners and actions.
 *
 * All API endpoints are route-mocked (contract from the issue), so this is
 * deterministic and needs no backend. Decimal fields are strings on purpose:
 * the backend serializes Pydantic Decimals that way.
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
  initial_cash: '10000.00',
  started_at: '2026-01-02',
  last_rebalance_date: '2026-07-01',
  next_rebalance_date: '2026-07-15',
  last_evaluated_date: '2026-07-08',
  force_rebalance: false,
  notifications_enabled: true,
  last_error: null,
  created_at: '2026-01-02T00:00:00Z',
  version: 2,
  latest_version: 3,
  total_value: '12345.67',
  cash: '512.34',
  pnl_total: '2345.67',
  pnl_total_pct: '23.46',
  pnl_day: '-12.50',
  pnl_day_pct: '-0.10',
  holdings_count: 14,
};

const HOLDINGS = {
  data_as_of: '2026-07-08',
  warnings: [
    'La regla de salida custom contiene una cláusula inerte (inert clause) que no se aplica en v1.',
  ],
  holdings: [],
};

interface RecordedCall {
  method: string;
  path: string;
  query: string;
  body: unknown;
}

interface MockOptions {
  tracker?: Record<string, unknown>;
  trackerStatus?: number;
  patchStatus?: number;
  patchDetail?: string;
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

/**
 * Single dispatcher for every /strategies/** endpoint; records calls so tests
 * can assert methods/bodies. PATCH merges into the current tracker unless
 * `patchStatus` forces an error response.
 */
async function mockTrackerApi(page: Page, opts: MockOptions = {}): Promise<RecordedCall[]> {
  const calls: RecordedCall[] = [];
  let tracker = { ...(opts.tracker ?? TRACKER) };

  // El detalle también carga posiciones (#7); aquí basta un libro vacío.
  await page.route('**/portfolios/*/positions*', (route) =>
    route.fulfill({ json: { items: [], total: 0, limit: 200, offset: 0 } }),
  );

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
    calls.push({ method, path: url.pathname, query: url.search, body });

    if (url.pathname.endsWith('/tracker/rebase') && method === 'POST') {
      const version = (body as { version: number }).version;
      tracker = { ...tracker, version, force_rebalance: true };
      await route.fulfill({ json: tracker });
      return;
    }
    if (url.pathname.endsWith('/holdings')) {
      await route.fulfill({ json: HOLDINGS });
      return;
    }
    if (url.pathname.endsWith('/tracker')) {
      if (method === 'GET') {
        if (opts.trackerStatus && opts.trackerStatus !== 200) {
          await route.fulfill({
            status: opts.trackerStatus,
            json: { detail: 'Tracker not found' },
          });
        } else {
          await route.fulfill({ json: tracker });
        }
        return;
      }
      if (method === 'PATCH') {
        if (opts.patchStatus && opts.patchStatus !== 200) {
          await route.fulfill({
            status: opts.patchStatus,
            json: { detail: opts.patchDetail ?? 'PATCH rejected' },
          });
        } else {
          tracker = { ...tracker, ...(body as Record<string, unknown>) };
          await route.fulfill({ json: tracker });
        }
        return;
      }
      if (method === 'DELETE') {
        await route.fulfill({ status: 204, body: '' });
        return;
      }
    }
    await route.fulfill({ status: 404, json: { detail: 'Not mocked' } });
  });

  return calls;
}

const DETAIL_URL = `/dashboard/strategy/${STRATEGY_ID}`;

test.describe('Tracker detail — header, banners y acciones (#5)', () => {
  test('renderiza header con stats, fechas, badge de status y badge data_as_of', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockTrackerApi(page);
    await page.goto(DETAIL_URL);

    const header = page.getByTestId('tracker-header');
    await expect(header).toBeVisible();
    await expect(page.getByTestId('tracker-status-badge')).toHaveText('Activo');

    // Stats formateadas (Decimals llegan como string)
    await expect(page.getByTestId('stat-total-value')).toContainText('$12,345.67');
    await expect(page.getByTestId('stat-cash')).toContainText('$512.34');
    await expect(page.getByTestId('stat-pnl-total')).toContainText('$2,345.67');
    await expect(page.getByTestId('stat-pnl-total')).toContainText('+23.46%');
    await expect(page.getByTestId('stat-initial-cash')).toContainText('$10,000.00');

    // 3 fechas, próximo rebalanceo destacado
    await expect(page.getByTestId('date-last-rebalance')).toContainText('Jul 1, 2026');
    await expect(page.getByTestId('date-next-rebalance')).toContainText('Jul 15, 2026');
    await expect(page.getByTestId('date-next-rebalance')).toHaveClass(/highlight/);
    await expect(page.getByTestId('date-last-evaluated')).toContainText('Jul 8, 2026');

    // Badge global de frescura + banner de cláusula inerte (warnings de holdings)
    await expect(page.getByTestId('tracker-asof')).toContainText('Datos al cierre de');
    await expect(page.getByTestId('banner-inert')).toBeVisible();
  });

  test('pausar/reanudar con optimistic update y PATCH correcto', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockTrackerApi(page);
    await page.goto(DETAIL_URL);

    await page.getByRole('button', { name: 'Pausar' }).click();
    await expect(page.getByTestId('banner-paused')).toBeVisible();
    await expect(page.getByTestId('tracker-status-badge')).toHaveText('Pausado');

    await expect
      .poll(() => calls.filter((c) => c.method === 'PATCH').length)
      .toBeGreaterThan(0);
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.body).toEqual({ status: 'paused' });

    // Reanudar desde el banner (la barra de acciones también ofrece Reanudar)
    await page
      .getByTestId('banner-paused')
      .getByRole('button', { name: 'Reanudar' })
      .click();
    await expect(page.getByTestId('banner-paused')).not.toBeVisible();
    await expect(page.getByTestId('tracker-status-badge')).toHaveText('Activo');
  });

  test('toggle de notificaciones envía PATCH parcial', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockTrackerApi(page);
    await page.goto(DETAIL_URL);

    await page.getByRole('button', { name: /Notificaciones: on/ }).click();
    await expect(page.getByRole('button', { name: /Notificaciones: off/ })).toBeVisible();

    await expect
      .poll(() => calls.filter((c) => c.method === 'PATCH').length)
      .toBeGreaterThan(0);
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.body).toEqual({ notifications_enabled: false });
  });

  test('error del PATCH → rollback + toast con el detail del body', async ({ page }) => {
    await seedAuth(page);
    await mockTrackerApi(page, {
      patchStatus: 422,
      patchDetail: 'No se puede pausar este tracker',
    });
    await page.goto(DETAIL_URL);

    await page.getByRole('button', { name: 'Pausar' }).click();

    // Toast con el detail y estado revertido
    await expect(page.getByTestId('toast')).toContainText(
      'No se puede pausar este tracker',
    );
    await expect(page.getByTestId('tracker-status-badge')).toHaveText('Activo');
    await expect(page.getByTestId('banner-paused')).not.toBeVisible();
  });

  test('tracker pausado muestra banner explicativo al cargar', async ({ page }) => {
    await seedAuth(page);
    await mockTrackerApi(page, { tracker: { ...TRACKER, status: 'paused' } });
    await page.goto(DETAIL_URL);

    const banner = page.getByTestId('banner-paused');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('catch-up');
  });

  test('tracker en error muestra last_error y Reactivar envía PATCH active', async ({
    page,
  }) => {
    await seedAuth(page);
    const calls = await mockTrackerApi(page, {
      tracker: { ...TRACKER, status: 'error', last_error: 'Falló la valuación del 2026-07-07' },
    });
    await page.goto(DETAIL_URL);

    const banner = page.getByTestId('banner-error');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Falló la valuación del 2026-07-07');

    await banner.getByRole('button', { name: 'Reactivar' }).click();
    await expect
      .poll(() => calls.filter((c) => c.method === 'PATCH').length)
      .toBeGreaterThan(0);
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.body).toEqual({ status: 'active' });
  });

  test('rebase: modal advierte rebalanceo inmediato y hace POST {version}', async ({
    page,
  }) => {
    await seedAuth(page);
    const calls = await mockTrackerApi(page);
    await page.goto(DETAIL_URL);

    await page.getByRole('button', { name: 'Actualizar versión' }).click();
    const dialog = page.getByRole('dialog', { name: 'Actualizar versión de la estrategia' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('rebalanceo inmediato');
    await expect(dialog).toContainText('la última disponible es la 3');

    await dialog.getByLabel('Versión destino').fill('3');
    await dialog.getByRole('button', { name: 'Actualizar versión' }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId('toast')).toContainText('versión 3');
    const rebase = calls.find((c) => c.path.endsWith('/tracker/rebase'));
    expect(rebase?.method).toBe('POST');
    expect(rebase?.body).toEqual({ version: 3 });
  });

  test('delete: checkbox keep_portfolio y navegación al índice', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockTrackerApi(page);
    await page.goto(DETAIL_URL);

    await page.getByRole('button', { name: 'Eliminar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Eliminar tracker' });
    await expect(dialog).toBeVisible();

    // keep_portfolio default true → desmarcar para borrarlo también.
    // El input del Checkbox es sr-only: se acciona clicando el label visible.
    await dialog.getByText('Conservar el portafolio asociado').click();
    await expect(dialog.getByLabel('Conservar el portafolio asociado')).not.toBeChecked();
    await dialog.getByRole('button', { name: 'Eliminar tracker' }).click();

    await expect(page).toHaveURL(/\/dashboard\/strategy$/);
    const del = calls.find((c) => c.method === 'DELETE');
    expect(del?.path.endsWith('/tracker')).toBe(true);
    expect(del?.query).toContain('keep_portfolio=false');
  });

  test('404 del tracker muestra el flujo de activación (#6)', async ({ page }) => {
    await seedAuth(page);
    await mockTrackerApi(page, { trackerStatus: 404 });
    await page.goto(DETAIL_URL);

    // El fixture de holdings de este spec no trae posiciones → el flujo de
    // activación muestra el estado de universo vacío. El flujo completo se
    // cubre en tracker-6-activation.spec.ts.
    await expect(page.getByTestId('activation-empty')).toBeVisible();
  });
});
