import { useState } from 'react';
import { Modal } from '@/components/ui';
import { createBasket, basketErrorMessage, BasketApiError } from '../basketService';
import { formatAddResult, parseTickers } from '../lib';
import type { BasketCreateResponse } from '../types';
import { ERROR_BOX, INPUT, LABEL, OK_BOX, PRIMARY, SECONDARY } from './styles';

interface CreateBasketModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Se llama apenas el backend crea el basket (para refrescar la lista). */
  onCreated: (res: BasketCreateResponse) => void;
  /** «Open basket»: navegar al detalle del recién creado. */
  onOpen: (basketId: string) => void;
}

/**
 * Crear un basket desde una lista de tickers (#295, contrato 5). El textarea
 * acepta comas, `;`, espacios y saltos de línea — pegar una columna de Excel
 * funciona. Tras crear muestra cuántos se resolvieron y cuáles se saltearon
 * (con motivo) antes de navegar al detalle.
 */
export function CreateBasketModal({ isOpen, onClose, onCreated, onOpen }: CreateBasketModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tickersText, setTickersText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BasketCreateResponse | null>(null);

  const tickers = parseTickers(tickersText);
  const canSubmit = name.trim().length > 0 && tickers.length > 0 && !submitting;

  function reset() {
    setName('');
    setDescription('');
    setTickersText('');
    setError(null);
    setResult(null);
    setSubmitting(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createBasket({
        name: name.trim(),
        description: description.trim() || null,
        tickers,
      });
      setResult(res);
      onCreated(res);
    } catch (err) {
      if (err instanceof BasketApiError && err.code === 'no_resolved_tickers') {
        setError(`${err.message}: ${formatAddResult({ resolved: 0, skipped: err.skipped })}`);
      } else {
        setError(basketErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title="New basket" size="lg">
      {result ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">{result.basket.name}</span> created.
          </p>
          <p
            className={OK_BOX}
            data-testid="create-result"
          >
            {formatAddResult(result)}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={close}>
              Close
            </button>
            <button
              type="button"
              className={PRIMARY}
              onClick={() => {
                const id = result.basket.basket_id;
                close();
                onOpen(id);
              }}
            >
              Open basket
            </button>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="basket-name" className={LABEL}>
              Name
            </label>
            <input
              id="basket-name"
              className={INPUT}
              value={name}
              maxLength={255}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="basket-description" className={LABEL}>
              Description <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="basket-description"
              className={INPUT}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="basket-tickers" className={LABEL}>
              Tickers
            </label>
            <textarea
              id="basket-tickers"
              className={`${INPUT} h-32 font-mono`}
              placeholder={'NVDA, AMD, AVGO\nor paste a column from Excel'}
              value={tickersText}
              onChange={(e) => setTickersText(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Separate with commas, spaces, semicolons or new lines · {tickers.length} ticker
              {tickers.length === 1 ? '' : 's'}
            </p>
          </div>
          {error && (
            <p
              className={ERROR_BOX}
              data-testid="create-error"
            >
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={close}>
              Cancel
            </button>
            <button type="submit" className={PRIMARY} disabled={!canSubmit}>
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
