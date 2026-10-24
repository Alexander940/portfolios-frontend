import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { basketErrorMessage, getBasket, listBaskets } from './basketService';
import { formatDay } from './lib';
import type { BasketChange, BasketListItem } from './types';
import { ChangeLine } from './components/ChangeLine';
import { CreateBasketModal } from './components/CreateBasketModal';
import { DeleteBasketDialog } from './components/DeleteBasketDialog';
import { PRIMARY } from './components/styles';

const CARD_CHANGES = 5;

/**
 * Página «Baskets» (#295, contrato 4): bloque «System» (baskets de índice con
 * conteo, fecha de pesos y los últimos cambios de composición) y «My baskets»
 * (los del usuario). «New basket» abre el alta desde tickers.
 *
 * `GET /baskets/` no trae `recent_changes`: se pide el detalle de cada basket
 * de sistema (hoy sólo el S&P 500) para la tarjeta; si falla, la tarjeta se
 * muestra sin cambios.
 */
export function BasketsIndex() {
  const navigate = useNavigate();
  const [items, setItems] = useState<BasketListItem[]>([]);
  const [changes, setChanges] = useState<Record<string, BasketChange[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<BasketListItem | null>(null);

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    setLoading(true);
    try {
      const list = await listBaskets();
      if (isCancelled()) return;
      setItems(list);
      setError(null);
      const system = list.filter((b) => b.is_system);
      const details = await Promise.allSettled(system.map((b) => getBasket(b.basket_id)));
      if (isCancelled()) return;
      const next: Record<string, BasketChange[]> = {};
      details.forEach((r, i) => {
        if (r.status === 'fulfilled') next[system[i].basket_id] = r.value.recent_changes;
      });
      setChanges(next);
    } catch (err) {
      if (!isCancelled()) setError(basketErrorMessage(err));
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const system = items.filter((b) => b.is_system);
  const mine = items.filter((b) => !b.is_system);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Baskets</h1>
          <p className="text-gray-600 mt-1">
            Named lists of symbols to use as a strategy universe — index constituents or your own.
          </p>
        </div>
        <button type="button" className={PRIMARY} onClick={() => setCreateOpen(true)}>
          <Plus size={16} aria-hidden /> New basket
        </button>
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
          data-testid="baskets-error"
        >
          Could not load baskets: {error}{' '}
          <button type="button" className="font-semibold underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {loading && items.length === 0 ? (
        <SkeletonGrid />
      ) : !error && items.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        !error && (
          <>
            {system.length > 0 && (
              <section className="mb-8" data-testid="system-baskets">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  System
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {system.map((b) => (
                    <div
                      key={b.basket_id}
                      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                      data-testid="system-basket-card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            to={`/dashboard/baskets/${b.basket_id}`}
                            className="text-lg font-semibold text-gray-900 hover:underline"
                          >
                            {b.name}
                          </Link>
                          <p className="mt-0.5 text-sm text-gray-500">
                            <span className="font-semibold text-gray-800">{b.member_count}</span> members
                            {b.weights_as_of && <> · Weights as of {b.weights_as_of}</>}
                          </p>
                        </div>
                        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                          Index
                        </span>
                      </div>
                      {(changes[b.basket_id]?.length ?? 0) > 0 && (
                        <div className="mt-4">
                          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Recent changes
                          </h3>
                          <ul className="space-y-1">
                            {changes[b.basket_id].slice(0, CARD_CHANGES).map((c, i) => (
                              <ChangeLine key={`${c.ticker}-${c.date}-${c.kind}-${i}`} change={c} />
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section data-testid="my-baskets">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                My baskets
              </h2>
              {mine.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                  No baskets yet — create one from a list of tickers.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {mine.map((b) => (
                    <div
                      key={b.basket_id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                      data-testid="user-basket-card"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/dashboard/baskets/${b.basket_id}`}
                          className="block truncate font-semibold text-gray-900 hover:underline"
                        >
                          {b.name}
                        </Link>
                        {b.description && (
                          <p className="truncate text-sm text-gray-600">{b.description}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          {b.member_count} {b.member_count === 1 ? 'symbol' : 'symbols'} · updated{' '}
                          {formatDay(b.updated_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg border border-gray-200 p-1.5 text-red-500 hover:bg-red-50"
                        aria-label={`Delete ${b.name}`}
                        title="Delete"
                        onClick={() => setToDelete(b)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )
      )}

      <CreateBasketModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
        onOpen={(id) => navigate(`/dashboard/baskets/${id}`)}
      />
      <DeleteBasketDialog
        basket={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={(id) => setItems((cur) => cur.filter((b) => b.basket_id !== id))}
      />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="baskets-loading">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl border border-gray-200 bg-gray-100" />
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-white rounded-xl p-10 shadow-sm border border-gray-200 text-center">
      <div className="w-16 h-16 bg-[#1e3a5f]/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Layers className="w-8 h-8 text-[#1e3a5f]" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No baskets yet</h3>
      <p className="text-gray-500 max-w-md mx-auto mb-4">
        Paste a list of tickers to build a basket you can use as a strategy universe.
      </p>
      <button type="button" className={PRIMARY} onClick={onCreate}>
        <Plus size={16} aria-hidden /> New basket
      </button>
    </div>
  );
}
