import { useState } from 'react';
import { Modal } from '@/components/ui';
import { basketErrorMessage } from '../basketService';
import { ERROR_BOX, INPUT, LABEL, PRIMARY, SECONDARY } from './styles';

interface BasketNameModalProps {
  isOpen: boolean;
  title: string;
  submitLabel: string;
  initialName: string;
  /** Si se pasa (aunque sea ''), muestra el campo descripción (Rename). */
  initialDescription?: string;
  onClose: () => void;
  /** Lanza en error; el modal muestra el mensaje inline (p. ej. 409 de nombre). */
  onSubmit: (name: string, description: string | null) => Promise<void>;
}

/**
 * Modal de nombre compartido por «Rename» y «Duplicate» del detalle. El padre
 * lo monta sólo mientras está abierto, así el estado arranca de las props.
 */
export function BasketNameModal({
  isOpen,
  title,
  submitLabel,
  initialName,
  initialDescription,
  onClose,
  onSubmit,
}: BasketNameModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const withDescription = initialDescription !== undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name.trim(), withDescription ? description.trim() || null : null);
    } catch (err) {
      setError(basketErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label htmlFor="basket-name-modal" className={LABEL}>
            Name
          </label>
          <input
            id="basket-name-modal"
            className={INPUT}
            value={name}
            maxLength={255}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        {withDescription && (
          <div>
            <label htmlFor="basket-description-modal" className={LABEL}>
              Description
            </label>
            <input
              id="basket-description-modal"
              className={INPUT}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        )}
        {error && (
          <p className={ERROR_BOX} data-testid="name-error">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className={SECONDARY} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={PRIMARY} disabled={!name.trim() || busy}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
