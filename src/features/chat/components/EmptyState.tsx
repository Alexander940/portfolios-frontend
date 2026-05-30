import { Award, BarChart3, PieChart, Sparkles, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';

interface Suggestion {
  icon: ReactNode;
  title: string;
  desc: string;
  query: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    icon: <PieChart size={16} />,
    title: 'Analiza AAPL a fondo',
    desc: 'Fundamentals, tendencia y Profit Factor',
    query: 'Analiza AAPL a fondo: fundamentals, tendencia y Profit Factor.',
  },
  {
    icon: <Award size={16} />,
    title: 'Acciones "approved" sólidas',
    desc: 'Filtra por verdict y Sharpe',
    query:
      "Busca acciones con verdict 'approved' y Sharpe 12m mayor a 1, ordenadas por Profit Factor descendente.",
  },
  {
    icon: <TrendingUp size={16} />,
    title: 'Compara MSFT vs GOOGL',
    desc: 'Rendimiento, riesgo y valoración',
    query: 'Compara MSFT y GOOGL: rendimiento, riesgo y valoración.',
  },
  {
    icon: <BarChart3 size={16} />,
    title: 'Analiza mi portafolio',
    desc: 'Posiciones, ratings y P&L',
    query: 'Analiza mi portafolio: posiciones, ratings actuales y P&L.',
  },
];

export function EmptyState({ onPick }: { onPick: (query: string) => void }) {
  return (
    <div className="chat-empty">
      <div className="chat-empty-mark">
        <Sparkles size={26} />
      </div>
      <h1>¿En qué puedo ayudarte con tus acciones?</h1>
      <p>
        Estoy conectado a tus datos en vivo —fundamentals, rendimiento, ratings de
        tendencia, Profit Factor y el screener— y a tus carteras. Pídeme analizar
        una acción, comparar dos, o filtrar el universo.
      </p>
      <div className="sugg-grid">
        {SUGGESTIONS.map((s, i) => (
          <button key={i} className="sugg-card" onClick={() => onPick(s.query)}>
            <span className="sugg-icon">{s.icon}</span>
            <span className="sugg-text">
              <span className="t">{s.title}</span>
              <span className="d">{s.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
