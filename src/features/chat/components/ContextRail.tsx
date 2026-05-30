import { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { listPortfolios, type PortfolioResponse } from '@/services/portfolioService';

/** Static list of data domains the assistant can read (matches the tools). */
const CONNECTED_DATA = [
  'Fundamentals & valoración',
  'Rendimiento & riesgo',
  'Tendencia & ratings',
  'Profit Factor & ciclo',
  'Indicadores técnicos',
  'Precios & screener',
];

interface ContextRailProps {
  /** Called when the user clicks one of their portfolios to analyze it. */
  onAskPortfolio: (name: string) => void;
}

/**
 * Right-hand context rail: what the assistant is connected to, plus the
 * user's real portfolios as one-click analysis shortcuts.
 */
export function ContextRail({ onAskPortfolio }: ContextRailProps) {
  const [portfolios, setPortfolios] = useState<PortfolioResponse[]>([]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    listPortfolios(50, 0, controller.signal)
      .then((res) => {
        if (active) setPortfolios(res.items);
      })
      .catch(() => {
        /* rail is non-critical — ignore fetch/abort errors */
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return (
    <aside className="context-rail" aria-label="Contexto del asistente">
      <div>
        <div className="ctx-section-label">Datos conectados</div>
        <div className="ctx-source">
          <span className="ctx-dot" />
          Carteras
          <span className="ctx-count">{portfolios.length}</span>
        </div>
        {CONNECTED_DATA.map((c) => (
          <div key={c} className="ctx-source">
            <span className="ctx-dot" />
            {c}
            <span className="ctx-count">live</span>
          </div>
        ))}
      </div>

      <div>
        <div className="ctx-section-label">Tus carteras</div>
        {portfolios.length === 0 ? (
          <div className="ctx-tip" style={{ marginTop: 0 }}>
            Aún no tienes carteras. Créalas desde el Screener o Portfolios y aparecerán aquí.
          </div>
        ) : (
          portfolios.slice(0, 8).map((p) => (
            <button
              key={p.portfolio_id}
              className="ctx-scope-item"
              onClick={() => onAskPortfolio(p.name)}
              title={`Analizar ${p.name}`}
            >
              <Briefcase size={14} />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.name}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="ctx-tip">
        <strong>Tip:</strong> el asistente solo lee datos a los que tienes acceso. Haz
        clic en una cartera para analizarla, o menciona un ticker en tu mensaje.
      </div>
    </aside>
  );
}
