import { NavLink as RouterNavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface NavLinkProps {
  to: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
}

/**
 * NavLink Component
 *
 * Reusable navigation link with active state styling.
 * Uses react-router-dom's NavLink for automatic active detection.
 */
export function NavLink({ to, label, icon: Icon, onClick }: NavLinkProps) {
  return (
    <RouterNavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `
        flex items-center gap-2 px-3 py-2
        text-sm font-medium rounded-lg
        transition-colors duration-200
        ${
          isActive
            ? 'bg-[#1e3a5f] text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }
      `
      }
    >
      <Icon size={18} />
      <span>{label}</span>
    </RouterNavLink>
  );
}
