import { useState } from 'react';
import { Modal } from '@/components/ui';
import { addMembers, BasketApiError, basketErrorMessage } from '../basketService';
import { formatAddResult, parseTickers } from '../lib';
import type { BasketCreateResponse } from '../types';
import { ERROR_BOX, INPUT, LABEL, OK_BOX, PRIMARY, SECONDARY } from './styles';

interface AddTickersModalProps {
  basketId: string;
  isOpen: boolean;
  onClose: () => void;
  onAdded: (res: BasketCreateResponse) => void;
}

/** «Add tickers» del detalle (#295, contrato 6): mismo parser que el alta. */
export function AddTickersModal({ basketId, isOpen, onClose, onAdded }: AddTickersModalProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const tickers = parseTickers(text);

  function close() {
    setText('');
    setError(null);
    setSummary(null);
    setBusy(false);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tickers.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await addMembers(basketId, tickers);
      setSummary(formatAddResult(res));
      setText('');
      onAdded(res);
    } catch (err) {
      setError(
        err instanceof BasketApiError && err.code === 'no_resolved_tickers'
          ? formatAddResult({ resolved: 0, skipped: err.skipped })
          : basketErrorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title="Add tickers" size="md">
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label htmlFor="basket-add-tickers" className={LABEL}>
            Tickers
          </label>
          <textarea
            id="basket-add-tickers"
            className={`${INPUT} h-28 font-mono`}
            placeholder="AVGO, TSM"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
        </div>
        {summary && (
          <p className={OK_BOX} data-testid="add-result">
            {summary}
          </p>
        )}
        {error && <p className={ERROR_BOX}>{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={SECONDARY} onClick={close}>
            {summary ? 'Done' : 'Cancel'}
          </button>
          <button type="submit" className={PRIMARY} disabled={tickers.length === 0 || busy}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
