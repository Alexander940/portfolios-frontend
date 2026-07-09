import { test, expect, type Page } from '@playwright/test';

/**
 * E2E for issue #11 — event journal: server-side filters, pagination,
 * expandable payload detail (defensive against missing fields).
 */

const STRATEGY_ID = '33333333-3333-3333-3333-333333333333';
const PORTFOLIO_ID = '66666666-6666-6666-6666-666666666666';

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

const TRACKER = {
  tracker_id: '44444444-4444-4444-4444-444444444444',
  strategy_id: STRATEGY_ID,
  strategy_version_id: '55555555-5555-5555-5555-555555555555',
  portfolio_id: PORTFOLIO_ID,
  status: 'active',
  initial_cash: '100000.00',
  started_at: '2026-01-02',
  last_rebalance_date: '2026-07-01',
  next_rebalance_date: '2026-07-15',
  last_evaluated_date: '2026-07-08',
  force_rebalance: false,
  notifications_enabled: true,
  last_error: null,
  created_at: '2026-01-02T00:00:00Z',
};

function ev(
  id: string,
  type: string,
  ticker: string | null,
  payload: Record<string, unknown>,
  date = '2026-07-01',
) {
  return {
    event_id: id,
    event_date: date,
    event_type: type,
    symbol_id: ticker ? `sym-${ticker}` : null,
    ticker,
    symbol_name: ticker ? `${ticker} Corp.` : null,
    payload,
    created_at: `${date}T14:30:00Z`,
  };
}

const ALL_EVENTS = [
  ev('ev-r1', 'rebalance', null, {
    reason: 'cadence',
    turnover_pct: '12.5',
    total_value: '101234.56',
    entered: ['NVDA', 'AMD'],
    exited: ['INTC'],
    coverage_pct: '0.93',
    eligible_count: 48,
    data_as_of: '2026-07-01',
    warnings: [],
  }),
  // enter defensivo: sin rank/score/sort_by (pre backend#52)
  ev('ev-e1', 'enter', 'NVDA', { shares: 12, price: '175.50', weight_pct: '5.0' }),
  // enter enriquecido (backend#52)
  ev('ev-e2', 'enter', 'AMD', {
    shares: '8',
    price: '210.00',
    weight_pct: '3.2',
    rank: 3,
    score: '1.85',
    sort_by: 'rating',
  }),
  ev('ev-x1', 'exit', 'INTC', {
    shares_sold: '120',
    price: '21.10',
    reason: 'Dejó de pasar los filtros',
    realized_pnl_pct: '-4.20',
  }),
  ev('ev-s1', 'skip', null, { reason: 'empty_universe', coverage_pct: '0.10' }),
  ev('ev-er1', 'error', null, { error: 'FMP timeout al pedir precios' }),
  ev('ev-r2', 'rebalance', null, { reason: 'version_rebase', entered: [], exited: [] }, '2026-06-15'),
  ev('ev-r3', 'rebalance', null, { reason: 'initial_materialization' }, '2026-06-01'),
  ev('ev-e3', 'enter', 'MSFT', { shares: 70, price: '480.00', weight_pct: '35.0' }, '2026-06-01'),
  ev('ev-e4', 'enter', 'AAPL', { shares: 200, price: '180.00', weight_pct: '40.0' }, '2026-06-01'),
  ev('ev-x2', 'exit', 'F', { shares_sold: '300', price: '11.20' }, '2026-06-15'),
  ev('ev-s2', 'skip', null, { reason: 'low_coverage', coverage_pct: '0.55' }, '2026-06-20'),
];

interface EventsCall {
  type: string | null;
  limit: number;
  offset: number;
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
  events: ReturnType<typeof ev>[] = ALL_EVENTS,
): Promise<EventsCall[]> {
  const calls: EventsCall[] = [];

  await page.route('**/portfolios/*/positions*', (route) =>
    route.fulfill({ json: { items: [], total: 0, limit: 200, offset: 0 } }),
  );
  await page.route('**/portfolios/*/performance/curve*', (route) =>
    route.fulfill({
      json: {
        portfolio_id: PORTFOLIO_ID,
        benchmark: 'SPY',
        return_basis: 'total_return',
        base_mode: 'index_100',
        base: 100,
        benchmark_available: false,
        start_date: null,
        end_date: null,
        points: [],
      },
    }),
  );
  await page.route('**/strategies/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/tracker/events')) {
      const type = url.searchParams.get('type');
      const limit = Number(url.searchParams.get('limit') ?? 10);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      calls.push({ type, limit, offset });
      const filtered = type ? events.filter((e) => e.event_type === type) : events;
      await route.fulfill({
        json: {
          events: filtered.slice(offset, offset + limit),
          total: filtered.length,
          limit,
          offset,
        },
      });
      return;
    }
    if (url.pathname.endsWith('/tracker') && route.request().method() === 'GET') {
      await route.fulfill({ json: TRACKER });
      return;
    }
    if (url.pathname.endsWith('/tracker/drift')) {
      await route.fulfill({
        json: { entries: [], exits: [], weight_drift: [], warnings: [] },
      });
      return;
    }
    if (url.pathname.endsWith('/holdings')) {
      await route.fulfill({
        json: { data_as_of: '2026-07-08', warnings: [], holdings: [] },
      });
      return;
    }
    await route.fulfill({ status: 404, json: { detail: 'Not mocked' } });
  });

  return calls;
}

