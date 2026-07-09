import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Loader2, Target } from 'lucide-react';
import { Button } from '@/components/ui';
import { useTrackerStore } from './store';
import { TrackerHeader } from './components/TrackerHeader';
import { TrackerBanners } from './components/TrackerBanners';
import { TrackerActions } from './components/TrackerActions';
import './tracker.css';

/**
 * Strategy Tracker detail view (route: /dashboard/strategy/:strategyId).
 * Sections land incrementally: header/banners/actions (#5), activation (#6),
 * positions (#7), drift (#8), performance (#9), sectors (#10), journal (#11).
 */
export function TrackerDetail() {
  const { strategyId } = useParams<{ strategyId: string }>();
  const isLoading = useTrackerStore((s) => s.isLoading);
  const error = useTrackerStore((s) => s.error);
  const notFound = useTrackerStore((s) => s.notFound);
  const tracker = useTrackerStore((s) => s.tracker);
  const load = useTrackerStore((s) => s.load);
  const reset = useTrackerStore((s) => s.reset);

  useEffect(() => {
    if (strategyId) void load(strategyId);
    return () => reset();
  }, [strategyId, load, reset]);

  if (!strategyId) return <Navigate to="/dashboard/strategy" replace />;

  if (isLoading) {
    return (
      <div className="trk-error-box" data-testid="tracker-loading">
        <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="trk-error-box" data-testid="tracker-error">
          <div>{error}</div>
          <Button size="sm" variant="secondary" onClick={() => void load(strategyId)}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (notFound) {
    // Issue #6 replaces this empty state with the activation flow
    // (materialization preview + POST tracker).
    return (
      <div className="card">
        <div className="trk-empty" data-testid="tracker-not-found">
          <Target size={32} style={{ color: 'var(--c-text-dim)' }} aria-hidden />
          <h3>Esta estrategia no tiene tracker</h3>
          <p>
            Activa el tracker para materializar la estrategia en un portafolio y
            seguirla en vivo.
          </p>
        </div>
      </div>
    );
  }

  if (!tracker) return null;

  return (
    <div data-testid="tracker-detail">
      <TrackerHeader />
      <TrackerBanners />
      <TrackerActions />
    </div>
  );
}
