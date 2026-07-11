import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #13 — "Min weight per stock" in the Strategy Builder.
 *
 * API route-mocked. Asserts the three acceptance criteria: live min<max
 * validation, the dropped-and-redistributed tooltip, and a POSTed spec that
 * carries min_position_weight as a fraction ONLY when the user set it.
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

const RESOLVE_UNIVERSE = {
  as_of: '2026-07-10',
  alpha_window: '12m',
  alpha_metric: 'return',
  alpha_pit_safe: true,
  base_method: 'equal',
  total_market_cap: 0,
  eligible_count: 0,
  coverage_pct: 1,
  sectors: [],
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
}

async function mockApi(page: Page): Promise<RecordedPost[]> {
  const posts: RecordedPost[] = [];

  await page.route('**/backtests/*', (route) =>
    route.fulfill({ json: { job_id: 'j1', status: 'running' } }),
  );
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (method === 'POST') {
      posts.push({ path: url.pathname, body: route.request().postDataJSON() });
    }
    if (url.pathname.endsWith('/resolve-universe')) {
      await route.fulfill({ json: RESOLVE_UNIVERSE });
      return;
    }
    if (url.pathname.endsWith('/backtest') && method === 'POST') {
      await route.fulfill({ json: { job_id: 'j1', status: 'queued' } });
      return;
    }
    if (method === 'POST') {
      await route.fulfill({
        status: 201,
        json: { strategy_id: 'new-1', version: 1, name: 'E2E Min Weight' },
      });
      return;
    }
    // GET /strategies/ — lista vacía
    await route.fulfill({ json: [] });
  });

  return posts;
}

function fieldInput(page: Page, label: string) {
  return page.locator('.sb-field', { hasText: label }).locator('input');
}

async function openNewStrategyForm(page: Page): Promise<void> {
  await page.goto('/dashboard/builder');
  // La lista vacía muestra dos CTAs "New strategy" (header + empty state)
  await page.getByRole('button', { name: 'New strategy' }).first().click();
  await page.getByPlaceholder('Strategy name').fill('E2E Min Weight');
}

test.describe('Builder — min weight per stock (#13)', () => {
  test('el spec posteado lleva min_position_weight como fracción cuando se define', async ({
    page,
  }) => {
    await seedAuth(page);
    const posts = await mockApi(page);
    await openNewStrategyForm(page);

    await fieldInput(page, 'Max weight per stock').fill('15');
    await fieldInput(page, 'Min weight per stock').fill('5');

    await page.getByRole('button', { name: 'Save & backtest' }).click();

    await expect
      .poll(() => posts.filter((p) => p.path.endsWith('/strategies/')).length)
      .toBeGreaterThan(0);
    const created = posts.find((p) => p.path.endsWith('/strategies/'));
    const spec = created?.body.spec as Record<string, unknown>;
    expect(spec.min_position_weight).toBeCloseTo(0.05);
    expect(spec.max_position_weight).toBeCloseTo(0.15);
  });

  test('el campo se omite del spec cuando el usuario no lo define', async ({ page }) => {
    await seedAuth(page);
    const posts = await mockApi(page);
    await openNewStrategyForm(page);

    // Min queda vacío a propósito
    await page.getByRole('button', { name: 'Save & backtest' }).click();

    await expect
      .poll(() => posts.filter((p) => p.path.endsWith('/strategies/')).length)
      .toBeGreaterThan(0);
    const created = posts.find((p) => p.path.endsWith('/strategies/'));
    const spec = created?.body.spec as Record<string, unknown>;
    expect('min_position_weight' in spec).toBe(false);
  });

  test('validación en vivo: min >= max bloquea el submit con mensaje', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await openNewStrategyForm(page);

    await fieldInput(page, 'Max weight per stock').fill('15');
    await fieldInput(page, 'Min weight per stock').fill('20');

    // El tooltip repite la frase → asertar sobre el elemento de error del campo
    await expect(
      page.locator('.sb-field-error', { hasText: 'Must be below the max weight' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save & backtest' })).toBeDisabled();

    // Rango (0,100): 0 no es válido
    await fieldInput(page, 'Min weight per stock').fill('0');
    await expect(
      page.locator('.sb-field-error', { hasText: 'Must be between 0 and 100' }),
    ).toBeVisible();

    // Corregir el valor rehabilita el submit
    await fieldInput(page, 'Min weight per stock').fill('5');
    await expect(page.getByRole('button', { name: 'Save & backtest' })).toBeEnabled();
  });

  test('tooltip con la semántica de eliminación/redistribución', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await openNewStrategyForm(page);

    const minField = page.locator('.sb-field', { hasText: 'Min weight per stock' });
    await expect(minField.locator('.sb-tip-pop')).toContainText(
      'dropped and their weight is redistributed',
    );
    await expect(minField.locator('.sb-tip-pop')).toContainText(
      'fewer positions than the top-N',
    );
  });
});
