import { test, expect, type Page } from '@playwright/test';

/**
 * E2E issue #16 — constructor de reglas dinámico desde el catálogo.
 * API mockeada (contrato backend #88/#89). Nada hardcodeado: el formulario
 * se pinta desde el mock de /alerts/fields.
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

const FIELDS = [
  {
    key: 'retracement',
    label: 'Retroceso del ciclo',
    category: 'rating_tendencia',
    dtype: 'decimal',
    unit: 'fraction',
    operators: ['gt', 'gte', 'lt', 'lte'],
    enabled: true,
    description: 'Retroceso desde el extremo del ciclo actual. 0.15 = 15%.',
  },
  {
    key: 'sell_signal_fired',
    label: 'Señal de venta ADE',
    category: 'rating_tendencia',
    dtype: 'boolean',
    unit: 'none',
    operators: ['becomes_true'],
    enabled: true,
    description: 'La máquina ADE disparó venta.',
  },
  {
    key: 'close',
    label: 'Precio de cierre',
    category: 'precio',
    dtype: 'decimal',
    unit: 'usd',
    operators: ['gte', 'lte'],
    enabled: true,
    description: 'Cierre diario en USD.',
  },
  {
    key: 'eps_surprise_pct',
    label: 'Sorpresa de EPS',
    category: 'eventos_fundamentales',
    dtype: 'decimal',
    unit: 'percent',
    operators: ['gte', 'lte'],
    enabled: false,
    description: 'Al publicar resultados.',
  },
];

const SYMBOLS = [
  { symbol_id: 's1', ticker: 'ALFA', name: 'Alfa Corp', exchange: 'NASDAQ', sector: 'Tech' },
  { symbol_id: 's2', ticker: 'ALFB', name: 'Alfa Beta Inc', exchange: 'NYSE', sector: 'Tech' },
];

function savedAlert(over: Record<string, unknown>) {
  return {
    alert_id: 'new-1',
    user_id: USER.user_id,
    symbol_id: 's1',
    ticker: 'ALFA',
    field: 'retracement',
    operator: 'gt',
    threshold: '0.15',
    trigger_mode: 'recurrente',
    cooldown_days: 0,
    channels: ['email', 'in_app'],
    armed: true,
    is_active: true,
    last_triggered_at: null,
    message: null,
    created_at: '2026-07-21T00:00:00Z',
    updated_at: '2026-07-21T00:00:00Z',
    current_value: null,
    ...over,
  };
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

interface Captured {
  posts: Record<string, unknown>[];
  patches: { id: string; body: Record<string, unknown> }[];
}

async function mockApi(
  page: Page,
  opts: {
    alerts?: Record<string, unknown>[];
    postResponse?: Record<string, unknown>;
    postStatus?: number;
    patchResponse?: Record<string, unknown>;
  } = {},
): Promise<Captured> {
  const captured: Captured = { posts: [], patches: [] };
  await page.route('**/symbols/search**', (route) =>
    route.fulfill({ json: SYMBOLS }),
  );
  await page.route('**/alerts**', async (route) => {
    const req = route.request();
    if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') {
      return route.fallback();
    }
    const path = new URL(req.url()).pathname;
    const method = req.method();
    if (path.endsWith('/alerts/fields')) return route.fulfill({ json: FIELDS });
    if (path.endsWith('/alerts/events')) {
      return route.fulfill({ json: { items: [], total: 0, limit: 50, offset: 0 } });
    }
    if (method === 'POST') {
      captured.posts.push(req.postDataJSON() as Record<string, unknown>);
      if (opts.postStatus && opts.postStatus >= 400) {
        return route.fulfill({
          status: opts.postStatus,
          json: { detail: 'el operador gt requiere threshold' },
        });
      }
      return route.fulfill({ status: 201, json: opts.postResponse ?? savedAlert({}) });
    }
    if (method === 'PATCH') {
      const id = path.split('/').pop() ?? '';
      const body = req.postDataJSON() as Record<string, unknown>;
      captured.patches.push({ id, body });
      return route.fulfill({
        json: opts.patchResponse ?? savedAlert({ alert_id: id, ...body }),
      });
    }
    const alerts = opts.alerts ?? [];
    return route.fulfill({
      json: { items: alerts, total: alerts.length, limit: 200, offset: 0 },
    });
  });
  return captured;
}

