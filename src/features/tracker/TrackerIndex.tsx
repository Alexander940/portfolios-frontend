import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Loader2, Target } from 'lucide-react';
import { Button } from '@/components/ui';
import { getErrorMessage } from '@/lib/apiErrors';
import { fmtDate, fmtMoney, fmtPct } from '@/lib/format';
import { getTrackers } from './service';
import type { ApiNumber, TrackerListItem, TrackersListResponse } from './types';
import { TrackerStatusBadge } from './components/TrackerStatusBadge';
import './tracker.css';

function pnlClass(n: ApiNumber | undefined): string {
  const num = Number(n);
  if (!Number.isFinite(num) || num === 0) return '';
  return num > 0 ? 'pos' : 'neg';
}

/** Sparkline SVG minimal; color por signo primera→última. */
function Sparkline({ points }: { points: ApiNumber[] | undefined }) {
  const nums = (points ?? []).map(Number).filter(Number.isFinite);
  if (nums.length < 2) {
    return <span className="dim" style={{ fontSize: 11 }}>—</span>;
  }
  const w = 96;
  const h = 28;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const step = w / (nums.length - 1);
  const path = nums
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`)
    .join(' ');
  const up = nums[nums.length - 1] >= nums[0];
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      data-testid="tracker-sparkline"
      role="img"
      aria-label="sparkline"
    >
      <path
        d={path}
        fill="none"
        stroke={up ? 'var(--c-pos)' : 'var(--c-neg)'}
        strokeWidth={1.5}
      />
    </svg>
  );
}

function isTracked(item: TrackerListItem): boolean {
  return item.tracked !== false && Boolean(item.tracker_id);
}

/** Suma de un campo numérico sobre los trackers; null si ninguno lo trae. */
function sumField(
  items: TrackerListItem[],
  field: keyof TrackerListItem,
): number | null {
  let sum = 0;
  let found = false;
  for (const item of items) {
    const n = Number(item[field]);
    if (item[field] !== undefined && item[field] !== null && Number.isFinite(n)) {
      sum += n;
      found = true;
    }
  }
  return found ? sum : null;
}

interface ListFetch {
  data: TrackersListResponse | null;
  isLoading: boolean;
  error: string | null;
}

export function TrackerIndex() {
  const navigate = useNavigate();
  const [{ data, isLoading, error }, setFetch] = useState<ListFetch>({
    data: null,
    isLoading: true,
    error: null,
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getTrackers(controller.signal)
      .then((res) => setFetch({ data: res, isLoading: false, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setFetch({ data: null, isLoading: false, error: getErrorMessage(err) });
      });
    return () => controller.abort();
  }, [reloadKey]);

  const goDetail = (strategyId: string) => navigate(`/dashboard/strategy/${strategyId}`);

  const items = data?.items ?? [];
  const tracked = items.filter(isTracked);
  const untracked = items.filter((i) => !isTracked(i));

  const combinedValue = sumField(tracked, 'total_value');
  const pnlTotal = sumField(tracked, 'pnl_total');
  const pnlDay = sumField(tracked, 'pnl_day');

  return (
    <div data-testid="tracker-index">
      <div className="page-header">
        <div>
          <div className="trk-head-row">
            <h1 className="page-title">Strategy Tracker</h1>
            {data?.data_as_of && (
              <span className="trk-asof" data-testid="tracker-asof">
                <CalendarClock size={12} aria-hidden />
                Datos al cierre de {fmtDate(data.data_as_of)}
              </span>
            )}
          </div>
          <p className="page-sub">
            Los portafolios en vivo que generan tus estrategias.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="trk-error-box" data-testid="index-loading">
          <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto' }} />
        </div>
      ) : error ? (
        <div className="card">
          <div className="trk-error-box" data-testid="index-error">
            <div>{error}</div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setFetch((f) => ({ ...f, isLoading: true }));
                setReloadKey((k) => k + 1);
              }}
            >
              Reintentar
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="trk-empty" data-testid="index-empty">
            <Target size={32} style={{ color: 'var(--c-text-dim)' }} aria-hidden />
            <h3>Aún no tienes estrategias</h3>
            <p>
              Crea una estrategia en el builder y actívale un tracker para seguirla
              en vivo.
            </p>
            <Button size="sm" onClick={() => navigate('/dashboard/builder')}>
              Ir al builder
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="stat-row" data-testid="index-summary">
            <div className="stat-card">
              <div className="stat-label">Trackers</div>
              <div className="stat-value">{tracked.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Valor combinado</div>
              <div className={`stat-value ${combinedValue === null ? 'placeholder' : ''}`}>
                {fmtMoney(combinedValue)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">P&L total</div>
              <div
                className={`stat-value ${pnlTotal === null ? 'placeholder' : ''}`}
                style={pnlClass(pnlTotal ?? undefined) ? { color: `var(--c-${pnlClass(pnlTotal ?? undefined)})` } : undefined}
              >
                {fmtMoney(pnlTotal)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">P&L día</div>
              <div
                className={`stat-value ${pnlDay === null ? 'placeholder' : ''}`}
                style={pnlClass(pnlDay ?? undefined) ? { color: `var(--c-${pnlClass(pnlDay ?? undefined)})` } : undefined}
              >
                {fmtMoney(pnlDay)}
              </div>
            </div>
          </div>

          {tracked.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="trk-pos-table-wrap">
                <table className="tbl" data-testid="trackers-table">
                  <thead>
                    <tr>
                      <th>Estrategia</th>
                      <th>Status</th>
                      <th>Tendencia</th>
                      <th className="num">Valor</th>
                      <th className="num">P&L total</th>
                      <th className="num">P&L día</th>
                      <th className="num">Posiciones</th>
                      <th>Próximo rebalanceo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracked.map((t) => (
                      <tr
                        key={t.strategy_id}
                        className="clickable"
                        onClick={() => goDetail(t.strategy_id)}
                        data-testid={`tracker-row-${t.strategy_id}`}
                      >
                        <td className="name-cell">
                          {t.strategy_name}
                          {t.version !== undefined && (
                            <span className="dim" style={{ marginLeft: 6, fontSize: 11 }}>
                              v{t.version}
                            </span>
                          )}
                        </td>
                        <td>{t.status && <TrackerStatusBadge status={t.status} />}</td>
                        <td>
                          <Sparkline points={t.sparkline} />
                        </td>
                        <td className="num">{fmtMoney(t.total_value)}</td>
                        <td className={`num ${pnlClass(t.pnl_total)}`}>
                          {fmtMoney(t.pnl_total)}
                          <span className="dim"> ({fmtPct(t.pnl_total_pct, 1, true)})</span>
                        </td>
                        <td className={`num ${pnlClass(t.pnl_day)}`}>
                          {fmtMoney(t.pnl_day)}
                          <span className="dim"> ({fmtPct(t.pnl_day_pct, 1, true)})</span>
                        </td>
                        <td className="num">{t.holdings_count ?? '—'}</td>
                        <td>{fmtDate(t.next_rebalance_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="trk-pos-cards" data-testid="trackers-cards">
                {tracked.map((t) => (
                  <button
                    type="button"
                    className="trk-pos-card trk-index-card"
                    key={t.strategy_id}
                    onClick={() => goDetail(t.strategy_id)}
                  >
                    <div className="trk-pos-card-top">
                      <div>
                        <strong>{t.strategy_name}</strong>
                        <div style={{ marginTop: 4 }}>
                          {t.status && <TrackerStatusBadge status={t.status} />}
                        </div>
                      </div>
                      <Sparkline points={t.sparkline} />
                    </div>
                    <div className="trk-pos-card-grid">
                      <span className="trk-date-label">Valor</span>
                      <span className="trk-date-label">P&L</span>
                      <span className="trk-date-label">Rebalanceo</span>
                      <span>{fmtMoney(t.total_value)}</span>
                      <span className={pnlClass(t.pnl_total)}>
                        {fmtMoney(t.pnl_total)}
                      </span>
                      <span>{fmtDate(t.next_rebalance_date)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {untracked.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }} data-testid="untracked-group">
              <div className="card-head">
                <div>
                  <div className="card-title">Estrategias sin tracker</div>
                  <div className="card-sub">
                    Actívales un tracker para seguirlas en vivo
                  </div>
                </div>
              </div>
              <div className="trk-untracked-list">
                {untracked.map((s) => (
                  <div className="trk-untracked-row" key={s.strategy_id}>
                    <span>{s.strategy_name}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => goDetail(s.strategy_id)}
                    >
                      Activar tracker
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
