import { test, expect, type Page } from '@playwright/test';

/**
 * E2E issue #337 — el asistente ya no deja elegir modelo: el compositor es
 * sólo el campo de texto y el request no lleva `model` (lo decide el
 * servidor). API mockeada con `page.route`.
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

const SESSION_ID = '33333333-3333-3333-3333-333333333333';

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

function sse(events: [string, Record<string, unknown>][]): string {
  return events
    .map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
    .join('');
}

const STREAM = sse([
  ['session', { session_id: SESSION_ID, title: 'Nueva conversación' }],
  ['token', { text: 'Listo.' }],
  ['done', {
    session_id: SESSION_ID, message_id: 'm1', content: 'Listo.',
    model: 'claude-sonnet-5-5', title: 'AAPL', files: [], charts: [],
  }],
]);

/** Mockea el chat y devuelve los cuerpos enviados a /chat/messages/stream. */
async function mockApi(page: Page): Promise<Record<string, unknown>[]> {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/chat/**', async (route) => {
    const req = route.request();
    if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') {
      return route.fallback();
    }
    const path = new URL(req.url()).pathname;
    if (path.endsWith('/chat/messages/stream')) {
      bodies.push(req.postDataJSON() as Record<string, unknown>);
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: STREAM,
      });
    }
    if (path.endsWith('/chat/sessions')) {
      return route.fulfill({ json: { items: [], total: 0 } });
    }
    return route.fulfill({ json: {} });
  });
  await page.route('**/portfolios**', (route) => {
    const req = route.request();
    if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') {
      return route.fallback();
    }
    return route.fulfill({ json: { items: [], total: 0 } });
  });
  return bodies;
}

test('el compositor no ofrece elegir modelo', async ({ page }) => {
  await seedAuth(page);
  await mockApi(page);
  await page.goto('/dashboard/assistant');

  await expect(page.getByPlaceholder(/Pregunta por una acción/)).toBeVisible();
  await expect(page.getByLabel('Modelo de IA')).toHaveCount(0);
  await expect(page.locator('.composer select')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible();
});

test('la pregunta del compositor se envía sin el campo model', async ({ page }) => {
  await seedAuth(page);
  const bodies = await mockApi(page);
  await page.goto('/dashboard/assistant');

  const input = page.getByPlaceholder(/Pregunta por una acción/);
  await input.fill('analiza AAPL');
  await input.press('Enter');
  await expect(page.locator('.msg-md')).toContainText('Listo.');

  expect(bodies).toHaveLength(1);
  expect(bodies[0].message).toBe('analiza AAPL');
  expect(bodies[0]).not.toHaveProperty('model');
});

test('una sugerencia del estado vacío también se envía sin model', async ({ page }) => {
  await seedAuth(page);
  const bodies = await mockApi(page);
  await page.goto('/dashboard/assistant');

  await page.locator('.chat-scroll button').first().click();
  await expect(page.locator('.msg-md')).toContainText('Listo.');

  expect(bodies).toHaveLength(1);
  expect(typeof bodies[0].message).toBe('string');
  expect(bodies[0]).not.toHaveProperty('model');
});

test('el segundo turno conserva la sesión y sigue sin model', async ({ page }) => {
  await seedAuth(page);
  const bodies = await mockApi(page);
  await page.goto('/dashboard/assistant');

  const input = page.getByPlaceholder(/Pregunta por una acción/);
  await input.fill('analiza AAPL');
  await input.press('Enter');
  await expect(page.locator('.msg-md')).toHaveCount(1);
  await input.fill('y MSFT');
  await input.press('Enter');
  await expect(page.locator('.msg-md')).toHaveCount(2);

  expect(bodies).toHaveLength(2);
  expect(bodies[1].session_id).toBe(SESSION_ID);
  expect(bodies[1]).not.toHaveProperty('model');
});
