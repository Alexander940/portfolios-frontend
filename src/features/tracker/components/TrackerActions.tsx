import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  BellOff,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Button, Checkbox, Input, Modal } from '@/components/ui';
import { useTrackerStore } from '../store';

function RebaseModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const tracker = useTrackerStore((s) => s.tracker);
  const actionBusy = useTrackerStore((s) => s.actionBusy);
  const rebase = useTrackerStore((s) => s.rebase);
  const [version, setVersion] = useState<string>('');

  const currentVersion = tracker?.version;
  const latestVersion = tracker?.latest_version;
  const target = version !== '' ? Number(version) : latestVersion;
  const canSubmit = target !== undefined && Number.isInteger(target) && target > 0;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    const ok = await rebase(target);
    if (ok) {
      setVersion('');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Actualizar versión de la estrategia"
      description={
        currentVersion !== undefined && latestVersion !== undefined
          ? `El tracker sigue la versión ${currentVersion}; la última disponible es la ${latestVersion}.`
          : 'Indica la versión de la estrategia que debe seguir el tracker.'
      }
      size="sm"
    >
      <Input
        label="Versión destino"
        type="number"
        min={1}
        value={version}
        placeholder={latestVersion !== undefined ? String(latestVersion) : ''}
        onChange={(e) => setVersion(e.target.value)}
      />
      <div className="trk-modal-warn">
        <AlertTriangle size={15} aria-hidden />
        <span>
          Actualizar la versión fuerza un <strong>rebalanceo inmediato</strong> del
          portafolio en la próxima evaluación.
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="ghost" onClick={onClose} disabled={actionBusy}>
          Cancelar
        </Button>
        <Button onClick={handleConfirm} isLoading={actionBusy} disabled={!canSubmit}>
          Actualizar versión
        </Button>
      </div>
    </Modal>
  );
}

function DeleteModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const actionBusy = useTrackerStore((s) => s.actionBusy);
  const remove = useTrackerStore((s) => s.remove);
  const [keepPortfolio, setKeepPortfolio] = useState(true);

  const handleConfirm = async () => {
    const ok = await remove(keepPortfolio);
    if (ok) {
      onClose();
      navigate('/dashboard/strategy');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Eliminar tracker"
      description="Se dejará de seguir esta estrategia. Esta acción no se puede deshacer."
      size="sm"
    >
      <Checkbox
        label="Conservar el portafolio asociado"
        checked={keepPortfolio}
        onChange={(e) => setKeepPortfolio(e.target.checked)}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="ghost" onClick={onClose} disabled={actionBusy}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={handleConfirm} isLoading={actionBusy}>
          Eliminar tracker
        </Button>
      </div>
    </Modal>
  );
}

export function TrackerActions() {
  const tracker = useTrackerStore((s) => s.tracker);
  const setStatus = useTrackerStore((s) => s.setStatus);
  const setNotifications = useTrackerStore((s) => s.setNotifications);
  const [rebaseOpen, setRebaseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  if (!tracker) return null;

  const paused = tracker.status === 'paused';
  const notifs = tracker.notifications_enabled;

  return (
    <div className="trk-actions" data-testid="tracker-actions">
      {tracker.status !== 'error' && (
        <Button
          size="sm"
          variant="secondary"
          leftIcon={paused ? <Play size={14} /> : <Pause size={14} />}
          onClick={() => setStatus(paused ? 'active' : 'paused')}
        >
          {paused ? 'Reanudar' : 'Pausar'}
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        leftIcon={notifs ? <Bell size={14} /> : <BellOff size={14} />}
        onClick={() => setNotifications(!notifs)}
        aria-pressed={notifs}
      >
        Notificaciones: {notifs ? 'on' : 'off'}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        leftIcon={<RefreshCw size={14} />}
        onClick={() => setRebaseOpen(true)}
      >
        Actualizar versión
      </Button>
      <div className="spacer" />
      <Button
        size="sm"
        variant="danger"
        leftIcon={<Trash2 size={14} />}
        onClick={() => setDeleteOpen(true)}
      >
        Eliminar
      </Button>

      <RebaseModal isOpen={rebaseOpen} onClose={() => setRebaseOpen(false)} />
      <DeleteModal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}
