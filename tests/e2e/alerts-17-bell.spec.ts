import { test, expect, type Page } from '@playwright/test';

/**
 * E2E issue #17 — campana de notificaciones en el topbar.
 * API mockeada (contrato backend #92). Sin afordances de tiempo real: los
 * eventos llegan una vez al día tras el cierre.
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

const EVENTS = [
  {
    event_id: 'ev1', alert_id: 'a1', symbol_id: 's1', ticker: 'NVDA',
    data_date: '2026-07-21', field: 'retracement', operator: 'gt',
    threshold: '0.15', observed_value: '0.178',
    title: 'NVDA: Retroceso del ciclo 17.8% superó tu umbral de 15%',
    read_at: null, created_at: '2026-07-22T06:00:00Z',
  },
  {
    event_id: 'ev2', alert_id: 'a2', symbol_id: 's2', ticker: 'AAPL',
    data_date: '2026-07-20', field: 'rating', operator: 'change',
    threshold: null, observed_value: '-1',
    title: 'AAPL: Rating ADE cambió de 1 a -1',
    read_at: null, created_at: '2026-07-21T06:00:00Z',
  },
  {
    event_id: 'ev3', alert_id: 'a1', symbol_id: 's1', ticker: 'NVDA',
    data_date: '2026-07-18', field: 'retracement', operator: 'gt',
    threshold: '0.15', observed_value: '0.16',
    title: 'NVDA: Retroceso del ciclo 16% superó tu umbral de 15%',
    read_at: '2026-07-19T08:00:00Z', created_at: '2026-07-19T06:00:00Z',
  },
];

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

interface Handle {
  count: number;
  markCalls: Record<string, unknown>[];
}

async function mockApi(page: Page, opts: { count?: number; events?: typeof EVENTS } = {}) {
  const handle: Handle = { count: opts.count ?? 2, markCalls: [] };
  const events = opts.events ?? EVENTS;

  await page.route('**/symbols/**', (route) => {
    if (route.request().resourceType() !== 'xhr' && route.request().resourceType() !== 'fetch') {
      return route.fallback();
    }
    return route.fulfill({
      json: {
        symbol_id: 's1', ticker: 'NVDA', name: 'NVIDIA', exchange: null,
        sector: null, period: '1y', prices: [],
      },
    });
  });

  await page.route('**/alerts**', async (route) => {
    const req = route.request();
    if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') {
      return route.fallback();
    }
    const path = new URL(req.url()).pathname;
    const method = req.method();
    if (path.endsWith('/alerts/fields')) return route.fulfill({ json: [] });
    if (path.endsWith('/events/unread-count')) {
      return route.fulfill({ json: { count: handle.count } });
    }
    if (path.endsWith('/events/mark-read') && method === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown>;
      handle.markCalls.push(body);
      const marked = body.all ? handle.count : ((body.event_ids as string[]) ?? []).length;
      handle.count = body.all ? 0 : Math.max(0, handle.count - marked);
      return route.fulfill({ json: { marked } });
    }
    if (path.endsWith('/alerts/events')) {
      return route.fulfill({
        json: { items: events, total: events.length, limit: 10, offset: 0 },
      });
    }
    return route.fulfill({ json: { items: [], total: 0, limit: 200, offset: 0 } });
  });
  return handle;
}

test('badge con el conteo de no leídas y panel con eventos', async ({ page }) => {
  await seedAuth(page);
  await mockApi(page);
  await page.goto('/dashboard/alerts');

  await expect(page.getByTestId('bell-badge')).toHaveText('2');
  await page.getByTestId('bell-button').click();
  await expect(page.getByTestId('bell-panel')).toBeVisible();
  await expect(page.getByTestId('bell-item')).toHaveCount(3);
  await expect(page.getByTestId('unread-dot')).toHaveCount(2); // ev3 ya leída
  await expect(
    page.getByText('NVDA: Retroceso del ciclo 17.8% superó tu umbral de 15%'),
  ).toBeVisible();
  await expect(page.getByText('AAPL · 20/07/2026')).toBeVisible();
});

test('marcar todas como leídas emite el POST y apaga el badge', async ({ page }) => {
  await seedAuth(page);
  const handle = await mockApi(page);
  await page.goto('/dashboard/alerts');

  await page.getByTestId('bell-button').click();
  await page.getByTestId('bell-mark-all').click();
  await expect.poll(() => handle.markCalls.length).toBe(1);
  expect(handle.markCalls[0]).toEqual({ all: true });
  await expect(page.getByTestId('bell-badge')).toHaveCount(0);
  await expect(page.getByTestId('unread-dot')).toHaveCount(0);
});

test('click en un evento abre la ficha del símbolo y lo marca leído', async ({ page }) => {
  await seedAuth(page);
  const handle = await mockApi(page);
  await page.goto('/dashboard/alerts');

  await page.getByTestId('bell-button').click();
  await page.getByTestId('bell-item').first().click();

  await expect.poll(() => handle.markCalls.length).toBe(1);
  expect(handle.markCalls[0]).toEqual({ event_ids: ['ev1'] });
  // la ficha del símbolo (SymbolModal) se abre con el ticker del evento
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('NVDA');
});

test('"Ver todas" navega al historial de la página de alertas', async ({ page }) => {
  await seedAuth(page);
  await mockApi(page);
  await page.goto('/dashboard/alerts');

  await page.getByTestId('bell-button').click();
  await page.getByTestId('bell-see-all').click();
  await expect(page).toHaveURL(/\/dashboard\/alerts\?tab=historial/);
  await expect(page.getByTestId('bell-panel')).toHaveCount(0);
});

test('sin notificaciones: sin badge y estado vacío', async ({ page }) => {
  await seedAuth(page);
  await mockApi(page, { count: 0, events: [] });
  await page.goto('/dashboard/alerts');

  await expect(page.getByTestId('bell-badge')).toHaveCount(0);
  await page.getByTestId('bell-button').click();
  await expect(page.getByTestId('bell-empty')).toHaveText('Sin notificaciones');
});
