import { test, expect, type Page } from '@playwright/test';

/**
 * E2E issue #243 — notas de progreso entre herramientas en el chat de IA.
 * API mockeada: el endpoint SSE se intercepta con `page.route` y la sesion
 * persistida se sirve por GET /chat/sessions/{id}.
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
const NOTE = 'Busco los fundamentals…';

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

interface Opts {
  stream?: string;
  sessions?: Record<string, unknown>[];
  detail?: Record<string, unknown>;
}

/** Mockea sesiones, portafolios y el stream; el resto de XHR responde vacio. */
async function mockApi(page: Page, opts: Opts = {}): Promise<void> {
  await page.route('**/chat/**', async (route) => {
    const req = route.request();
    if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') {
      return route.fallback();
    }
    const path = new URL(req.url()).pathname;
    if (path.endsWith('/chat/messages/stream')) {
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: opts.stream ?? '',
      });
    }
    if (path.endsWith(`/chat/sessions/${SESSION_ID}`)) {
      return route.fulfill({ json: opts.detail ?? {} });
    }
    if (path.endsWith('/chat/sessions')) {
      return route.fulfill({
        json: { items: opts.sessions ?? [], total: (opts.sessions ?? []).length },
      });
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
}

async function ask(page: Page, text: string): Promise<void> {
  await page.goto('/dashboard/assistant');
  const input = page.getByPlaceholder(/Pregunta por una acción/);
  await input.fill(text);
  await input.press('Enter');
}

test('la nota se ve arriba de la tarjeta de la herramienta y no en la respuesta', async ({
  page,
}) => {
  await seedAuth(page);
  await mockApi(page, {
    stream: sse([
      ['session', { session_id: SESSION_ID, title: 'Nueva conversación' }],
      ['thinking', { status: 'start' }],
      ['progress', { text: NOTE }],
      ['tool', { name: 'get_fundamentals', status: 'running' }],
      ['tool', { name: 'get_fundamentals', status: 'done', row_count: 1 }],
      ['token', { text: 'AAPL cotiza ' }],
      ['token', { text: 'barato.' }],
      ['done', {
        session_id: SESSION_ID, message_id: 'm1', content: 'AAPL cotiza barato.',
        model: 'claude-opus-5-5', title: 'AAPL', files: [], charts: [],
      }],
    ]),
  });
  await ask(page, 'analiza AAPL');

  const note = page.getByTestId('tool-progress');
  await expect(note).toHaveText(NOTE);
  await expect(page.locator('.msg-md')).toContainText('AAPL cotiza barato.');
  // Fuera del texto de la respuesta.
  await expect(page.locator('.msg-md')).not.toContainText(NOTE);

  // Arriba de la tarjeta de la herramienta.
  const chip = page.locator('.tool-chip').first();
  await expect(chip).toBeVisible();
  const noteBox = await note.boundingBox();
  const chipBox = await chip.boundingBox();
  expect(noteBox && chipBox && noteBox.y + noteBox.height <= chipBox.y + 1).toBe(true);
});

test('al recargar la sesion se rehidrata tool_calls[].progress', async ({ page }) => {
  await seedAuth(page);
  const summary = {
    session_id: SESSION_ID, title: 'Sesión con notas',
    created_at: '2026-09-29T10:00:00Z', updated_at: '2026-09-29T10:01:00Z',
  };
  await mockApi(page, {
    sessions: [summary],
    detail: {
      ...summary,
      messages: [
        {
          message_id: 'u1', role: 'user', content: 'analiza AAPL',
          tool_calls: null, created_at: '2026-09-29T10:00:00Z',
        },
        {
          message_id: 'a1', role: 'assistant', content: 'AAPL cotiza barato.',
          tool_calls: [
            { name: 'get_fundamentals', row_count: 1, progress: NOTE },
            { name: 'get_performance', row_count: 1 },
          ],
          created_at: '2026-09-29T10:01:00Z',
        },
      ],
    },
  });
  await page.goto('/dashboard/assistant');
  await page.getByRole('button', { name: /Sesión con notas/ }).click();

  await expect(page.locator('.msg-md')).toContainText('AAPL cotiza barato.');
  await expect(page.getByTestId('tool-progress')).toHaveCount(1);
  await expect(page.getByTestId('tool-progress')).toHaveText(NOTE);
  await expect(page.locator('.msg-md')).not.toContainText(NOTE);
});

test('rechazo: done.content vacio es autoritativo y el error se ve', async ({
  page,
}) => {
  await seedAuth(page);
  await mockApi(page, {
    stream: sse([
      ['session', { session_id: SESSION_ID, title: 'Nueva conversación' }],
      ['token', { text: 'parcial' }],
      ['error', { detail: 'El modelo declinó responder esta consulta.' }],
      ['done', {
        session_id: SESSION_ID, message_id: 'm1', content: '',
        model: 'claude-fable-5-1', title: 'x', files: [], charts: [],
      }],
    ]),
  });
  await ask(page, 'algo sensible');

  await expect(page.getByText('El modelo declinó responder esta consulta.')).toBeVisible();
  await expect(page.getByText('parcial')).toHaveCount(0);
});
