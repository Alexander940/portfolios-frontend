import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Copy, Pencil, Plus, Trash2, X } from 'lucide-react';
import { RatingBadge, toast } from '@/components/ui';
import {
  basketErrorMessage,
  duplicateBasket,
  getBasket,
  removeMember,
  updateBasket,
} from '../basketService';
import { formatDay, formatPrice, formatWeight, SYSTEM_EDIT_TOOLTIP } from '../lib';
import type { BasketChange, BasketDetail, BasketMemberOut } from '../types';
import { AddTickersModal } from './AddTickersModal';
import { BasketNameModal } from './BasketNameModal';
import { ChangeLine } from './ChangeLine';
import { DeleteBasketDialog } from './DeleteBasketDialog';
import { INPUT, SECONDARY } from './styles';

type SortKey = 'ticker' | 'name' | 'sector' | 'weight' | 'rating' | 'valid_from' | 'price';
type SortDir = 'asc' | 'desc';

const COLUMNS: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: 'ticker', label: 'Ticker' },
  { key: 'name', label: 'Name' },
  { key: 'sector', label: 'Sector' },
  { key: 'weight', label: 'Weight %', numeric: true },
  { key: 'rating', label: 'Rating', numeric: true },
  { key: 'valid_from', label: 'Member since' },
  { key: 'price', label: 'Price', numeric: true },
];

/** Comparador con nulls siempre al final, sea cual sea la dirección. */
function compareMembers(a: BasketMemberOut, b: BasketMemberOut, key: SortKey, dir: SortDir): number {
  const va = a[key];
  const vb = b[key];
  if (va === null && vb === null) return a.ticker.localeCompare(b.ticker);
  if (va === null) return 1;
  if (vb === null) return -1;
  const cmp = typeof va === 'number' && typeof vb === 'number'
    ? va - vb
    : String(va).localeCompare(String(vb));
  if (cmp === 0) return a.ticker.localeCompare(b.ticker);
  return dir === 'asc' ? cmp : -cmp;
}

interface BasketDetailViewProps {
  basketId: string;
}

/**
 * Detalle de un basket (#295, contrato 6): cabecera con acciones, tabla de
 * miembros con peso/rating/«member since» (búsqueda, orden y filtro por sector
 * en memoria — hasta ~503 filas, sin virtualizar) y el historial de cambios
 * plegable. Los baskets de sistema son de sólo lectura: las acciones de edición
 * quedan deshabilitadas con el tooltip «Duplicate it to edit».
 */
