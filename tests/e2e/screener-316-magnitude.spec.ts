import { test, expect, type Page } from '@playwright/test';

/**
 * E2E de #316 (backend) — el indicador Magnitude (`ade.magnitude`, Trendrating)
 * en el screener (filtro de rango + columna en el preset ADE), en el Strategy
 * Builder (ranking key → `spec.selection.sort_by`) y en el constructor de
 * alertas (catálogo de `/alerts/fields`, formato `level`, decimales).
 *
 * API mockeada por rutas; contrato del backend mergeado en #315:
 *   - `ScreenerRequest.magnitude: RangeFilter | None`
 *   - `ScreenerResult.magnitude: Decimal | None` (niveles 0.05…0.95)
 *   - `AlertFieldDef("magnitude", …, "decimal", "level", (LTE, GTE), …)`
 * Regla del dueño (D2/D8): sólo `magnitude` se expone, nunca sus internas.
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

// ---------------------------------------------------------------------------
// Screener
// ---------------------------------------------------------------------------

function stock(overrides: Record<string, unknown>) {
  return {
    symbol_id: 'sc-x',
    ticker: 'XXX',
    name: 'X Corp',
    country: 'US',
    exchange: 'NASDAQ',
    sector: 'Technology',
    rating: 2,
    pe_ratio: 20,
    return_1m: 1,
    return_3m: 2,
    return_12m: 3,
    dividend_yield: null,
    liquidity_usd_m: 10,
    pending_deal: null,
    deal_status: null,
    magnitude: null,
    ...overrides,
  };
}

const SCREENER_RESULTS = {
  results: [
    stock({ symbol_id: 'sc-1', ticker: 'ERLY', name: 'Early Run Inc.', magnitude: 0.83 }),
    stock({ symbol_id: 'sc-2', ticker: 'NRUN', name: 'Flat Line Corp.', magnitude: null }),
  ],
  total_count: 2,
  limit: 50,
  offset: 0,
};

async function mockScreenerApi(page: Page): Promise<Record<string, unknown>[]> {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/screener/options', (route) =>
    route.fulfill({
      json: { countries: ['US'], exchanges: ['NASDAQ'], sectors: ['Technology'] },
    }),
  );
  await page.route('**/screener/presets/*', (route) =>
    route.fulfill({ json: { items: [], total: 0, limit: 50, offset: 0 } }),
  );
  await page.route('**/screener/', async (route) => {
    if (route.request().method() === 'POST') {
      bodies.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ json: SCREENER_RESULTS });
      return;
    }
    await route.fallback();
  });
  return bodies;
}

test.describe('Screener — Magnitude (#316)', () => {
  test('(1) el filtro Magnitude mín 0.59 viaja como magnitude: { min: 0.59 }', async ({ page }) => {
    await seedAuth(page);
    const bodies = await mockScreenerApi(page);
    await page.goto('/dashboard/screening', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Early Run Inc.')).toBeVisible({ timeout: 60_000 });

    const addFilter = page.getByRole('button', { name: /Add Filter/ });
    await addFilter.click();
    // El contenedor más interno del botón «Add Filter» es el del menú; dentro,
    // «ADE» es la categoría (fuera hay una pestaña homónima de columnas).
    const menu = page.locator('div', { has: addFilter }).last();
    await menu.getByRole('button', { name: 'ADE', exact: true }).click();
    await menu.getByRole('button', { name: /^Magnitude/ }).click();
    await page.getByLabel('Minimum').fill('0.59');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect
      .poll(() => bodies.map((b) => JSON.stringify(b.magnitude ?? null)), { timeout: 30_000 })
      .toContain(JSON.stringify({ min: 0.59 }));
    const last = bodies[bodies.length - 1];
    // D2/D8: las internas nunca viajan.
    expect(Object.keys(last).filter((k) => k.startsWith('magnitude_'))).toEqual([]);
  });

  test('(2) la columna Magnitude del preset ADE muestra 0.83 y ordena por magnitude', async ({ page }) => {
    await seedAuth(page);
    const bodies = await mockScreenerApi(page);
    await page.goto('/dashboard/screening', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Early Run Inc.')).toBeVisible({ timeout: 60_000 });

    await page.getByRole('button', { name: 'ADE', exact: true }).click();
    const table = page.locator('table.tbl');
    const headers = table.locator('thead th');
    await expect(headers.filter({ hasText: /^Magnitude/ })).toHaveCount(1);
    const labels = await headers.allInnerTexts();
    // innerText refleja el text-transform del encabezado: comparar sin mayúsculas.
    const idx = labels.findIndex((t) => t.trim().toLowerCase().startsWith('magnitude'));
    expect(idx).toBeGreaterThan(-1);

    const early = table.locator('tbody tr', { hasText: 'ERLY' });
    await expect(early.locator('td').nth(idx)).toHaveText('0.83');
    const outOfRun = table.locator('tbody tr', { hasText: 'NRUN' });
    await expect(outOfRun.locator('td').nth(idx)).not.toHaveText(/\d/);

    await headers.nth(idx).click();
    await expect
      .poll(() => bodies.map((b) => b.sort_by), { timeout: 30_000 })
      .toContain('magnitude');
  });
});

// ---------------------------------------------------------------------------
// Strategy Builder
// ---------------------------------------------------------------------------

interface RecordedCall {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

async function mockBuilderApi(page: Page): Promise<RecordedCall[]> {
  const calls: RecordedCall[] = [];
  await page.route('**/templates/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/templates/', (route) => route.fulfill({ json: [] }));
  await page.route('**/backtests/*', (route) =>
    route.fulfill({ json: { job_id: 'j1', status: 'running', error: null, warnings: [], result: null } }),
  );
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
      await route.fulfill({ json: { job_id: 'j1', status: 'running', cached: false } });
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
    await route.fulfill({ json: [] });
  });
  return calls;
}

test.describe('Builder — Magnitude (#316)', () => {
  test('(3) «Rank by» Magnitude se guarda como selection.sort_by = magnitude', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockBuilderApi(page);
    await page.goto('/dashboard/builder');
    await page.getByRole('button', { name: 'New strategy' }).first().click();
    await page.getByPlaceholder('Strategy name').fill('E2E Magnitude rank');

    const rankBy = page.locator('.sb-field', { hasText: 'Rank by' }).locator('select');
    await rankBy.selectOption({ label: 'Magnitude (remaining run-up)' });

    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect
      .poll(() => calls.filter((c) => c.method === 'POST' && c.path.endsWith('/strategies/')).length)
      .toBeGreaterThan(0);
    const created = calls.find((c) => c.method === 'POST' && c.path.endsWith('/strategies/'));
    const spec = created?.body?.spec as Record<string, Record<string, unknown>>;
    expect(spec.selection.sort_by).toBe('magnitude');
  });

  test('(3b) Magnitude está entre los filtros de «Cycle & Trade» y viaja en el universo', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockBuilderApi(page);
    await page.goto('/dashboard/builder');
    await page.getByRole('button', { name: 'New strategy' }).first().click();
    await page.getByPlaceholder('Strategy name').fill('E2E Magnitude filter');

    // La primera caja de reglas del formulario es el universo.
    const addSelect = page.locator('.sb-fund-add select').first();
    await addSelect.selectOption({ label: 'Magnitude' });
    await page.getByLabel('Minimum').fill('0.59');
    await page.getByRole('button', { name: 'Apply' }).click();

    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect
      .poll(() => calls.filter((c) => c.method === 'POST' && c.path.endsWith('/strategies/')).length)
      .toBeGreaterThan(0);
    const created = calls.find((c) => c.method === 'POST' && c.path.endsWith('/strategies/'));
    const spec = created?.body?.spec as Record<string, Record<string, unknown>>;
    const where = { ...spec.universe, ...(spec.selection_rules ?? {}) } as Record<string, unknown>;
    expect(where.magnitude).toEqual({ min: 0.59 });
  });
});

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

