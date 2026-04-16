import { useCallback, useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui';
import {
  getPriceHistory,
  type PriceHistoryResponse,
  type PricePoint,
} from '@/services/symbolService';

interface SymbolModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbolId: string;
  ticker: string;
  name: string;
  exchange?: string | null;
  sector?: string | null;
}

const PERIODS = ['1m', '3m', '6m', '1y', '5y', 'max'] as const;

const PERIOD_LABELS: Record<string, string> = {
  '1m': '1M',
  '3m': '3M',
  '6m': '6M',
  '1y': '1Y',
  '5y': '5Y',
  max: 'Max',
};

export function SymbolModal({
  isOpen,
  onClose,
  symbolId,
  ticker,
  name,
  exchange,
  sector,
}: SymbolModalProps) {
  const [period, setPeriod] = useState<string>('1y');
  const [data, setData] = useState<PriceHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (p: string) => {
      if (!symbolId) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await getPriceHistory(symbolId, p);
        setData(result);
      } catch {
        setError('Error loading price data');
      } finally {
        setIsLoading(false);
      }
    },
    [symbolId],
  );

  useEffect(() => {
    if (isOpen) {
      fetchData(period);
    } else {
      setData(null);
      setPeriod('1y');
    }
  }, [isOpen, symbolId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePeriodChange(p: string) {
    setPeriod(p);
    fetchData(p);
  }

  const prices = data?.prices ?? [];
  const firstClose = prices.length > 0 ? prices[0].close : 0;
  const lastClose = prices.length > 0 ? prices[prices.length - 1].close : 0;
  const change = lastClose - firstClose;
  const changePct = firstClose !== 0 ? (change / firstClose) * 100 : 0;
  const isPositive = change >= 0;
  const chartColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ticker}
      description={name}
      size="4xl"
    >
      <div className="space-y-5">
        {/* Symbol info bar */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {exchange && (
            <span className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-medium">
              {exchange}
            </span>
          )}
          {sector && (
            <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">
              {sector}
            </span>
          )}
          {prices.length > 0 && (
            <>
              <span className="text-2xl font-bold text-gray-900">
                ${lastClose.toFixed(2)}
              </span>
              <span
                className={`flex items-center gap-1 font-semibold ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {isPositive ? <TrendingUp size={16} /> : change === 0 ? <Minus size={16} /> : <TrendingDown size={16} />}
                {isPositive ? '+' : ''}
                {change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            </>
          )}
        </div>

        {/* Period tabs */}
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePeriodChange(p)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${
                  p === period
                    ? 'bg-[#1e3a5f] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Chart area */}
        <div className="h-80 w-full">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              {error}
            </div>
          ) : prices.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              No price data available for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={prices}
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={formatDate}
                  minTickGap={40}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  width={60}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={chartColor}
                  strokeWidth={2}
                  fill="url(#colorClose)"
                  dot={false}
                  animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Summary stats */}
        {prices.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Open" value={`$${prices[prices.length - 1].open.toFixed(2)}`} />
            <StatCard label="High" value={`$${prices[prices.length - 1].high.toFixed(2)}`} />
            <StatCard label="Low" value={`$${prices[prices.length - 1].low.toFixed(2)}`} />
            <StatCard
              label="Volume"
              value={formatVolume(prices[prices.length - 1].volume)}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function formatVolume(volume: number | null): string {
  if (volume === null || volume === 0) return '—';
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(1)}B`;
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}K`;
  return volume.toLocaleString();
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!active || !payload?.length) return null;
  const p: PricePoint = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-xs">
      <div className="font-semibold text-gray-900 mb-1">{label}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-600">
        <span>Open</span><span className="text-right font-medium">${p.open.toFixed(2)}</span>
        <span>High</span><span className="text-right font-medium">${p.high.toFixed(2)}</span>
        <span>Low</span><span className="text-right font-medium">${p.low.toFixed(2)}</span>
        <span>Close</span><span className="text-right font-semibold text-gray-900">${p.close.toFixed(2)}</span>
        <span>Volume</span><span className="text-right font-medium">{formatVolume(p.volume)}</span>
      </div>
    </div>
  );
}