const DETAIL_URL = `/dashboard/strategy/${STRATEGY_ID}`;

test.describe('Journal de eventos (#11)', () => {
  test('lista con subtítulos por tipo y filtro server-side que resetea offset', async ({
    page,
  }) => {
    await seedAuth(page);
    const calls = await mockApi(page);
    await page.goto(DETAIL_URL);

    const journal = page.getByTestId('events-journal');
    await expect(journal).toBeVisible();
    await expect(journal.getByTestId('events-pager')).toContainText('1–10 de 12');

    // Subtítulo compuesto del rebalanceo
    const reb = journal.getByTestId('event-ev-r1');
    await expect(reb).toContainText('Rebalanceo');
    await expect(reb).toContainText('turnover 12.5%');
    await expect(reb).toContainText('$101,234.56');
    await expect(reb).toContainText('2 entradas / 1 salidas');
    await expect(reb).toContainText('Jul 1, 2026');

    // Copy legible del skip
    await expect(journal.getByTestId('event-ev-s1')).toContainText(
      'El universo resolvió vacío',
    );

    // Ir a la página 2 y luego filtrar: el filtro debe resetear el offset
    await journal.getByRole('button', { name: 'Siguiente' }).click();
    await expect(journal.getByTestId('events-pager')).toContainText('11–12 de 12');

    await journal.getByRole('button', { name: 'Entradas' }).click();
    await expect(journal.getByTestId('events-pager')).toContainText('1–4 de 4');
    await expect(journal.getByTestId('event-ev-e1')).toBeVisible();

    const filtered = calls.find((c) => c.type === 'enter');
    expect(filtered?.offset).toBe(0);
  });

  test('paginación server-side estable con limit/offset', async ({ page }) => {
    await seedAuth(page);
    const calls = await mockApi(page);
    await page.goto(DETAIL_URL);

    const journal = page.getByTestId('events-journal');
    await expect(journal.getByTestId('events-pager')).toContainText('1–10 de 12');
    await expect(journal.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    await journal.getByRole('button', { name: 'Siguiente' }).click();
    await expect(journal.getByTestId('events-pager')).toContainText('11–12 de 12');
    await expect(journal.getByTestId('event-ev-x2')).toBeVisible();
    await expect(journal.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(calls.some((c) => c.offset === 10 && c.type === null)).toBe(true);

    await journal.getByRole('button', { name: 'Anterior' }).click();
    await expect(journal.getByTestId('events-pager')).toContainText('1–10 de 12');
  });

  test('detalle expandible por tipo, defensivo ante campos ausentes', async ({ page }) => {
    await seedAuth(page);
    await mockApi(page);
    await page.goto(DETAIL_URL);

    const journal = page.getByTestId('events-journal');
    await expect(journal).toBeVisible();

    // Rebalanceo: chips de tickers + motivo + cobertura (fracción → %)
    await journal.getByTestId('event-ev-r1').getByRole('button').click();
    const rebDetail = page.getByTestId('event-detail-ev-r1');
    await expect(rebDetail).toBeVisible();
    await expect(rebDetail).toContainText('NVDA');
    await expect(rebDetail).toContainText('AMD');
    await expect(rebDetail).toContainText('INTC');
    await expect(rebDetail).toContainText('por calendario');
    await expect(rebDetail).toContainText('93.0%');

    // Enter enriquecido (backend#52): rank + score con nombre del campo
    await journal.getByTestId('event-ev-e2').getByRole('button').click();
    const e2Detail = page.getByTestId('event-detail-ev-e2');
    await expect(e2Detail).toContainText('#3');
    await expect(e2Detail).toContainText('rating');
    await expect(e2Detail).toContainText('1.85');

    // Enter sin campos de backend#52: no crashea, detalle mínimo
    await journal.getByTestId('event-ev-e1').getByRole('button').click();
    await expect(page.getByTestId('event-detail-ev-e1')).toContainText(
      'Sin detalle adicional',
    );

    // Exit: P&L realizado con signo
    await journal.getByTestId('event-ev-x1').getByRole('button').click();
    await expect(page.getByTestId('event-detail-ev-x1')).toContainText('-4.20%');
  });

  test('empty state por filtro sin resultados', async ({ page }) => {
    await seedAuth(page);
    await mockApi(
      page,
      ALL_EVENTS.filter((e) => e.event_type !== 'error'),
    );
    await page.goto(DETAIL_URL);

    const journal = page.getByTestId('events-journal');
    await expect(journal).toBeVisible();

    await journal.getByRole('button', { name: 'Errores' }).click();
    await expect(journal.getByTestId('events-empty')).toBeVisible();
    await expect(journal.getByTestId('events-empty')).toContainText(
      'Sin eventos para este filtro',
    );
  });
});