export function BasketDetailView({ basketId }: BasketDetailViewProps) {
  const navigate = useNavigate();
  const [basket, setBasket] = useState<BasketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('weight');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [renameOpen, setRenameOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBasket(basketId)
      .then((b) => {
        if (cancelled) return;
        setBasket(b);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(basketErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [basketId, reloadKey]);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    basket?.members.forEach((m) => m.sector && set.add(m.sector));
    return [...set].sort();
  }, [basket]);

  const rows = useMemo(() => {
    if (!basket) return [];
    const q = search.trim().toLowerCase();
    return basket.members
      .filter((m) => !sector || m.sector === sector)
      .filter(
        (m) =>
          !q || m.ticker.toLowerCase().includes(q) || (m.name ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => compareMembers(a, b, sortKey, sortDir));
  }, [basket, search, sector, sortKey, sortDir]);

  function toggleSort(key: SortKey, numeric?: boolean) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(numeric ? 'desc' : 'asc');
    }
  }

  async function handleRemove(m: BasketMemberOut) {
    if (!basket) return;
    const previous = basket;
    // Optimista: la fila desaparece ya; si el backend falla, se restaura.
    setBasket({
      ...basket,
      members: basket.members.filter((x) => x.symbol_id !== m.symbol_id),
      member_count: Math.max(0, basket.member_count - 1),
    });
    try {
      await removeMember(basket.basket_id, m.symbol_id);
    } catch (err) {
      setBasket((cur) => (cur && cur.basket_id === previous.basket_id ? restoreMember(cur, m) : cur));
      toast('error', `Could not remove ${m.ticker}: ${basketErrorMessage(err)}`);
    }
  }

  if (loading && !basket) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="basket-detail-loading">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 h-4 w-96 animate-pulse rounded bg-gray-100" />
        <div className="mt-8 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !basket) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BackLink />
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="basket-detail-error">
          {error ?? 'Basket not found'}{' '}
          <button type="button" className="font-semibold underline" onClick={() => {
              setError(null);
              setLoading(true);
              setReloadKey((k) => k + 1);
            }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isSystem = basket.is_system;
  const editTitle = isSystem ? SYSTEM_EDIT_TOOLTIP : undefined;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <BackLink />

      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{basket.name}</h1>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                isSystem
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 bg-gray-50 text-gray-600'
              }`}
            >
              {isSystem ? 'System · index' : 'My basket'}
            </span>
          </div>
          {basket.description && <p className="mt-1 text-gray-600">{basket.description}</p>}
          <p className="mt-1 text-sm text-gray-500">
            {basket.member_count} members
            {basket.weights_as_of && <> · Weights as of {basket.weights_as_of}</>}
            {basket.unresolved_count ? (
              <> · {basket.unresolved_count} constituents not resolved</>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={SECONDARY}
            disabled={isSystem}
            title={editTitle}
            onClick={() => setRenameOpen(true)}
          >
            <Pencil size={14} aria-hidden /> Rename
          </button>
          <button
            type="button"
            className={SECONDARY}
            disabled={isSystem}
            title={editTitle}
            onClick={() => setAddOpen(true)}
          >
            <Plus size={14} aria-hidden /> Add tickers
          </button>
          <button type="button" className={SECONDARY} onClick={() => setDuplicateOpen(true)}>
            <Copy size={14} aria-hidden /> Duplicate
          </button>
          <button
            type="button"
            className={`${SECONDARY} text-red-600`}
            disabled={isSystem}
            title={editTitle}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size={14} aria-hidden /> Delete
          </button>
        </div>
      </div>

      {basket.recent_changes.length > 0 && (
        <details className="mb-6 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-gray-800">
            Recent changes ({basket.recent_changes.length})
          </summary>
          <ul className="mt-3 space-y-1" data-testid="changes-full">
            {basket.recent_changes.map((c: BasketChange, i) => (
              <ChangeLine key={`${c.ticker}-${c.date}-${c.kind}-${i}`} change={c} showReason />
            ))}
          </ul>
        </details>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          className={`${INPUT} w-64`}
          placeholder="Search ticker or name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label htmlFor="basket-sector-filter" className="sr-only">
          Sector
        </label>
        <select
          id="basket-sector-filter"
          className={`${INPUT} w-56 bg-white`}
          value={sector}
          onChange={(e) => setSector(e.target.value)}
        >
          <option value="">All sectors</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-gray-500">
          {rows.length} of {basket.members.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm" data-testid="basket-members-table">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {COLUMNS.map((c) => {
                const active = c.key === sortKey;
                const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={`px-4 py-2 font-medium ${c.numeric ? 'text-right' : ''}`}
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 uppercase hover:text-gray-800 ${
                        active ? 'text-gray-800' : ''
                      }`}
                      onClick={() => toggleSort(c.key, c.numeric)}
                    >
                      {c.label}
                      <Icon size={12} aria-hidden />
                    </button>
                  </th>
                );
              })}
              {!isSystem && <th scope="col" className="px-4 py-2" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-gray-500">
                  {basket.members.length === 0 ? 'This basket has no members yet.' : 'No members match.'}
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr key={m.symbol_id} data-testid="basket-member-row" className="hover:bg-gray-50">
                <td className="px-4 py-2 font-semibold text-gray-900">{m.ticker}</td>
                <td className="px-4 py-2 text-gray-700">{m.name ?? '—'}</td>
                <td className="px-4 py-2 text-gray-600">{m.sector ?? '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatWeight(m.weight)}</td>
                <td className="px-4 py-2 text-right">
                  <RatingBadge rating={m.rating} />
                </td>
                <td className="px-4 py-2 tabular-nums text-gray-600">{formatDay(m.valid_from)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatPrice(m.price)}</td>
                {!isSystem && (
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      aria-label={`Remove ${m.ticker}`}
                      onClick={() => handleRemove(m)}
                    >
                      <X size={12} aria-hidden /> Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {renameOpen && (
        <BasketNameModal
          isOpen={renameOpen}
          title="Rename basket"
          submitLabel="Save"
          initialName={basket.name}
          initialDescription={basket.description ?? ''}
          onClose={() => setRenameOpen(false)}
          onSubmit={async (name, description) => {
            const updated = await updateBasket(basket.basket_id, { name, description });
            setBasket(updated);
            setRenameOpen(false);
          }}
        />
      )}
      {duplicateOpen && (
        <BasketNameModal
          isOpen={duplicateOpen}
          title="Duplicate basket"
          submitLabel="Duplicate"
          initialName={`${basket.name} copy`}
          onClose={() => setDuplicateOpen(false)}
          onSubmit={async (name) => {
            const created = await duplicateBasket(basket.basket_id, name);
            setDuplicateOpen(false);
            navigate(`/dashboard/baskets/${created.basket_id}`);
          }}
        />
      )}
      {!isSystem && (
        <AddTickersModal
          basketId={basket.basket_id}
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          onAdded={(res) => setBasket(res.basket)}
        />
      )}
      <DeleteBasketDialog
        basket={deleteOpen ? basket : null}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate('/dashboard/baskets')}
      />
    </div>
  );
}

function restoreMember(cur: BasketDetail, m: BasketMemberOut): BasketDetail {
  if (cur.members.some((x) => x.symbol_id === m.symbol_id)) return cur;
  return { ...cur, members: [...cur.members, m], member_count: cur.member_count + 1 };
}

function BackLink() {
  return (
    <Link to="/dashboard/baskets" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
      <ArrowLeft size={14} aria-hidden /> Baskets
    </Link>
  );
}