test('flujo completo: catálogo dinámico, conversión %→fracción y POST correcto', async ({
  page,
}) => {
  await seedAuth(page);
  const captured = await mockApi(page);
  await page.goto('/dashboard/alerts');

  await page.getByTestId('new-alert').click();
  await page.getByTestId('symbol-search').fill('ALF');
  await page.getByTestId('symbol-option').first().click();
  await expect(page.getByTestId('picked-symbol')).toHaveText('ALFA');

  // catálogo dinámico: campos de la categoría + disabled visible en eventos
  await page.getByTestId('field-select').selectOption('retracement');
  await expect(page.getByTestId('operator-select')).toHaveValue('gt');
  await page.getByTestId('threshold-input').fill('15');
  await expect(page.getByTestId('unit-suffix')).toHaveText('%');

  await expect(page.getByTestId('preview')).toHaveText(
    'Avisarme cuando ALFA: Retroceso del ciclo mayor que 15%',
  );

  // canales por defecto: email ✓, campana ✓, sms deshabilitado
  await expect(page.getByTestId('channel-email')).toBeChecked();
  await expect(page.getByTestId('channel-in_app')).toBeChecked();
  await expect(page.getByTestId('channel-sms')).toBeDisabled();

  await page.getByTestId('builder-save').click();
  await expect.poll(() => captured.posts.length).toBe(1);
  expect(captured.posts[0]).toEqual({
    symbol_id: 's1',
    field: 'retracement',
    operator: 'gt',
    threshold: '0.15', // el usuario escribió 15 (%) → la API recibe fracción
    trigger_mode: 'recurrente',
    cooldown_days: 0,
    channels: ['email', 'in_app'],
    message: null,
  });
  await expect(page.getByTestId('alert-row')).toHaveCount(1);
});

test('campo deshabilitado del catálogo se ve pero no se puede elegir', async ({ page }) => {
  await seedAuth(page);
  await mockApi(page);
  await page.goto('/dashboard/alerts');
  await page.getByTestId('new-alert').click();
  await page.getByTestId('category-select').selectOption('eventos_fundamentales');
  const option = page.getByTestId('field-select').locator('option[value="eps_surprise_pct"]');
  await expect(option).toBeDisabled();
  await expect(option).toHaveText('Sorpresa de EPS (Próximamente)');
});

test('campo booleano oculta el umbral y postea threshold null', async ({ page }) => {
  await seedAuth(page);
  const captured = await mockApi(page, {
    postResponse: savedAlert({
      field: 'sell_signal_fired',
      operator: 'becomes_true',
      threshold: null,
    }),
  });
  await page.goto('/dashboard/alerts');
  await page.getByTestId('new-alert').click();
  await page.getByTestId('symbol-search').fill('ALF');
  await page.getByTestId('symbol-option').first().click();
  await page.getByTestId('field-select').selectOption('sell_signal_fired');

  await expect(page.getByTestId('threshold-input')).toHaveCount(0);
  await expect(page.getByTestId('preview')).toHaveText(
    'Avisarme cuando ALFA: Señal de venta ADE se activa',
  );
  await page.getByTestId('builder-save').click();
  await expect.poll(() => captured.posts.length).toBe(1);
  expect(captured.posts[0].threshold).toBeNull();
});

test('condición ya cumplida muestra el aviso', async ({ page }) => {
  await seedAuth(page);
  await mockApi(page, {
    postResponse: savedAlert({ armed: false, current_value: '0.2' }),
  });
  await page.goto('/dashboard/alerts');
  await page.getByTestId('new-alert').click();
  await page.getByTestId('symbol-search').fill('ALF');
  await page.getByTestId('symbol-option').first().click();
  await page.getByTestId('field-select').selectOption('retracement');
  await page.getByTestId('threshold-input').fill('15');
  await page.getByTestId('builder-save').click();

  await expect(page.getByTestId('already-met')).toBeVisible();
  await expect(page.getByTestId('already-met')).toContainText('ya se cumple');
  await expect(page.getByTestId('already-met')).toContainText('20%');
});

test('422 del backend se muestra como error del formulario', async ({ page }) => {
  await seedAuth(page);
  await mockApi(page, { postStatus: 422 });
  await page.goto('/dashboard/alerts');
  await page.getByTestId('new-alert').click();
  await page.getByTestId('symbol-search').fill('ALF');
  await page.getByTestId('symbol-option').first().click();
  await page.getByTestId('field-select').selectOption('retracement');
  await page.getByTestId('threshold-input').fill('15');
  await page.getByTestId('builder-save').click();

  await expect(page.getByTestId('builder-error')).toBeVisible();
  await expect(page.getByTestId('builder-error')).toContainText('threshold');
});

test('editar: prefill, símbolo/campo bloqueados y PATCH con la fracción nueva', async ({
  page,
}) => {
  await seedAuth(page);
  const existing = savedAlert({ alert_id: 'a9' });
  const captured = await mockApi(page, {
    alerts: [existing],
    patchResponse: savedAlert({ alert_id: 'a9', threshold: '0.3', current_value: '0.1' }),
  });
  await page.goto('/dashboard/alerts');
  await page.getByTestId('alert-edit').click();

  await expect(page.getByTestId('picked-symbol')).toHaveText('ALFA');
  await expect(page.getByTestId('category-select')).toBeDisabled();
  await expect(page.getByTestId('field-select')).toBeDisabled();
  await expect(page.getByTestId('threshold-input')).toHaveValue('15');

  await page.getByTestId('threshold-input').fill('30');
  await page.getByTestId('builder-save').click();
  await expect.poll(() => captured.patches.length).toBe(1);
  expect(captured.patches[0].id).toBe('a9');
  expect(captured.patches[0].body.threshold).toBe('0.3');
});
