import { AlertTriangle, Clock, PauseCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { useTrackerStore } from '../store';
import { hasInertWarning } from '../types';

/**
 * Conditional state banners: paused, error, inert clause, intraday.
 * Which ones show is driven entirely by store state.
 */
export function TrackerBanners() {
  const tracker = useTrackerStore((s) => s.tracker);
  const warnings = useTrackerStore((s) => s.warnings);
  const intraday = useTrackerStore((s) => s.intraday);
  const setStatus = useTrackerStore((s) => s.setStatus);
  if (!tracker) return null;

  const inertWarning = hasInertWarning(warnings);

  return (
    <div>
      {tracker.status === 'paused' && (
        <div className="trk-banner warn" data-testid="banner-paused">
          <PauseCircle size={16} aria-hidden />
          <div className="trk-banner-body">
            <div className="trk-banner-title">Tracker pausado</div>
            El portafolio se sigue valuando a diario, pero no se ejecutan
            rebalanceos. Al reanudar se hará catch-up de las evaluaciones
            pendientes.
          </div>
          <Button size="sm" variant="secondary" onClick={() => setStatus('active')}>
            Reanudar
          </Button>
        </div>
      )}

      {tracker.status === 'error' && (
        <div className="trk-banner error" data-testid="banner-error">
          <XCircle size={16} aria-hidden />
          <div className="trk-banner-body">
            <div className="trk-banner-title">El tracker está detenido por un error</div>
            {tracker.last_error ?? 'Error desconocido.'}
          </div>
          <Button size="sm" variant="secondary" onClick={() => setStatus('active')}>
            Reactivar
          </Button>
        </div>
      )}

      {inertWarning && (
        <div className="trk-banner warn" data-testid="banner-inert">
          <AlertTriangle size={16} aria-hidden />
          <div className="trk-banner-body">
            <div className="trk-banner-title">Cláusula inerte</div>
            {inertWarning}
          </div>
        </div>
      )}

      {intraday && (
        <div className="trk-banner info" data-testid="banner-intraday">
          <Clock size={16} aria-hidden />
          <div className="trk-banner-body">
            <div className="trk-banner-title">Precios intradía</div>
            Las posiciones se muestran con marcas intradía por posición; no son
            datos oficiales de cierre.
          </div>
        </div>
      )}
    </div>
  );
}
