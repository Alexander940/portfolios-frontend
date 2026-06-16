import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Icon } from '../icons';
import { searchSymbols, type SymbolSearchItem } from '../service';
import type { ExcludedSymbol } from '../types';
import { Tip } from './formBits';

interface Props {
  value: ExcludedSymbol[];
  onChange: (next: ExcludedSymbol[]) => void;
}

export function ExclusionPicker({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const q = query.trim();
    // All setState lives in the (async) timeout callback — never synchronously in
    // the effect body — so the debounced search doesn't trigger cascading renders.
    const handle = setTimeout(() => {
      if (q.length < 1) {
        setResults([]);
        return;
      }
      setLoading(true);
      searchSymbols(q)
        .then((r) => setResults(r))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  // The dropdown is portaled to <body> with fixed positioning so it escapes the
  // section card's `overflow: hidden`. Track the input's box while it's open.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const selected = new Set(value.map((e) => e.symbolId));
  const add = (s: SymbolSearchItem) => {
    if (!selected.has(s.symbol_id)) {
      onChange([...value, { symbolId: s.symbol_id, ticker: s.ticker, name: s.name }]);
    }
    setQuery('');
    setResults([]);
    setOpen(false);
  };
  const remove = (id: string) => onChange(value.filter((e) => e.symbolId !== id));

  const showDropdown = open && query.trim().length > 0 && rect;

  return (
    <div className="sb-field" style={{ marginTop: 0 }}>
      <div className="sb-field-label">
        Exclusion list
        <Tip text="Stocks to exclude from the strategy, no matter the other filters." />
      </div>
      <input
        ref={inputRef}
        className="sb-input"
        placeholder="Search a ticker or name to exclude…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {showDropdown &&
        createPortal(
          <div
            className="sb-search-pop"
            style={{
              position: 'fixed',
              top: rect.bottom + 4,
              left: rect.left,
              width: rect.width,
            }}
          >
            {loading && <div className="sb-search-empty">Searching…</div>}
            {!loading && results.length === 0 && (
              <div className="sb-search-empty">No matches</div>
            )}
            {results.map((s) => (
              <button
                key={s.symbol_id}
                type="button"
                className="sb-search-item"
                disabled={selected.has(s.symbol_id)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(s)}
              >
                <span className="sb-search-tk">{s.ticker}</span>
                <span className="sb-search-nm">{s.name}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
      {value.length > 0 && (
        <div className="sb-chips">
          {value.map((e) => (
            <span key={e.symbolId} className="sb-chip" title={e.name}>
              {e.ticker}
              <button type="button" onClick={() => remove(e.symbolId)} aria-label={`Remove ${e.ticker}`}>
                <Icon name="x" size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
