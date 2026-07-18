import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #59 — Template gallery + create-from-template (server-side).
 *
 * API route-mocked. Asserts: the gallery renders the catalog (with the PAUSED
 * badge + disabled CTA), creating from a template POSTs {template, name} and
 * NEVER a client-built spec (the #34 anti-truncation guarantee), and the list
 * shows the provenance chip with the "vN available" upgrade notice.
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

const TEMPLATES = [
  {
    slug: 'income',
    title: 'Income',
    description: 'Dividenderas líquidas con FCF yield sano (MFH_ALEX Income).',
    status: 'active',
    latest_version: 2,
    updated_at: '2026-07-01T00:00:00Z',
    summary: { filters_count: 11, top_n: 30, cadence: 'monthly', weighting: 'equal', objective_metric: 'sharpe' },
  },
  {
    slug: 'especulativo',
    title: 'Especulativo (en pausa)',
    description: 'Mid caps de alto crecimiento. EN PAUSA: pool insuficiente.',
    status: 'paused',
    latest_version: 1,
    updated_at: '2026-07-01T00:00:00Z',
    summary: { filters_count: 9, top_n: 15, cadence: 'monthly', weighting: 'equal', objective_metric: 'sharpe' },
  },
];

// A minimal-but-plausible server spec for the list item (display only).
const SERVER_SPEC = {
  general: { instrument_type: 'stocks', currency: 'USD', benchmark: 'SPY', performance_metric: 'total_return' },
  universe: { country: ['US'], rating: { min: 1 }, dividend_yield: { min: 0.02 } },
  entry_exit: {
    mode: 'trade_state', min_er: 0.3, max_sm_atr_mult: 10, atr_spike_mult: 2,
    trail_atr_mult: 3, emergency_atr_mult: 4, exit_rating_long: -1, exit_rating_short: 1,
    use_trail_stop: false,
  },
  selection: { sort_by: 'rating', sort_order: 'desc', top_n: 30, per_sector: 4 },
  weighting: { method: 'equal' },
  rebalance: { cadence: 'monthly' },
  costs: { commission_bps: 0, slippage_bps: 0 },
  validation: { start: '2018-01-01', end: '2024-12-31', oos_split: 0.3, min_n_trades: 10 },
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

async function mockApi(
  page: Page,
  opts: { strategies?: unknown[] } = {},
): Promise<RecordedPost[]> {
  const posts: RecordedPost[] = [];

  await page.route('**/templates/**', (route) => route.fulfill({ json: TEMPLATES }));
  await page.route('**/templates/', (route) => route.fulfill({ json: TEMPLATES }));

  await page.route('**/backtests/*', (route) =>
    route.fulfill({ json: { job_id: 'j1', status: 'error', error: 'e2e stop' } }),
  );
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (method === 'POST' && url.pathname.endsWith('/backtest')) {
      await route.fulfill({ json: { job_id: 'j1', status: 'error' } });
      return;
    }
    if (method === 'POST') {
      posts.push({ path: url.pathname, body: route.request().postDataJSON() });
      await route.fulfill({
        status: 201,
        json: { strategy_id: 'new-59', version: 1, content_hash: 'cafe'.repeat(16) },
      });
      return;
    }
    await route.fulfill({ json: opts.strategies ?? [] });
  });

  return posts;
}

test.describe('Builder — template gallery (#59)', () => {
  test('la galería lista el catálogo y crear desde template postea {template, name} sin spec', async ({
    page,
  }) => {
    await seedAuth(page);
    const posts = await mockApi(page);

    await page.goto('/dashboard/builder');
    await page.getByRole('button', { name: 'From template' }).click();

    // Cards del catálogo con chips y badge de pausa
    await expect(page.getByText('Income', { exact: true })).toBeVisible();
    await expect(page.getByText('11 filters')).toBeVisible();
    await expect(page.getByText('PAUSED')).toBeVisible();

    // CTA deshabilitado en el template pausado
    const pausedCard = page.locator('.tg-card.paused');
    await expect(pausedCard.getByRole('button', { name: 'Use template' })).toBeDisabled();

    // Crear desde income: server-side, jamás un spec construido en el cliente
    const incomeCard = page.locator('.tg-card', { hasText: 'Income' }).first();
    await incomeCard.getByRole('button', { name: 'Use template' }).click();
    await incomeCard.locator('.tg-name-input').fill('Mi Income E2E');
    await incomeCard.getByRole('button', { name: 'Create' }).click();

    await expect.poll(() => posts.length).toBeGreaterThan(0);
    const created = posts.find((p) => p.path.endsWith('/strategies/'));
    expect(created).toBeTruthy();
    expect(created?.body.template).toBe('income');
    expect(created?.body.name).toBe('Mi Income E2E');
    expect(created?.body.spec).toBeUndefined(); // el spec canónico lo pone el server

    // Vuelve a la lista tras crear
    await expect(page.getByRole('button', { name: 'From template' })).toBeVisible();
  });

  test('la lista muestra la procedencia y el aviso de versión nueva del template', async ({
    page,
  }) => {
    await seedAuth(page);
    await mockApi(page, {
      strategies: [
        {
          strategy_id: '33333333-3333-3333-3333-333333333333',
          name: 'Mi Income',
          description: null,
          latest_version: 1,
          created_at: '2026-07-01T00:00:00Z',
          updated_at: '2026-07-02T00:00:00Z',
          spec: SERVER_SPEC,
          template_slug: 'income',
          template_version: 1, // el catálogo va por la v2 → aviso de upgrade
        },
      ],
    });

    await page.goto('/dashboard/builder');
    await expect(page.getByText('from income v1')).toBeVisible();
    await expect(page.getByText('v2 available')).toBeVisible();
  });

  test('editar una estrategia con filtros live-only muestra el banner y los preserva al guardar', async ({
    page,
  }) => {
    await seedAuth(page);
    const posts = await mockApi(page, {
      strategies: [
        {
          strategy_id: '33333333-3333-3333-3333-333333333333',
          name: 'Mi Income',
          description: null,
          latest_version: 1,
          created_at: '2026-07-01T00:00:00Z',
          updated_at: '2026-07-02T00:00:00Z',
          spec: SERVER_SPEC,
          template_slug: 'income',
          template_version: 1,
        },
      ],
    });

    await page.goto('/dashboard/builder');
    // Sin backtest → click abre el editor
    await page.getByText('Mi Income', { exact: true }).click();

    // Banner read-only con el filtro live-only que el form no expone
    await expect(page.locator('.sb-preserved-note')).toBeVisible();
    await expect(page.locator('.sb-preserved-note')).toContainText('dividend_yield');

    // Guardar → el POST lleva el spec MERGEADO: dividend_yield sobrevive (#34)
    await page.getByRole('button', { name: /Save & backtest/i }).click();
    await expect
      .poll(() => posts.filter((p) => p.path.endsWith('/strategies/')).length)
      .toBeGreaterThan(0);
    const created = posts.find((p) => p.path.endsWith('/strategies/'));
    const spec = created?.body.spec as { universe: Record<string, unknown> };
    expect(spec.universe.dividend_yield).toEqual({ min: 0.02 });
    expect(created?.body.template).toBeUndefined();
  });
});
