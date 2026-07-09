import type { TrackerStatus } from '../types';

const LABELS: Record<TrackerStatus, string> = {
  active: 'Activo',
  paused: 'Pausado',
  error: 'Error',
};

export function TrackerStatusBadge({ status }: { status: TrackerStatus }) {
  return (
    <span className={`trk-status ${status}`} data-testid="tracker-status-badge">
      {LABELS[status] ?? status}
    </span>
  );
}
