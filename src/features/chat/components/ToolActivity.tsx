import { Check, Database, Loader2 } from 'lucide-react';
import type { ToolActivity } from '../types';

/** Friendly labels for the backend's curated data tools. */
const TOOL_LABELS: Record<string, string> = {
  search_symbols: 'Buscando símbolos',
  get_fundamentals: 'Fundamentals',
  get_performance: 'Rendimiento',
  get_trend_and_signals: 'Tendencia y señales',
  get_profit_factor: 'Profit Factor',
  get_technical_indicators: 'Indicadores técnicos',
  screen_stocks: 'Filtrando el universo',
  get_price_history: 'Histórico de precios',
  list_my_portfolios: 'Tus carteras',
  get_portfolio: 'Tu cartera',
};

export function ToolActivityRow({ tools }: { tools: ToolActivity[] }) {
  if (!tools || tools.length === 0) return null;

  return (
    <div className="tool-activity">
      {tools.map((t, i) => {
        const label = TOOL_LABELS[t.name] ?? t.name;
        const detail = t.ticker
          ? ` · ${t.ticker}`
          : typeof t.rowCount === 'number'
            ? ` · ${t.rowCount}`
            : '';
        return (
          <span key={`${t.name}-${i}`} className={`tool-chip ${t.status}`}>
            {t.status === 'running' ? (
              <Loader2 size={11} className="spin" />
            ) : t.status === 'error' ? (
              <Database size={11} />
            ) : (
              <Check size={11} />
            )}
            {label}
            {detail}
          </span>
        );
      })}
    </div>
  );
}