const ALERT_FIELDS = [
  {
    key: 'magnitude',
    label: 'Magnitude (madurez de la tendencia)',
    category: 'rating_tendencia',
    dtype: 'decimal',
    unit: 'level',
    operators: ['lte', 'gte'],
    enabled: true,
    description:
      '0.95 = la tendencia apenas empieza; ≤ 0.14 = muy madura; 0.05 = agotada. "≤ 0.14" avisa de madurez; "≥ 0.83" de recorrido.',
  },
];

test.describe('Alertas — Magnitude (#316)', () => {
  test('(4) el builder lista Magnitude desde /alerts/fields y acepta 0.14 con ≤', async ({ page }) => {
    await seedAuth(page);
    const posts: Record<string, unknown>[] = [];
    await page.route('**/symbols/search**', (route) =>
      route.fulfill({
        json: [{ symbol_id: 's1', ticker: 'ALFA', name: 'Alfa Corp', exchange: 'NASDAQ', sector: 'Tech' }],
      }),
    );
    await page.route('**/alerts**', async (route) => {
      const req = route.request();
      if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') return route.fallback();
      const path = new URL(req.url()).pathname;
      if (path.endsWith('/alerts/fields')) return route.fulfill({ json: ALERT_FIELDS });
      if (path.endsWith('/alerts/events')) {
        return route.fulfill({ json: { items: [], total: 0, limit: 50, offset: 0 } });
      }
      if (req.method() === 'POST') {
        const body = req.postDataJSON() as Record<string, unknown>;
        posts.push(body);
        return route.fulfill({
          status: 201,
          json: {
            alert_id: 'new-1', user_id: USER.user_id, symbol_id: 's1', ticker: 'ALFA',
            armed: true, is_active: true, last_triggered_at: null,
            created_at: '2026-10-29T00:00:00Z', updated_at: '2026-10-29T00:00:00Z',
            current_value: null, ...body,
          },
        });
      }
      return route.fulfill({ json: { items: [], total: 0, limit: 200, offset: 0 } });
    });

    await page.goto('/dashboard/alerts');
    await page.getByTestId('new-alert').click();
    await page.getByTestId('symbol-search').fill('ALF');
    await page.getByTestId('symbol-option').first().click();

    const fieldSelect = page.getByTestId('field-select');
    await expect(fieldSelect.locator('option', { hasText: 'Magnitude' })).toHaveCount(1);
    await fieldSelect.selectOption('magnitude');
    await expect(page.getByTestId('operator-select')).toHaveValue('lte');
    await expect(page.getByTestId('operator-select').locator('option')).toHaveText([
      'menor o igual que',
      'mayor o igual que',
    ]);
    await page.getByTestId('threshold-input').fill('0.14');
    await expect(page.getByTestId('unit-suffix')).toHaveText('');
    await expect(page.getByTestId('preview')).toHaveText(
      'Avisarme cuando ALFA: Magnitude (madurez de la tendencia) menor o igual que 0.14',
    );

    await page.getByTestId('builder-save').click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({ field: 'magnitude', operator: 'lte', threshold: '0.14' });
  });
});
