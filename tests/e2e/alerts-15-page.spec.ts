import { test, expect, type Page } from '@playwright/test';

/**
 * E2E issue #15 — página "Mis alertas": lista, estados, filtros, acciones e
 * historial. API mockeada por interceptación (contrato backend #89/#92/#102).
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
    description: 'Retroceso desde el extremo del ciclo actual.',
  },
  {
    key: 'close',
    label: 'Precio de cierre',
    category: 'precio',
    dtype: 'decimal',
    unit: 'usd',
    operators: ['gte', 'lte'],
    enabled: true,
    description: 'Cierre diario.',
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
];

function alertBase(over: Record<string, unknown>) {
  return {
    user_id: USER.user_id,
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
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

const NOW = new Date();
const TWO_DAYS_AGO = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();

const ALERTS = [
  alertBase({ alert_id: 'a1', symbol_id: 's1', ticker: 'ALFA' }), // Armada
  alertBase({
    alert_id: 'a2', symbol_id: 's2', ticker: 'BETA',
    last_triggered_at: NOW.toISOString(), armed: false,
  }), // Disparó hoy
  alertBase({
    alert_id: 'a3', symbol_id: 's3', ticker: 'GAMA',
    cooldown_days: 5, last_triggered_at: TWO_DAYS_AGO,
  }), // En cooldown
  alertBase({
    alert_id: 'a4', symbol_id: 's4', ticker: 'DELT',
    is_active: false, field: 'close', operator: 'lte', threshold: '120',
    message: 'soporte clave',
  }), // Pausada
];

const EVENTS = [
  {
    event_id: 'e1', alert_id: 'a2', symbol_id: 's2', ticker: 'BETA',
    data_date: '2026-07-20', field: 'retracement', operator: 'gt',
    threshold: '0.15', observed_value: '0.20',
    title: 'BETA: Retroceso del ciclo 20% superó tu umbral de 15%',
    read_at: null, created_at: '2026-07-21T06:00:00Z',
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

interface Captured {
  patches: { id: string; body: Record<string, unknown> }[];
  deletes: string[];
}

async function mockAlertsApi(
  page: Page,
  data: { alerts: typeof ALERTS; events: typeof EVENTS },
): Promise<Captured> {
  const captured: Captured = { patches: [], deletes: [] };
  await page.route('**/alerts**', async (route) => {
    const req = route.request();
    // la URL de la app (/dashboard/alerts) también matchea el glob: dejar
    // pasar la navegación y assets, interceptar solo el API (xhr/fetch)
    if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') {
      return route.fallback();
    }
    const path = new URL(req.url()).pathname;
    const method = req.method();
    if (path.endsWith('/alerts/fields')) {
      return route.fulfill({ json: FIELDS });
    }
    if (path.endsWith('/alerts/events')) {
      return route.fulfill({
        json: { items: data.events, total: data.events.length, limit: 50, offset: 0 },
      });
    }
    const id = path.split('/').pop() ?? '';
    if (method === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      captured.patches.push({ id, body });
      const alert = data.alerts.find((a) => a.alert_id === id);
      return route.fulfill({ json: { ...alert, ...body, current_value: null } });
    }
    if (method === 'DELETE') {
      captured.deletes.push(id);
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({
      json: { items: data.alerts, total: data.alerts.length, limit: 200, offset: 0 },
    });
  });
  return captured;
}

test('lista con los 4 estados, frase de la regla y límite de activas', async ({ page }) => {
  await seedAuth(page);
  await mockAlertsApi(page, { alerts: ALERTS, events: EVENTS });
  await page.goto('/dashboard/alerts');

  await expect(page.getByTestId('alert-row')).toHaveCount(4);
  const statuses = page.getByTestId('alert-status');
  await expect(statuses.filter({ hasText: 'Armada' })).toHaveCount(1);
  await expect(statuses.filter({ hasText: 'Disparó hoy' })).toHaveCount(1);
  await expect(statuses.filter({ hasText: 'En cooldown' })).toHaveCount(1);
  await expect(statuses.filter({ hasText: 'Pausada' })).toHaveCount(1);

  // frase natural desde el catálogo (fraction → %)
  await expect(page.getByText('Retroceso del ciclo mayor que 15%').first()).toBeVisible();
  await expect(page.getByText('Precio de cierre menor o igual que $120.00')).toBeVisible();
  await expect(page.getByText('· soporte clave')).toBeVisible();

  await expect(page.getByTestId('active-count')).toHaveText('3/200 activas');
  await expect(page.getByTestId('new-alert')).toBeVisible();
});

test('filtros por símbolo y estado', async ({ page }) => {
  await seedAuth(page);
  await mockAlertsApi(page, { alerts: ALERTS, events: EVENTS });
  await page.goto('/dashboard/alerts');
  await expect(page.getByTestId('alert-row')).toHaveCount(4);

  await page.getByTestId('ticker-filter').fill('ALFA');
  await expect(page.getByTestId('alert-row')).toHaveCount(1);
  await expect(page.getByText('ALFA')).toBeVisible();

  await page.getByTestId('ticker-filter').fill('');
  await page.getByTestId('status-filter').selectOption('pausada');
  await expect(page.getByTestId('alert-row')).toHaveCount(1);
  await expect(page.getByText('DELT')).toBeVisible();
});

test('pausar emite el PATCH esperado', async ({ page }) => {
  await seedAuth(page);
  const captured = await mockAlertsApi(page, { alerts: ALERTS, events: EVENTS });
  await page.goto('/dashboard/alerts');
  await expect(page.getByTestId('alert-row')).toHaveCount(4);

  await page.getByTestId('alert-toggle').first().click();
  await expect
    .poll(() => captured.patches.length, { timeout: 5000 })
    .toBeGreaterThan(0);
  expect(captured.patches[0]).toEqual({ id: 'a1', body: { is_active: false } });
  await expect(
    page.getByTestId('alert-status').filter({ hasText: 'Pausada' }),
  ).toHaveCount(2);
});

test('eliminar pide confirmación y emite el DELETE', async ({ page }) => {
  await seedAuth(page);
  const captured = await mockAlertsApi(page, { alerts: ALERTS, events: EVENTS });
  await page.goto('/dashboard/alerts');
  await expect(page.getByTestId('alert-row')).toHaveCount(4);

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('Eliminar');
    void dialog.accept();
  });
  await page.getByTestId('alert-delete').first().click();
  await expect(page.getByTestId('alert-row')).toHaveCount(3);
  expect(captured.deletes).toEqual(['a1']);
});

test('pestaña Historial lista los disparos', async ({ page }) => {
  await seedAuth(page);
  await mockAlertsApi(page, { alerts: ALERTS, events: EVENTS });
  await page.goto('/dashboard/alerts');
  await page.getByTestId('tab-historial').click();

  await expect(page.getByTestId('event-row')).toHaveCount(1);
  await expect(
    page.getByText('BETA: Retroceso del ciclo 20% superó tu umbral de 15%'),
  ).toBeVisible();
});

test('estado vacío con CTA', async ({ page }) => {
  await seedAuth(page);
  await mockAlertsApi(page, { alerts: [], events: [] });
  await page.goto('/dashboard/alerts');

  await expect(page.getByTestId('empty-state')).toBeVisible();
  await expect(page.getByText('Crear mi primera alerta')).toBeVisible();
});
