import { test, expect, type Page } from '@playwright/test';

/**
 * E2E de #323 (épica backend #319) — la familia Runway (`ade.price_runway`,
 * `ade.time_runway`, `ade.trend_runway`) en el screener (filtros de rango +
 * columnas en el preset ADE), en el Strategy Builder (filtro de «Cycle & Trade»
 * y ranking key → `spec.selection.sort_by`) y en el constructor de alertas
 * (catálogo de `/alerts/fields`).
 *
 * API mockeada por rutas; contrato del backend mergeado en #322 (PR #325):
 *   - `ScreenerRequest.{price,time,trend}_runway: RangeFilter | None`
 *   - `ScreenerResultItem.{price,time,trend}_runway: Decimal | None`
 *   - `AlertFieldDef("price_runway" | "time_runway" | "trend_runway", …,
 *     "decimal", "level", (LTE, GTE), …)`
 * Renombrado en seco (E7): la clave del Price Runway ya no viaja nunca.
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
    price_runway: null,
    time_runway: null,
    trend_runway: null,
    ...overrides,
  };
}

const SCREENER_RESULTS = {
  results: [
    stock({
      symbol_id: 'sc-1', ticker: 'ERLY', name: 'Early Run Inc.',
      // El Decimal del backend viaja como string.
      price_runway: '0.83', time_runway: '0.73', trend_runway: '0.445',
    }),
    stock({ symbol_id: 'sc-2', ticker: 'NRUN', name: 'Flat Line Corp.' }),
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

const RUNWAY_KEYS = ['price_runway', 'time_runway', 'trend_runway'];
const OLD_KEY = ['mag', 'nitude'].join('');

test.describe('Screener — Runway (#323)', () => {
  test('(1) el filtro Trend Runway mín 0.5 viaja como trend_runway: { min: 0.5 }', async ({ page }) => {
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
    // Los tres Runway están en la categoría ADE.
    for (const label of ['Price Runway', 'Time Runway', 'Trend Runway']) {
      await expect(menu.getByRole('button', { name: new RegExp(`^${label}`) })).toHaveCount(1);
    }
    await menu.getByRole('button', { name: /^Trend Runway/ }).click();
    await page.getByLabel('Minimum').fill('0.5');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect
      .poll(() => bodies.map((b) => JSON.stringify(b.trend_runway ?? null)), { timeout: 30_000 })
      .toContain(JSON.stringify({ min: 0.5 }));
    const last = bodies[bodies.length - 1];
    // Renombrado en seco: ninguna clave del nombre anterior viaja.
    expect(Object.keys(last).filter((k) => k.startsWith(OLD_KEY))).toEqual([]);
  });

  test('(2) las columnas Runway del preset ADE muestran 0.83 / 0.73 / 0.445 y ordenan', async ({ page }) => {
    await seedAuth(page);
    const bodies = await mockScreenerApi(page);
    await page.goto('/dashboard/screening', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Early Run Inc.')).toBeVisible({ timeout: 60_000 });

    await page.getByRole('button', { name: 'ADE', exact: true }).click();
    const table = page.locator('table.tbl');
    const headers = table.locator('thead th');
    await expect(headers.filter({ hasText: /^Price Runway/i })).toHaveCount(1);
    // innerText refleja el text-transform del encabezado: comparar sin mayúsculas.
    const labels = (await headers.allInnerTexts()).map((t) => t.trim().toLowerCase());
    expect(labels.some((t) => t.startsWith(OLD_KEY))).toBe(false);

    const early = table.locator('tbody tr', { hasText: 'ERLY' });
    const outOfRun = table.locator('tbody tr', { hasText: 'NRUN' });
    const expected: [string, string][] = [
      ['price runway', '0.83'],
      ['time runway', '0.73'],
      ['trend runway', '0.445'],
    ];
    for (const [label, value] of expected) {
      const idx = labels.findIndex((t) => t.startsWith(label));
      expect(idx, label).toBeGreaterThan(-1);
      await expect(early.locator('td').nth(idx)).toHaveText(value);
      await expect(outOfRun.locator('td').nth(idx)).not.toHaveText(/\d/);
    }

    const trendIdx = labels.findIndex((t) => t.startsWith('trend runway'));
    await headers.nth(trendIdx).click();
    await expect
      .poll(() => bodies.map((b) => b.sort_by), { timeout: 30_000 })
      .toContain('trend_runway');
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

test.describe('Builder — Runway (#323)', () => {
  test('(3) «Rank by» Trend Runway + filtro Time Runway se guardan en el spec', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockBuilderApi(page);
    await page.goto('/dashboard/builder');
    await page.getByRole('button', { name: 'New strategy' }).first().click();
    await page.getByPlaceholder('Strategy name').fill('E2E Runway');

    const rankBy = page.locator('.sb-field', { hasText: 'Rank by' }).locator('select');
    for (const label of [
      'Price Runway (remaining run-up)',
      'Time Runway (remaining time)',
      'Trend Runway (upside potential)',
    ]) {
      await expect(rankBy.locator('option', { hasText: label })).toHaveCount(1);
    }
    await rankBy.selectOption({ label: 'Trend Runway (upside potential)' });

    // La primera caja de reglas del formulario es el universo.
    const addSelect = page.locator('.sb-fund-add select').first();
    await addSelect.selectOption({ label: 'Time Runway' });
    await page.getByLabel('Minimum').fill('0.3');
    await page.getByRole('button', { name: 'Apply' }).click();

    await page.getByRole('button', { name: 'Save & backtest' }).click();
    await expect
      .poll(() => calls.filter((c) => c.method === 'POST' && c.path.endsWith('/strategies/')).length)
      .toBeGreaterThan(0);
    const created = calls.find((c) => c.method === 'POST' && c.path.endsWith('/strategies/'));
    const spec = created?.body?.spec as Record<string, Record<string, unknown>>;
    expect(spec.selection.sort_by).toBe('trend_runway');
    const where = { ...spec.universe, ...(spec.selection_rules ?? {}) } as Record<string, unknown>;
    expect(where.time_runway).toEqual({ min: 0.3 });
    expect(JSON.stringify(spec)).not.toContain(OLD_KEY);
  });

  test('(3b) los tres Runway están entre los filtros de «Cycle & Trade»', async ({ page }) => {
    await seedAuth(page);
    await mockBuilderApi(page);
    await page.goto('/dashboard/builder');
    await page.getByRole('button', { name: 'New strategy' }).first().click();
    const addSelect = page.locator('.sb-fund-add select').first();
    const group = addSelect.locator('optgroup[label="Cycle & Trade"]');
    for (const key of RUNWAY_KEYS) {
      await expect(group.locator(`option[value="${key}"]`)).toHaveCount(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

// Copia de las entradas de `app/services/alert_catalog.py` (#322).
const ALERT_FIELDS = [
  {
    key: 'price_runway',
    label: 'Price Runway (recorrido restante)',
    category: 'rating_tendencia',
    dtype: 'decimal',
    unit: 'level',
    operators: ['lte', 'gte'],
    enabled: true,
    description:
      '0.95 = la tendencia apenas empieza; ≤ 0.14 = muy madura; 0.05 = agotada. "≤ 0.14" avisa de madurez; "≥ 0.83" de recorrido.',
  },
  {
    key: 'time_runway',
    label: 'Time Runway (tiempo restante)',
    category: 'rating_tendencia',
    dtype: 'decimal',
    unit: 'level',
    operators: ['lte', 'gte'],
    enabled: true,
    description: '0.95 = la tendencia es joven; ≤ 0.30 = madura; 0.05 = más larga que casi todas.',
  },
  {
    key: 'trend_runway',
    label: 'Trend Runway (potencial restante)',
    category: 'rating_tendencia',
    dtype: 'decimal',
    unit: 'level',
    operators: ['lte', 'gte'],
    enabled: true,
    description: 'Media de Time y Price Runway: alto = espacio para continuar, no fuerza; ≤ 0.12 = agotada.',
  },
];

test.describe('Alertas — Runway (#323)', () => {
  test('(4) el builder lista los tres Runway desde /alerts/fields y acepta 0.12 con ≤', async ({ page }) => {
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
    for (const label of ['Price Runway', 'Time Runway', 'Trend Runway']) {
      await expect(fieldSelect.locator('option', { hasText: label })).toHaveCount(1);
    }
    await expect(fieldSelect.locator('option', { hasText: new RegExp(OLD_KEY, 'i') })).toHaveCount(0);
    await fieldSelect.selectOption('trend_runway');
    await expect(page.getByTestId('operator-select')).toHaveValue('lte');
    await expect(page.getByTestId('operator-select').locator('option')).toHaveText([
      'menor o igual que',
      'mayor o igual que',
    ]);
    await page.getByTestId('threshold-input').fill('0.12');
    await expect(page.getByTestId('unit-suffix')).toHaveText('');
    await expect(page.getByTestId('preview')).toHaveText(
      'Avisarme cuando ALFA: Trend Runway (potencial restante) menor o igual que 0.12',
    );

    await page.getByTestId('builder-save').click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({ field: 'trend_runway', operator: 'lte', threshold: '0.12' });
  });
});
