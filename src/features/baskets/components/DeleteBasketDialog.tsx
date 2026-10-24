import { useState } from 'react';
import { Modal } from '@/components/ui';
import { BasketApiError, basketErrorMessage, deleteBasket } from '../basketService';
import { DANGER, ERROR_BOX, SECONDARY } from './styles';

interface DeleteBasketDialogProps {
  basket: { basket_id: string; name: string } | null;
  onClose: () => void;
  onDeleted: (basketId: string) => void;
}

/**
 * Confirmación de borrado (#295, contrato 7). Si el backend responde 409
 * `basket_in_use`, el diálogo pasa a listar las estrategias que lo usan: el
 * borrado está bloqueado hasta desactivar sus trackers.
 */
export function DeleteBasketDialog({ basket, onClose, onDeleted }: DeleteBasketDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inUseBy, setInUseBy] = useState<string[] | null>(null);

  function close() {
    setBusy(false);
    setError(null);
    setInUseBy(null);
    onClose();
  }

  async function confirm() {
    if (!basket) return;
    setBusy(true);
    setError(null);
    try {
      await deleteBasket(basket.basket_id);
      const id = basket.basket_id;
      close();
      onDeleted(id);
    } catch (err) {
      if (err instanceof BasketApiError && err.code === 'basket_in_use') {
        setInUseBy(err.strategies);
      } else {
        setError(basketErrorMessage(err));
      }
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen={basket !== null}
      onClose={close}
      title={inUseBy ? 'Basket in use' : 'Delete basket'}
      size="md"
    >
      {inUseBy ? (
        <div className="space-y-4">
          <ul className="space-y-1 text-sm text-gray-800" data-testid="basket-in-use">
            {(inUseBy.length > 0 ? inUseBy : ['(unknown)']).map((s) => (
              <li key={s}>
                Used by strategy <span className="font-semibold">{s}</span> — deactivate its tracker
                first
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500">
            «{basket?.name}» can be deleted once no active strategy references it.
          </p>
          <div className="flex justify-end">
            <button type="button" className={SECONDARY} onClick={close}>
              OK
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Delete <span className="font-semibold text-gray-900">«{basket?.name}»</span>? Strategies
            that already ran keep their history, but it will disappear from your list.
          </p>
          {error && <p className={ERROR_BOX}>{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={close}>
              Cancel
            </button>
            <button type="button" className={DANGER} onClick={confirm} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete basket'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
