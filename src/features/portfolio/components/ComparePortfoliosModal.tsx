import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui';
import {
  getPerformanceCurve,
  type PerformanceCurveResponse,
  type PortfolioResponse,
} from '@/services/portfolioService';
import { isApiError } from '@/lib/apiErrors';
import { computeStats } from '../lib/perfStats';
import { fmtDate, fmtNumber } from '../lib/format';

const LINE_COLORS = [
  '#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#0d9488',
];

interface ComparePortfoliosModalProps {
  isOpen: boolean;
  onClose: () => void;
  portfolios: PortfolioResponse[];
}

interface Loaded {
  id: string;
  name: string;
  color: string;
  curve: PerformanceCurveResponse | null;
  error: string | null;
}

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${fmtNumber(n, 2)}%`;
}

function num(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return fmtNumber(n, 2);
}

export function ComparePortfoliosModal({
  isOpen,
  onClose,
  portfolios,
}: ComparePortfoliosModalProps) {
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Re-fetch when the modal opens or the selected set changes.
  const idsKey = portfolios.map((p) => p.portfolio_id).join(',');

  useEffect(() => {
    if (!isOpen || portfolios.length === 0) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setIsLoading(true);
    setLoaded([]);

    Promise.all(
      portfolios.map((p, i) =>
        getPerformanceCurve(
          p.portfolio_id,
          { base_mode: 'index_100' },
          controller.signal,
        )
          .then(
            (curve): Loaded => ({
              id: p.portfolio_id,
              name: p.name,
              color: LINE_COLORS[i % LINE_COLORS.length],
              curve,
              error: null,
            }),
          )
          .catch(
            (err): Loaded => ({
              id: p.portfolio_id,
              name: p.name,
              color: LINE_COLORS[i % LINE_COLORS.length],
              curve: null,
              error: isApiError(err) ? err.message : 'No se pudo cargar la curva.',
            }),
          ),
      ),
    )
      .then((results) => {
        if (!controller.signal.aborted) setLoaded(results);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
    // idsKey captures the portfolios identity; portfolios itself is unstable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, idsKey]);

  const chartData = useMemo(() => {
    const dateSet = new Set<string>();
    for (const l of loaded) l.curve?.points.forEach((p) => dateSet.add(p.date));
    const dates = [...dateSet].sort();
    const byId: Record<string, Record<string, number>> = {};
    for (const l of loaded) {
      const m: Record<string, number> = {};
      l.curve?.points.forEach((p) => {
        m[p.date] = Number(p.portfolio_value);
      });
      byId[l.id] = m;
    }
    return dates.map((d) => {
      const row: Record<string, string | number | null> = { date: d };
      for (const l of loaded) row[l.id] = byId[l.id][d] ?? null;
      return row;
    });
  }, [loaded]);

  const metrics = useMemo(
    () =>
      loaded.map((l) => ({
        ...l,
        stats: l.curve ? computeStats(l.curve) : null,
      })),
    [loaded],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compare portfolios"
      description={`${portfolios.length} portfolios — equity rebased to 100 at each start.`}
      size="4xl"
    >
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Loader2
            size={28}
            color="var(--c-text-dim)"
            style={{ animation: 'spin 1s linear infinite' }}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d) => fmtDate(String(d))}
                  minTickGap={40}
                />
                <YAxis tick={{ fontSize: 11 }} width={48} domain={['auto', 'auto']} />
                <Tooltip
                  formatter={(v) => (v == null ? '—' : num(Number(v)))}
                  labelFormatter={(d) => fmtDate(String(d))}
                />
                <Legend />
                {loaded.map((l) => (
                  <Line
                    key={l.id}
                    type="monotone"
                    dataKey={l.id}
                    name={l.name}
                    stroke={l.color}
                    dot={false}
                    connectNulls
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <table className="tbl" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Portfolio</th>
                <th className="num">Return %</th>
                <th className="num">Sharpe</th>
                <th className="num">Vol %</th>
                <th className="num">Max DD %</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: m.color,
                        }}
                      />
                      {m.name}
                    </span>
                  </td>
                  {m.error ? (
                    <td colSpan={4} className="dim">
                      {m.error}
                    </td>
                  ) : (
                    <>
                      <td className="num">{pct(m.stats?.portfolioPct)}</td>
                      <td className="num">{num(m.stats?.sharpe)}</td>
                      <td className="num">{pct(m.stats?.volPct)}</td>
                      <td className="num">{pct(m.stats?.maxDdPct)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
