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
    <div ref={containerRef} className="search-wrap">
      <Search className="search-icon" size={14} />
      {isLoading && <Loader2 className="search-loading" size={14} />}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        placeholder="Search portfolios, tickers, actions…"
        className="search-input"
      />

      {isOpen && results.length > 0 && (
        <div className="search-results">
          {results.map((symbol, idx) => (
            <button
              key={symbol.symbol_id}
              type="button"
              onClick={() => handleSelect(symbol)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`search-result ${idx === activeIndex ? 'active' : ''}`}
            >
              <span className="search-result-ticker">{symbol.ticker}</span>
              <span className="search-result-name">{symbol.name}</span>
              {symbol.exchange && (
                <span className="search-result-exchange">{symbol.exchange}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
