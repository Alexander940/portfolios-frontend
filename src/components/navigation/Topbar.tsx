import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Plus } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { SearchBar } from './SearchBar';
import { SymbolModal } from '@/components/symbol';
import type { SymbolSearchResult } from '@/services/symbolService';

/**
 * Topbar — sits above the main content, beside the sidebar.
 *
 * Holds the global ticker search, alerts bell, and user avatar with a
 * dropdown that exposes logout.
 */
export function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolSearchResult | null>(
    null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = getInitials(user?.username);
  const asOfLabel = formatAsOfNow();

  return (
    <header className="app-topbar">
      <div className="topbar-search-slot">
        <SearchBar onSelect={setSelectedSymbol} />
      </div>

      <div className="topbar-spacer" />

      <button type="button" className="topbar-btn" tabIndex={-1}>
        {asOfLabel}
      </button>

      <button type="button" className="topbar-icon-btn" aria-label="Alerts">
        <Bell size={16} />
        <span className="dot" />
      </button>

      <button
        type="button"
        className="topbar-btn primary"
        onClick={() => navigate('/dashboard/screening')}
      >
        <Plus size={13} strokeWidth={2.25} />
        New portfolio
      </button>

      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className="topbar-user"
          aria-label="User menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {initials}
        </button>
        {menuOpen && (
          <div className="user-menu" role="menu">
            <div className="user-menu-header">
              <strong>{user?.username ?? 'Usuario'}</strong>
              {user?.email && <span>{user.email}</span>}
            </div>
            <button
              type="button"
              className="user-menu-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
            >
              <LogOut size={14} />
              <span>Salir</span>
            </button>
          </div>
        )}
      </div>

      {selectedSymbol && (
        <SymbolModal
          isOpen={!!selectedSymbol}
          onClose={() => setSelectedSymbol(null)}
          symbolId={selectedSymbol.symbol_id}
          ticker={selectedSymbol.ticker}
          name={selectedSymbol.name}
          exchange={selectedSymbol.exchange}
          sector={selectedSymbol.sector}
        />
      )}
    </header>
  );
}

function getInitials(username: string | undefined): string {
  if (!username) return '?';
  const parts = username.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return username.charAt(0).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatAsOfNow(): string {
  const d = new Date();
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
  return `As of ${date}, ${time}`;
}
