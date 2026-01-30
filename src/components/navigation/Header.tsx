import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { NAV_ITEMS } from '@/config/navigation';
import { SearchBar } from './SearchBar';
import { NavLink } from './NavLink';
import { MobileMenu } from './MobileMenu';

/**
 * Header Component
 *
 * Main navigation header for the dashboard.
 * Features:
 * - Logo and branding
 * - Search bar (desktop only)
 * - Navigation links (desktop)
 * - Mobile hamburger menu
 * - User info and logout
 */
export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left section: Logo + Search */}
          <div className="flex items-center gap-6">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1e3a5f] rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#c9a227]" />
              </div>
              <span className="text-xl font-bold text-[#1e3a5f]">
                Portafolios
              </span>
            </Link>

            {/* Search bar - hidden on mobile */}
            <div className="hidden lg:block">
              <SearchBar />
            </div>
          </div>

          {/* Center section: Desktop navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </nav>

          {/* Right section: User menu + Mobile toggle */}
          <div className="flex items-center gap-4">
            {/* User info - hidden on small mobile */}
            <span className="hidden sm:block text-sm text-gray-600">
              Hola, <span className="font-medium">{user?.username}</span>
            </span>

            {/* Logout button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              rightIcon={<LogOut size={16} />}
              className="hidden sm:inline-flex"
            >
              Salir
            </Button>

            {/* Mobile: Logout icon only */}
            <button
              onClick={logout}
              className="sm:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Cerrar sesión"
            >
              <LogOut size={20} />
            </button>

            {/* Mobile menu button */}
            <button
              onClick={toggleMobileMenu}
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={isMobileMenuOpen}
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
    </header>
  );
}
