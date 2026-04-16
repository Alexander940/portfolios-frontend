import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { searchSymbols, type SymbolSearchResult } from '@/services/symbolService';

interface SearchBarProps {
  onSelect: (symbol: SymbolSearchResult) => void;
}

export function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();
    if (q.length === 0) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    try {
      const data = await searchSymbols(q, 8, controller.signal);
      setResults(data);
      setIsOpen(data.length > 0);
      setActiveIndex(-1);
    } catch {
      if (!controller.signal.aborted) setResults([]);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(symbol: SymbolSearchResult) {
    setQuery('');
    setIsOpen(false);
    setResults([]);
    onSelect(symbol);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i < results.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : results.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        size={18}
      />
      {isLoading && (
        <Loader2
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
          size={16}
        />
      )}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        placeholder="Buscar ticker..."
        className="
          w-64 pl-10 pr-10 py-2
          bg-gray-100 border border-transparent rounded-lg
          text-sm text-gray-900 placeholder-gray-500
          focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent focus:bg-white
          transition-colors duration-200
        "
      />

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
          {results.map((symbol, idx) => (
            <button
              key={symbol.symbol_id}
              type="button"
              onClick={() => handleSelect(symbol)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`
                w-full px-4 py-3 text-left flex items-center gap-3 transition-colors
                ${idx === activeIndex ? 'bg-[#f0f4fa]' : 'hover:bg-gray-50'}
                ${idx > 0 ? 'border-t border-gray-100' : ''}
              `}
            >
              <span className="font-semibold text-gray-900 text-sm w-16 shrink-0">
                {symbol.ticker}
              </span>
              <span className="text-sm text-gray-600 truncate flex-1">
                {symbol.name}
              </span>
              {symbol.exchange && (
                <span className="text-xs text-gray-400 shrink-0">
                  {symbol.exchange}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
