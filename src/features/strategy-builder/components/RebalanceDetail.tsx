// Per-rebalance detail (issue #278). FASE 3 = the minimal shell the index
// navigates to: position «Rebalanceo k de N», the row's dates, prev/next and
// «← Volver al índice». Fase 4 fills it in (books Antes/Después via
// `getRebalance(jobId, seq)`, 8 metrics, the fills with the 0.5 % toggle, the
// period's stops, the < 720 px Antes/Después selector).
import type { RebalanceIndexRow } from '../types';

export interface RebalanceDetailProps {
  jobId: string;
  /** Backend `seq` (0-based) of the selected rebalance. */
  seq: number;
  /** Total rebalances in the run (index `total`). */
  total: number;
  /** The index row for `seq` (dates + metrics already loaded); null if absent. */
  row: RebalanceIndexRow | null;
  onBack: () => void;
  /** Undefined at the first / last rebalance (chronological order). */
  onPrev?: () => void;
  onNext?: () => void;
}

export function RebalanceDetail({ seq, total, row, onBack, onPrev, onNext }: RebalanceDetailProps) {
  return (
    <div className="sb-rb-detail" data-testid="sb-rb-detail">
      <div className="sb-rb-detail-nav">
        <button type="button" className="sb-back" onClick={onBack}>
          ← Volver al índice
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" className="sb-page-btn" disabled={!onPrev} onClick={onPrev}>
          ← Anterior
        </button>
        <button type="button" className="sb-page-btn" disabled={!onNext} onClick={onNext}>
          Siguiente →
        </button>
      </div>
      <div className="card-title" data-testid="sb-rb-detail-title">
        Rebalanceo {seq + 1} de {total}
      </div>
      {row && (
        <div className="card-sub" data-testid="sb-rb-detail-dates">
          Decisión {row.decision_date} → ejecución {row.skipped ? '— (saltado)' : row.fill_date} · período hasta{' '}
          {row.period_end}
        </div>
      )}
    </div>
  );
}
