import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #131 — the Layer-1 method selector in the Strategy Builder
 * (`universe_marketcap` vs `top_marketcap` + top_n). API route-mocked.
 *
 * Beyond the happy path, this pins the two silent-failure traps the feature
 * had to work around:
 *  - buildLayered's early return used to drop the WHOLE `layered` clause when
 *    everything but Layer 1 was default → the method vanished on save.
 *  - useResolveSectors keyed its refetch on the universe only → the sector
 *    table kept showing the OLD base after switching method (wrong data that
 *    looks like a working feature).
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

/** Two visibly different bases so "the table actually re-rendered" is assertable. */
const UNIVERSE_BASE = {
  as_of: '2026-07-29',
  alpha_window: '12m',
  alpha_metric: 'median_member_alpha',
  alpha_pit_safe: false,
  base_method: 'universe_marketcap',
  top_n: null,
  total_market_cap: 1000e9,
  eligible_count: 50,
  coverage_pct: 1,
  sectors: [
    { sector: 'Energy', member_count: 3, alpha_coverage: 3, base_weight_pct: 99, alpha_vs_spy: 1 },
    { sector: 'Technology', member_count: 1, alpha_coverage: 0, base_weight_pct: 1, alpha_vs_spy: null },
  ],
};
const TOP_N_BASE = {
  ...UNIVERSE_BASE,
  base_method: 'top_marketcap',
  top_n: 700,
  sectors: [
    { sector: 'Technology', member_count: 1, alpha_coverage: 0, base_weight_pct: 80, alpha_vs_spy: null },
    { sector: 'Energy', member_count: 3, alpha_coverage: 3, base_weight_pct: 20, alpha_vs_spy: 1 },
  ],
};

interface RecordedPost {
  path: string;
  body: Record<string, unknown>;
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
  // (patrón: SOLO /alerts/events/** — nunca **/alerts/** porque intercepta
  // los módulos de Vite de src/features/alerts).
  await page.route('**/alerts/events/**', (route) => route.fulfill({ json: { count: 0 } }));
}

async function mockApi(page: Page): Promise<{ posts: RecordedPost[]; resolves: RecordedPost[] }> {
  const posts: RecordedPost[] = [];
  const resolves: RecordedPost[] = [];

  await page.route('**/backtests/*', (route) =>
    route.fulfill({ json: { job_id: 'j1', status: 'running' } }),
  );
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname.endsWith('/resolve-universe')) {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      resolves.push({ path: url.pathname, body });
      // Answer with the base the request actually asked for, so a stale request
      // shows up as stale data in the table.
      const layer1 = body.layer1 as { method?: string } | undefined;
      await route.fulfill({
        json: layer1?.method === 'top_marketcap' ? TOP_N_BASE : UNIVERSE_BASE,
      });
      return;
    }
    if (method === 'POST') {
      posts.push({ path: url.pathname, body: route.request().postDataJSON() });
    }
    if (url.pathname.endsWith('/backtest') && method === 'POST') {
      await route.fulfill({ json: { job_id: 'j1', status: 'queued' } });
      return;
    }
    if (method === 'POST') {
      await route.fulfill({
        status: 201,
        json: { strategy_id: 'new-1', version: 1, name: 'E2E Top MarketCap' },
      });
      return;
    }
    await route.fulfill({ json: [] }); // GET /strategies/ — lista vacía
  });

  return { posts, resolves };
}

async function openNewStrategyForm(page: Page): Promise<void> {
  await page.goto('/dashboard/builder');
  await page.getByRole('button', { name: 'New strategy' }).first().click();
  await page.getByPlaceholder('Strategy name').fill('E2E Top MarketCap');
}

const lastResolve = (resolves: RecordedPost[]) =>
  resolves[resolves.length - 1]?.body.layer1 as Record<string, unknown> | undefined;

async function createdSpec(posts: RecordedPost[]): Promise<Record<string, unknown>> {
  await expect.poll(() => posts.filter((p) => p.path.endsWith('/strategies/')).length).toBeGreaterThan(0);
  const created = posts.find((p) => p.path.endsWith('/strategies/'));
  return created?.body.spec as Record<string, unknown>;
}

test.describe('Builder — Layer-1 top_marketcap (#131)', () => {
  test('por defecto previsualiza la base del universo y no manda top_n', async ({ page }) => {
    await seedAuth(page);
    const { resolves } = await mockApi(page);
    await openNewStrategyForm(page);

    // La sección 5 está abierta al montar → el preview dispara solo.
    await expect.poll(() => resolves.length).toBeGreaterThan(0);
    const layer1 = lastResolve(resolves)!;
    expect(layer1.method).toBe('universe_marketcap');
    // top_n presente (aunque sea null) es un 422 del backend.
    expect('top_n' in layer1).toBe(false);
  });

  test('elegir top_marketcap refetchea el preview y repinta la tabla', async ({ page }) => {
    await seedAuth(page);
    const { resolves } = await mockApi(page);
    await openNewStrategyForm(page);
    await expect.poll(() => resolves.length).toBeGreaterThan(0);
    const before = resolves.length;

    await page.getByTestId('sb-layer1-top_marketcap').click();

    // Un request NUEVO con el método y el top_n por defecto...
    await expect.poll(() => resolves.length).toBeGreaterThan(before);
    await expect.poll(() => lastResolve(resolves)?.method).toBe('top_marketcap');
    expect(lastResolve(resolves)!.top_n).toBe(700);

    // ...y la respuesta efectivamente consumida: Technology pasa de 1% a 80%.
    await expect(page.getByText('80.0%')).toBeVisible();
  });

  test('editar el tamaño de la población dispara otro preview', async ({ page }) => {
    await seedAuth(page);
    const { resolves } = await mockApi(page);
    await openNewStrategyForm(page);
    await page.getByTestId('sb-layer1-top_marketcap').click();
    await expect.poll(() => lastResolve(resolves)?.method).toBe('top_marketcap');

    await page.getByTestId('sb-layer1-top-n').fill('300');

    // El array de dependencias del hook incluye el layer1 serializado.
    await expect.poll(() => lastResolve(resolves)?.top_n).toBe(300);
  });

  test('TRAMPA: top_marketcap con todo lo demás en default NO descarta la cláusula layered', async ({
    page,
  }) => {
    await seedAuth(page);
    const { posts } = await mockApi(page);
    await openNewStrategyForm(page);

    // Nada más se toca: layer3 equal, sin tilts, sin caps, sin gamma.
    await page.getByTestId('sb-layer1-top_marketcap').click();
    await page.getByRole('button', { name: 'Save & backtest' }).click();

    const spec = await createdSpec(posts);
    expect('layered' in spec).toBe(true);
    const layered = spec.layered as Record<string, Record<string, unknown>>;
    expect(layered.layer1).toEqual({ method: 'top_marketcap', top_n: 700 });
  });

  test('gemelo de regresión: todo en default sigue OMITIENDO layered', async ({ page }) => {
    await seedAuth(page);
    const { posts } = await mockApi(page);
    await openNewStrategyForm(page);

    // Sin tocar la Capa 1 → el spec debe quedar igual que antes del feature, o
    // cambiaría el content_hash de toda estrategia plana ya guardada.
    await page.getByRole('button', { name: 'Save & backtest' }).click();

    const spec = await createdSpec(posts);
    expect('layered' in spec).toBe(false);
  });
});
