import { X } from 'lucide-react';
import { NavLink } from './NavLink';
import { NAV_ITEMS } from '@/config/navigation';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * MobileMenu Component
 *
 * Slide-down mobile navigation menu.
 * Shows all navigation items in a vertical list.
 */
export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu panel */}
      <div
        className="
          absolute top-full left-0 right-0 z-50
          bg-white border-b border-gray-200 shadow-lg
          lg:hidden
          animate-in slide-in-from-top-2 duration-200
        "
      >
        <div className="px-4 py-4">
          {/* Close button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Cerrar menú"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation links */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                label={item.label}
                icon={item.icon}
                onClick={onClose}
              />
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
